/**
 * @module MarketRoom
 * Core game engine Durable Object. One instance per market, identified by name via `idFromName`.
 *
 * Lifecycle: `uninitialized` → `forming` → `full` → `running` → `completed`
 *
 * HIBERNATION SURVIVAL: All in-memory fields (`game`, `marketName`, `lastRegistrySnapshot`,
 * `kickedPlayers`, `lastClearedPeriod`) are set to safe defaults at declaration and restored
 * in the constructor via `blockConcurrencyWhile`. If a field is added without a corresponding
 * `storage.get()` in the constructor, it will silently reset to default after hibernation.
 *
 * Storage layout:
 * | Key               | Content                                         |
 * |-------------------|-------------------------------------------------|
 * | `game`            | GameState minus `periods` (via destructure)      |
 * | `period:{N}`      | Individual Period results                        |
 * | `marketName`      | Human-readable market name                       |
 * | `kickedPlayers`   | Array of permanently banned player names         |
 * | `registrySnapshot`| JSON of last registry-pushed state               |
 * | `cleanupAt`       | Epoch ms for deferred storage cleanup alarm      |
 * | `periods`         | LEGACY: single-blob period storage (fallback)    |
 *
 * @see persistAndBroadcast — the storage split boundary (destructure excludes `periods`)
 */

import { DurableObject } from 'cloudflare:workers';
import { isAdmin, verifyPlayerToken } from './auth';
import { WS_CLOSE_REPLACED, WS_CLOSE_KICKED, WS_CLOSE_RESET, WS_CLOSE_DELETED } from './constants';
import type { Env } from './env';
import {
	joinGame, updateOptions, setVisibility, submitOffers, rewardPlayer, kickPlayer,
	initializeNewGame, startGame, advancePeriod, setAutoAdvance, resetGame,
	getCurrentLoad, getNextLoad
} from './gameEngine';
import type { GameOptions, GameState, Period } from './types';
import { defaultGameState } from './types';
import { buildSnapshot, pushToRegistry, removeFromRegistry } from './registry';
import { getVisibleState, stripPlayerInternals } from './visibility';

/**
 * One Durable Object instance per market. Manages the full game lifecycle,
 * WebSocket connections (hibernation API), market clearing, and storage.
 * @see module doc at top of file for storage layout and hibernation rules.
 */
export class MarketRoom extends DurableObject<Env> {
	private static readonly CLEANUP_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours

	private game: GameState = defaultGameState();
	private marketName: string = '';
	private lastRegistrySnapshot: string = '';
	private kickedPlayers: Set<string> = new Set();
	private kickedPlayersDirty: boolean = false;
	/** Most recently cleared period — kept in memory for incremental broadcasts. */
	private lastClearedPeriod: Period | null = null;

