/**
 * MarketRoom Durable Object. Creates RoomState, delegates to handler modules.
 *
 * HIBERNATION: All mutable state lives on `this.room` (RoomState). Fields are restored
 * from storage in `blockConcurrencyWhile`. Adding a field without a storage.get() here
 * will silently reset to default after hibernation.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env';
import { createDefaultGameState, type GameState } from '$shared/game.js';
import { removeFromRegistry } from '../MarketRegistry';
import {
	broadcastConnectedClientsToAdmins,
	scheduleCleanupAlarm,
	persistAndBroadcast
} from './storage';
import { handleRestRequest } from './rest-handlers';
import { handleWebSocketUpgrade, handleMessage, handleAdvancePeriod } from './ws-handlers';

export interface RoomState {
	ctx: DurableObjectState;
	env: Env;
	game: GameState;
	marketName: string;
}

/**
 * One Durable Object instance per market. Manages the full game lifecycle,
 * WebSocket connections (hibernation API), market clearing, and storage.
 */
export class MarketRoom extends DurableObject<Env> {
	private room: RoomState;

	/**
	 * `blockConcurrencyWhile` ensures state is fully loaded from storage before any requests.
	 * This is the safe initialization gate that prevents incoming requests from racing with
	 * storage reads during cold start or hibernation wake.
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize RoomState with safe defaults
		this.room = {
			ctx,
			env,
			game: createDefaultGameState(),
			marketName: ''
		};

		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

		ctx.blockConcurrencyWhile(async () => {
			try {
				const [stored, name] = await Promise.all([
					ctx.storage.get<GameState>('game'),
					ctx.storage.get<string>('marketName')
				]);

				if (stored && typeof stored === 'object') {
					this.room.game = stored;
					this.room.game.players = this.room.game.players ?? {};
					this.room.game.gens = this.room.game.gens ?? {};
				}
				// The 'game' storage key never contains periods (see serializableGameState).
				// Period data lives under 'period:N' keys and is loaded on-demand via
				// loadPeriodsFromStorage() during WebSocket upgrade. Initialize empty here
				// so the in-memory GameState always has a valid array.
				this.room.game.periods = [];

				if (name) this.room.marketName = name;
			} catch (err) {
				console.error('MarketRoom constructor: failed to load from storage, using defaults', err);
				this.room.game = createDefaultGameState();
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.headers.get('Upgrade') !== 'websocket') {
			return handleRestRequest(url, request, this.room);
		}

		return handleWebSocketUpgrade(url, this.room);
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
			const tags = this.room.ctx.getTags(ws);
			const result = await handleMessage(tags[0], tags[1], msg, this.room);
			if (result.changed) {
				// submitOffers only affects the submitter's own gens (filtered by visibility)
				// so skip broadcasting to other participants — admin + submitter get the update, full sync on advancePeriod
				const submitOnly = msg.type === 'submitOffers' ? ws : undefined;
				await persistAndBroadcast(this.room, {
					...(submitOnly ? { submitterOnly: submitOnly } : {}),
					lastClearedPeriod: result.lastClearedPeriod
				});
			} else {
				// Notify the sender that the operation was rejected (wrong state, role, period mismatch, etc.)
				try {
					ws.send(
						JSON.stringify({
							type: 'error',
							payload: { message: `Action '${msg.type}' not allowed in current state.` }
						})
					);
				} catch {
					/* send failed */
				}
			}
		} catch (err) {
			console.error('Error handling WebSocket message:', err);
			try {
				ws.send(
					JSON.stringify({
						type: 'error',
						payload: { message: 'Server error processing your request.' }
					})
				);
			} catch {
				/* send failed */
			}
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
		// Reciprocal close required by CF hibernation API to avoid 1006 abnormal close errors
		try {
			ws.close(code, reason);
		} catch {
			/* already closed */
		}
		broadcastConnectedClientsToAdmins(this.room);

		// Schedule inactivity cleanup when last client disconnects from a non-running game.
		// Running games may have auto-advance alarms; completed games already schedule cleanup.
		if (
			this.room.ctx.getWebSockets().length === 0 &&
			this.room.game.state !== 'running' &&
			this.room.game.state !== 'completed'
		) {
			await scheduleCleanupAlarm(this.room);
		}
	}

	async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
		try {
			ws.close(1011, 'WebSocket error');
		} catch {
			/* already closed */
		}
	}

	async alarm(): Promise<void> {
		try {
			const alarmType = await this.room.ctx.storage.get<string>('alarmType');

			if (alarmType === 'cleanup') {
				if (this.room.game.state !== 'running' && this.room.ctx.getWebSockets().length === 0) {
					await removeFromRegistry(this.room.env.MARKET_REGISTRY, this.room.marketName);
					await this.room.ctx.storage.deleteAll();
					return;
				}
				if (this.room.ctx.getWebSockets().length > 0) {
					await scheduleCleanupAlarm(this.room);
					return;
				}
				return;
			}

			// Default: auto-advance
			if (this.room.game.state === 'running' && this.room.game.auto_advance) {
				const result = await handleAdvancePeriod(this.room);
				if (result) await persistAndBroadcast(this.room, { lastClearedPeriod: result.period });
			}
		} catch (err) {
			console.error('Error in alarm handler:', err);
		}
	}
}