	/**
	 * `blockConcurrencyWhile` ensures state is fully loaded from storage before any requests.
	 * This is the safe initialization gate that prevents incoming requests from racing with
	 * storage reads during cold start or hibernation wake.
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Cloudflare auto-replies "pong" to "ping" text frames without waking the DO from hibernation.
		this.ctx.setWebSocketAutoResponse(
			new WebSocketRequestResponsePair('ping', 'pong')
		);

		this.ctx.blockConcurrencyWhile(async () => {
			try {
				const [stored, name, kicked, snap] = await Promise.all([
					this.ctx.storage.get<GameState>('game'),
					this.ctx.storage.get<string>('marketName'),
					this.ctx.storage.get<string[]>('kickedPlayers'),
					this.ctx.storage.get<string>('registrySnapshot')
				]);

				if (stored && typeof stored === 'object') {
					this.game = stored;
					// Defensive defaults for fields that may be missing in older stored state
					this.game.state = this.game.state ?? 'uninitialized';
					this.game.visibility = this.game.visibility ?? 'public';
					this.game.players = this.game.players ?? {};
					this.game.gens = this.game.gens ?? {};
					this.game.nplayers = Object.keys(this.game.players).length;
					this.game.period = this.game.period ?? 0;
					this.game.auto_advance = this.game.auto_advance ?? false;
					this.game.advance_time = this.game.advance_time ?? 0;
					this.game.last_advance_time = this.game.last_advance_time ?? 0;
				}
				// Periods are NOT loaded into memory — stored per-key and loaded on-demand.
				// this.game.periods stays [] in memory. See loadPeriodsFromStorage().
				this.game.periods = [];

				if (name) this.marketName = name;
				if (kicked) this.kickedPlayers = new Set(kicked);
				if (snap) this.lastRegistrySnapshot = snap;
			} catch (err) {
				console.error('MarketRoom constructor: failed to load from storage, using defaults', err);
				this.game = defaultGameState();
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.headers.get('Upgrade') !== 'websocket') {
			return this.handleRestRequest(url, request);
		}

		return this.handleWebSocketUpgrade(url);
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') return;
		if (message === 'ping') return; // Handled by auto-response; ignore if DO is awake

		let msg: { type: string; payload?: any };
		try {
			msg = JSON.parse(message);
		} catch {
			return;
		}

		try {
			const tags = this.ctx.getTags(ws);
			const changed = await this.handleMessage(tags[0], tags[1], msg);
			if (changed) {
				// submitOffers only affects the submitter's own gens (filtered by visibility)
				// so skip broadcasting to other participants — admin + submitter get the update, full sync on advancePeriod
				const submitOnly = msg.type === 'submitOffers' ? ws : undefined;
				await this.persistAndBroadcast(submitOnly ? { submitterOnly: submitOnly } : undefined);
			} else if (msg.type !== 'submitOffers') {
				// Notify the sender that the operation was rejected (wrong state, role, etc.)
				try { ws.send(JSON.stringify({ type: 'error', payload: { message: `Action '${msg.type}' not allowed in current state.` } })); } catch { /* send failed */ }
			}
		} catch (err) {
			console.error('Error handling WebSocket message:', err);
			try { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Server error processing your request.' } })); } catch { /* send failed */ }
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
		// Reciprocal close required by CF hibernation API to avoid 1006 abnormal close errors
		try { ws.close(code, reason); } catch { /* already closed */ }
		this.broadcastConnectedClientsToAdmins();

		// Schedule inactivity cleanup when last client disconnects from a non-running game.
		// Running games may have auto-advance alarms; completed games already schedule cleanup.
		if (this.ctx.getWebSockets().length === 0
			&& this.game.state !== 'running'
			&& this.game.state !== 'completed') {
			await this.scheduleCleanupAlarm();
		}
	}

	async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
		try { ws.close(1011, 'WebSocket error'); } catch { /* already closed */ }
	}

	/**
	 * Dual-purpose alarm handler:
	 * 1. Auto-advance: fires when `auto_advance` is enabled and the period timer expires.
	 * 2. Deferred cleanup: fires 48h after game completion to delete storage if no one is connected.
	 *    Uses `cleanupAt - 1000` comparison to account for Cloudflare alarm jitter (~1s).
	 */
	async alarm(): Promise<void> {
		try {
			// Check if this is a cleanup alarm for a completed game
			const cleanupAt = await this.ctx.storage.get<number>('cleanupAt');
			if (cleanupAt && Date.now() >= cleanupAt - 1000) {
				if (this.game.state !== 'running' && this.ctx.getWebSockets().length === 0) {
					// No one connected — remove from registry and delete all storage
					await removeFromRegistry(this.env.MARKET_REGISTRY, this.marketName);
					await this.ctx.storage.deleteAll();
					return;
				}
				// Someone is still connected — reschedule
				if (this.ctx.getWebSockets().length > 0) {
					await this.scheduleCleanupAlarm();
					return;
				}
				// Cleanup alarm fired but game not completed — ignore
				return;
			}

			// Normal auto-advance alarm
			if (this.game.state === 'running' && this.game.auto_advance) {
				await this.handleAdvancePeriod();
				await this.persistAndBroadcast();
			}
		} catch (err) {
			console.error('Error in alarm handler:', err);
		}
	}

	private async scheduleCleanupAlarm(): Promise<void> {
		const cleanupTime = Date.now() + MarketRoom.CLEANUP_DELAY_MS;
		await this.ctx.storage.put('cleanupAt', cleanupTime);
		await this.ctx.storage.setAlarm(cleanupTime);
	}

	// --- REST Endpoints ---

	private async handleRestRequest(url: URL, request: Request): Promise<Response> {
		if (url.pathname === '/reset' && request.method === 'POST') {
			if (!(await this.isAuthorized(url))) return new Response('Unauthorized', { status: 401 });
			if (this.game.state === 'running') return new Response('Cannot reset while running', { status: 409 });
			await this.handleResetGame();
			await this.persistAndBroadcast();
			return new Response('OK');
		}

		if (url.pathname === '/destroy' && request.method === 'POST') {
			if (!(await this.isAuthorized(url))) return new Response('Unauthorized', { status: 401 });
			// Close all connected WebSockets
			for (const ws of this.ctx.getWebSockets()) {
				try { ws.close(WS_CLOSE_DELETED, 'Market deleted'); } catch { /* already closed */ }
			}
			// Remove from registry and reset state
			this.game = defaultGameState();
			await this.ctx.storage.deleteAlarm();
			await removeFromRegistry(this.env.MARKET_REGISTRY, this.marketName);
			// Delete all storage for this DO
			await this.ctx.storage.deleteAll();
			return new Response('OK');
		}

		if (url.pathname === '/info' && request.method === 'GET') {
			if (!(await this.isAuthorized(url))) return new Response('Unauthorized', { status: 401 });

			try {
				const { periods: _p, ...meta } = this.game;
				const gameBytes = new TextEncoder().encode(JSON.stringify(meta)).length;
				// Count period storage keys instead of loading all period data
				const periodKeys = await this.ctx.storage.list({ prefix: 'period:' });

				return Response.json({
					exists: this.game.state !== 'uninitialized',
					marketName: this.marketName || null,
					state: this.game.state,
					playerCount: Object.keys(this.game.players).length,
					periodCount: periodKeys.size || this.game.period,
					currentPeriod: this.game.period,
					estimatedStorageBytes: gameBytes,
					hasAlarm: (await this.ctx.storage.getAlarm()) !== null,
					connectedWebSockets: this.ctx.getWebSockets().length
				});
			} catch (err) {
				console.error('MarketRoom /info error:', err);
				return Response.json({
					exists: false,
					marketName: this.marketName || null,
					state: this.game.state ?? 'unknown',
					playerCount: 0,
					periodCount: 0,
					currentPeriod: 0,
					estimatedStorageBytes: 0,
					hasAlarm: false,
					connectedWebSockets: 0,
					error: 'Internal error reading DO state'
				}, { status: 200 }); // 200 so caller can still display partial info
			}
		}

		if (url.pathname === '/settings' && request.method === 'POST') {
			if (!(await this.isAuthorized(url))) return new Response('Unauthorized', { status: 401 });
			const body: { visibility?: string } = await request.json();
			let changed = false;
			if (body.visibility === 'public' || body.visibility === 'unlisted') {
				if (this.game.visibility !== body.visibility) {
					this.game.visibility = body.visibility;
					changed = true;
				}
			}
			if (changed) await this.persistAndBroadcast();
			return Response.json({ success: true });
		}

		if (url.pathname === '/csv-data' && request.method === 'GET') {
			const role = url.searchParams.get('role') || 'participant';
			const name = url.searchParams.get('name') || '';

			if (role === 'admin' && !(await this.isAuthorized(url))) {
				return new Response('Unauthorized', { status: 401 });
			}
			if (role === 'participant') {
				const token = url.searchParams.get('token');
				const verified = await verifyPlayerToken(token, this.env.ADMIN_PASSWORD);
				if (!verified || verified.name !== name) {
					return new Response('Unauthorized', { status: 401 });
				}
			}

			const allPeriods = await this.loadPeriodsFromStorage();
			const periods = role === 'admin'
				? allPeriods
				: allPeriods.map((p) => ({
					...p,
					players: { [name]: p.players[name] || { revenue: null, costs: null, profit: null, money: null } },
					gens: Object.fromEntries(
						Object.entries(p.gens).filter(([gId]) => this.game.gens[gId]?.owner === name)
					)
				}));

			return Response.json({
				periods,
				players: role === 'admin'
					? stripPlayerInternals(this.game.players)
					: { [name]: this.game.players[name] ? { money: this.game.players[name].money, last_offer_time: this.game.players[name].last_offer_time } : null },
				gens: role === 'admin' ? this.game.gens : Object.fromEntries(
					Object.entries(this.game.gens).filter(([, g]) => g.owner === name)
				),
				options: this.game.options
			});
		}

		return new Response('Not found', { status: 404 });
	}

	private isAuthorized(url: URL): Promise<boolean> {
		return isAdmin(url.searchParams.get('key'), this.env.ADMIN_PASSWORD);
	}

	// --- WebSocket Upgrade ---

	/**
	 * Handle WS upgrade: verify token → join game (if new participant) → upgrade → send initial state.
	 * Rejection happens BEFORE upgrade (`return new Response(error, { status: 403 })`)
	 * because HTTP error codes can't be sent after WS upgrade.
	 * Last-connection-wins: connecting with the same role+name closes the prior socket (code 4000).
	 */
	private async handleWebSocketUpgrade(url: URL): Promise<Response> {
		try {
			const role = url.searchParams.get('role') || 'participant';
			const name = url.searchParams.get('name') || 'unknown';
			const market = url.searchParams.get('market');

			if (role === 'admin' && !(await this.isAuthorized(url))) {
				return new Response('Unauthorized', { status: 401 });
			}

			// Persist market name only after auth succeeds (admin verified above)
			if (role === 'admin' && market && !this.marketName) {
				this.marketName = market;
				await this.ctx.storage.put('marketName', this.marketName);
			}

			let joinError: string | null = null;
			if (role === 'participant') {
				const token = url.searchParams.get('token');
				const verified = await verifyPlayerToken(token, this.env.ADMIN_PASSWORD);
				if (!verified || verified.name !== name) {
					joinError = 'Invalid or expired session. Please sign in again.';
				} else {
					// Token verified — safe to persist market name
					if (market && !this.marketName) {
						this.marketName = market;
						await this.ctx.storage.put('marketName', this.marketName);
					}
					if (this.game.players[name]) {
						// Reconnecting — verify UIN matches
						if (this.game.players[name].uin !== verified.uin) {
							joinError = 'This name is already taken by another student.';
						}
					} else {
						// New player — attempt to join
						const result = joinGame(this.game, this.kickedPlayers, name, verified.uin);
						if (result === 'ok') {
							await this.persistAndBroadcast();
						} else {
							const messages: Record<string, string> = {
								kicked: 'You have been removed from this game.',
								not_forming: 'This game is no longer accepting players.',
								invalid_name: 'Invalid name format.',
								name_taken: 'This name is already taken.'
							};
							joinError = messages[result];
						}
					}
				}
			}

			// Reject before upgrading if there's a security/join error
			if (joinError) {
				return new Response(joinError, { status: 403 });
			}

			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			this.ctx.acceptWebSocket(server, [role, name]);

			// Cancel any pending inactivity cleanup alarm (someone reconnected)
			if (this.game.state !== 'completed') {
				const cleanupAt = await this.ctx.storage.get<number>('cleanupAt');
				if (cleanupAt) {
					await this.ctx.storage.delete('cleanupAt');
					if (!this.game.auto_advance) {
						await this.ctx.storage.deleteAlarm();
					}
				}
			}

			// Close stale connections for the same identity (last-connection-wins)
			for (const existing of this.ctx.getWebSockets()) {
				if (existing === server) continue;
				try {
					const tags = this.ctx.getTags(existing);
					if (tags[0] === role && tags[1] === name) {
						existing.close(WS_CLOSE_REPLACED, 'Replaced by new connection');
					}
				} catch { /* already closed */ }
			}

			// Initial connection: load full period history from storage
			const periods = await this.loadPeriodsFromStorage();
			server.send(JSON.stringify({
				type: 'gameState',
				payload: getVisibleState({
					game: this.game, role, name,
					allPeriods: periods,
					lastClearedPeriod: this.lastClearedPeriod,
					connectedClients: this.getConnectedClients(),
					currentLoad: getCurrentLoad(this.game),
					nextLoad: getNextLoad(this.game)
				})
			}));

			// Notify admins of updated connected-client list (the new WS is now accepted)
			this.broadcastConnectedClientsToAdmins();

			return new Response(null, { status: 101, webSocket: client });
		} catch (err) {
			console.error('Error in WebSocket upgrade:', err);
			return new Response('Internal Server Error', { status: 500 });
		}
	}

	// --- Message Dispatch ---

	/**
	 * Route authenticated WS messages to handlers. Returns `true` if state was mutated
	 * and needs persist+broadcast. Role enforcement is here — handlers can assume correct authorization.
	 * WS tags: `tags[0]` is role, `tags[1]` is name (set via `acceptWebSocket(server, [role, name])`).
	 */
	private async handleMessage(role: string, name: string, msg: { type: string; payload?: any }): Promise<boolean> {
		const p = msg.payload;
		switch (msg.type) {
			case 'createGame':
				if (role === 'admin' && p) return await this.handleCreateGame(p);
				return false;
			case 'updateOptions':
				if (role === 'admin' && p) return updateOptions(this.game, p);
				return false;
			case 'startGame':
				if (role === 'admin') return await this.handleStartGame();
				return false;
			case 'advancePeriod':
				if (role === 'admin') return await this.handleAdvancePeriod();
				return false;
			case 'setAutoAdvance':
				if (role === 'admin' && p) return await this.handleSetAutoAdvance(p.enabled);
				return false;
			case 'setVisibility':
				if (role === 'admin' && p) return setVisibility(this.game, p.visibility);
				return false;
			case 'submitOffers':
				if (role === 'participant' && p) return submitOffers(this.game, name, p.offers);
				return false;
			case 'resetGame':
				if (role === 'admin') return await this.handleResetGame();
				return false;
			case 'kickPlayer':
				if (role === 'admin' && p) return this.handleKickPlayer(p.playerId);
				return false;
			case 'rewardPlayer':
				if (role === 'admin' && p) return rewardPlayer(this.game, p.playerId, p.amount);
				return false;
			default:
				return false;
		}
	}

	// --- Helpers ---

	private closeParticipantSockets(code: number, reason: string): void {
		for (const ws of this.ctx.getWebSockets()) {
			try {
				const tags = this.ctx.getTags(ws);
				if (tags[0] === 'participant') ws.close(code, reason);
			} catch { /* already closed */ }
		}
	}

	private async clearPeriodStorage(): Promise<void> {
		const keys = await this.ctx.storage.list({ prefix: 'period:' });
		if (keys.size > 0) await this.ctx.storage.delete([...keys.keys()]);
		await this.ctx.storage.delete('periods');
	}

	// --- Game Logic (delegates to gameEngine.ts for state mutations) ---

	private async handleCreateGame(options: GameOptions): Promise<boolean> {
		if (this.game.state === 'running') return false;
		this.closeParticipantSockets(WS_CLOSE_RESET, 'New game created');
		this.lastClearedPeriod = null;
		await this.ctx.storage.deleteAlarm();
		await this.clearPeriodStorage();
		initializeNewGame(this.game, options);
		this.kickedPlayers.clear();
		this.kickedPlayersDirty = true;
		await this.ctx.storage.delete('cleanupAt');
		return true;
	}

	private async handleStartGame(): Promise<boolean> {
		if (!startGame(this.game)) return false;
		this.lastClearedPeriod = null;
		await this.handleAdvancePeriod();
		return true;
	}

	private async handleAdvancePeriod(): Promise<boolean> {
		const result = advancePeriod(this.game);
		if (!result) return false;
		if (result.period) {
			await this.ctx.storage.put(`period:${result.period.number}`, result.period);
			this.lastClearedPeriod = result.period;
		}
		if (result.completed) {
			await this.ctx.storage.deleteAlarm();
			await this.scheduleCleanupAlarm();
		} else if (result.alarmTime) {
			await this.ctx.storage.setAlarm(result.alarmTime);
		}
		return true;
	}

	private async handleSetAutoAdvance(enabled: boolean): Promise<boolean> {
		const result = setAutoAdvance(this.game, enabled);
		if (!result) return false;
		if (result.deleteAlarm) {
			await this.ctx.storage.deleteAlarm();
		} else if (result.alarmTime) {
			await this.ctx.storage.setAlarm(result.alarmTime);
		}
		return true;
	}

	private async handleResetGame(): Promise<boolean> {
		if (this.game.state === 'running') return false;
		this.closeParticipantSockets(WS_CLOSE_RESET, 'Game was reset');
		this.game = resetGame();
		this.lastClearedPeriod = null;
		this.kickedPlayers.clear();
		this.kickedPlayersDirty = true;
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.delete('cleanupAt');
		this.lastRegistrySnapshot = '';
		await this.clearPeriodStorage();
		return true;
	}

	private handleKickPlayer(playerId: string): boolean {
		if (!kickPlayer(this.game, this.kickedPlayers, playerId)) return false;
		this.kickedPlayersDirty = true;
		// Close kicked player's WebSocket connections
		for (const ws of this.ctx.getWebSockets()) {
			try {
				const tags = this.ctx.getTags(ws);
				if (tags[0] === 'participant' && tags[1] === playerId) {
					ws.close(WS_CLOSE_KICKED, 'Kicked by admin');
				}
			} catch { /* already closed */ }
		}
		return true;
	}

	// --- Storage ---

	private async loadPeriodsFromStorage(): Promise<Period[]> {
		if (this.game.period < 1) return [];
		const entries = await this.ctx.storage.list<Period>({ prefix: 'period:' });
		if (entries.size > 0) {
			const periods = [...entries.values()];
			periods.sort((a, b) => a.number - b.number);
			return periods;
		}
		const legacy = await this.ctx.storage.get<Period[]>('periods');
		return legacy ?? [];
	}

	// --- Connected Clients ---

	private getConnectedClients(): string[] {
		const seen = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			try {
				const tags = this.ctx.getTags(ws);
				if (tags[0] === 'participant') seen.add(tags[1]);
			} catch { /* disconnected */ }
		}
		return [...seen];
	}

	// --- Persist & Broadcast ---

	private broadcastConnectedClientsToAdmins(): void {
		const clients = this.getConnectedClients();
		for (const ws of this.ctx.getWebSockets()) {
			try {
				const tags = this.ctx.getTags(ws);
				if (tags[0] === 'admin') {
					ws.send(JSON.stringify({
						type: 'connectedClients',
						payload: clients
					}));
				}
			} catch { /* disconnected */ }
		}
	}

	/**
	 * Persist game state and broadcast to all connected WebSockets.
	 *
	 * STORAGE SPLIT BOUNDARY: The `{ periods: _periods, ...meta }` destructure explicitly
	 * excludes `periods` from the `'game'` storage key. Period data is written individually
	 * in `clearMarket()` under `'period:{N}'` keys. This prevents the DO from loading the
	 * full period history (potentially 24+ records) on every hibernation wake.
	 *
	 * Registry is only updated when the snapshot string changes (avoids redundant DO-to-DO RPC).
	 * WS sends are fire-and-forget; failed sends close the socket.
	 */
	private async persistAndBroadcast(options?: { submitterOnly?: WebSocket }): Promise<void> {
		const { periods: _periods, ...meta } = this.game;
		const batch: Record<string, unknown> = { game: meta };
		if (this.kickedPlayersDirty) {
			batch.kickedPlayers = [...this.kickedPlayers];
			this.kickedPlayersDirty = false;
		}
		await this.ctx.storage.put(batch);

		// Only update registry if registry-relevant fields changed
		const snapshot = buildSnapshot(this.game);
		if (snapshot !== this.lastRegistrySnapshot) {
			const updated = await pushToRegistry(this.env.MARKET_REGISTRY, this.marketName, this.game);
			if (updated) {
				this.lastRegistrySnapshot = snapshot;
				await this.ctx.storage.put('registrySnapshot', snapshot);
			}
		}

		for (const ws of this.ctx.getWebSockets()) {
			try {
				const tags = this.ctx.getTags(ws);
				if (options?.submitterOnly && tags[0] !== 'admin' && ws !== options.submitterOnly) continue;
				ws.send(JSON.stringify({
					type: 'gameState',
					payload: getVisibleState({
						game: this.game, role: tags[0], name: tags[1],
						allPeriods: null,
						lastClearedPeriod: this.lastClearedPeriod,
						connectedClients: this.getConnectedClients(),
						currentLoad: getCurrentLoad(this.game),
						nextLoad: getNextLoad(this.game)
					})
				}));
			} catch {
				try { ws.close(1011, 'Send failed'); } catch { /* already closed */ }
			}
		}
	}
}
