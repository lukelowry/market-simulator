import { isAdmin, verifyPlayerToken } from '../auth';
import { WS_CLOSE_REPLACED, WS_CLOSE_KICKED, WS_CLOSE_RESET } from '$shared/constants.js';
import type { GameOptions, Period } from '$shared/game.js';
import type { RoomState } from '.';
import {
	joinGame,
	updateOptions,
	setVisibility,
	submitOffers,
	rewardPlayer,
	kickPlayer,
	initializeNewGame,
	startGame,
	advancePeriod,
	setAutoAdvance,
	resetGame,
} from '../game/engine';
import { getVisibleState } from '../game/visibility';
import {
	forEachSocket,
	loadPeriodsFromStorage,
	clearPeriodStorage,
	getConnectedClients,
	broadcastConnectedClientsToAdmins,
	persistAndBroadcast,
	persistGameState,
	scheduleCleanupAlarm
} from './storage';

function closeParticipantSockets(room: RoomState, code: number, reason: string): void {
	forEachSocket(room, (ws, role) => {
		if (role === 'participant') ws.close(code, reason);
	});
}

async function handleCreateGame(options: GameOptions, room: RoomState): Promise<boolean> {
	if (room.game.state === 'running') return false;
	closeParticipantSockets(room, WS_CLOSE_RESET, 'New game created');
	await room.ctx.storage.deleteAlarm();
	await clearPeriodStorage(room);
	initializeNewGame(room.game, options);
	await room.ctx.storage.delete('cleanupAt');
	return true;
}

async function handleStartGame(room: RoomState): Promise<boolean> {
	if (!startGame(room.game)) return false;
	const result = await handleAdvancePeriod(room);
	return result !== null;
}

async function handleSetAutoAdvance(enabled: boolean, room: RoomState): Promise<boolean> {
	const result = setAutoAdvance(room.game, enabled);
	if (!result) return false;
	if (result.deleteAlarm) {
		await room.ctx.storage.deleteAlarm();
	} else if (result.alarmTime) {
		await room.ctx.storage.setAlarm(result.alarmTime);
		await room.ctx.storage.put('alarmType', 'advance');
	}
	return true;
}

function handleKickPlayer(playerId: string, room: RoomState): boolean {
	if (!kickPlayer(room.game, playerId)) return false;
	// Close kicked player's WebSocket connections
	forEachSocket(room, (ws, role, name) => {
		if (role === 'participant' && name === playerId) {
			ws.close(WS_CLOSE_KICKED, 'Kicked by admin');
		}
	});
	return true;
}

// --- Exported handlers used by index.ts and rest-handlers ---

/**
 * Advance the game period. Exported for use by the alarm handler in index.ts
 * and by handleStartGame.
 */
export async function handleAdvancePeriod(room: RoomState): Promise<{ advanced: true; period: Period | null } | null> {
	const result = advancePeriod(room.game);
	if (!result) return null;
	if (result.period) {
		await room.ctx.storage.put(`period:${result.period.number}`, result.period);
	}
	if (result.completed) {
		await room.ctx.storage.deleteAlarm();
		await scheduleCleanupAlarm(room);
	} else if (result.alarmTime) {
		await room.ctx.storage.setAlarm(result.alarmTime);
		await room.ctx.storage.put('alarmType', 'advance');
	}
	return { advanced: true, period: result.period };
}

/** Reset the game to uninitialized state. Exported for use by rest-handlers /reset endpoint. */
export async function handleResetGame(room: RoomState): Promise<boolean> {
	if (room.game.state === 'running') return false;
	closeParticipantSockets(room, WS_CLOSE_RESET, 'Game was reset');
	room.game = resetGame();
	await room.ctx.storage.deleteAlarm();
	await room.ctx.storage.delete('cleanupAt');
	await clearPeriodStorage(room);
	return true;
}

// --- WebSocket Upgrade ---

/**
 * Handle WS upgrade: verify token -> join game (if new participant) -> upgrade -> send initial state.
 * Rejection happens BEFORE upgrade (`return new Response(error, { status: 403 })`)
 * because HTTP error codes can't be sent after WS upgrade.
 * Last-connection-wins: connecting with the same role+name closes the prior socket (code 4000).
 */
export async function handleWebSocketUpgrade(url: URL, room: RoomState): Promise<Response> {
	try {
		const role = url.searchParams.get('role') || 'participant';
		const name = url.searchParams.get('name') || 'unknown';
		const market = url.searchParams.get('market');

		if (role === 'admin' && !(await isAdmin(url.searchParams.get('key'), room.env.ADMIN_PASSWORD))) {
			return new Response('Unauthorized', { status: 401 });
		}

		// Persist market name only after auth succeeds (admin verified above)
		if (role === 'admin' && market && !room.marketName) {
			room.marketName = market;
			await room.ctx.storage.put('marketName', room.marketName);
		}

		let joinError: string | null = null;
		let playerJoined = false;
		if (role === 'participant') {
			const token = url.searchParams.get('token');
			const verified = await verifyPlayerToken(token, room.env.ADMIN_PASSWORD);
			if (!verified || verified.name !== name) {
				joinError = 'Invalid or expired session. Please sign in again.';
			} else {
				// Token verified — safe to persist market name
				if (market && !room.marketName) {
					room.marketName = market;
					await room.ctx.storage.put('marketName', room.marketName);
				}
				if (room.game.players[name]) {
					// Reconnecting — verify UIN matches
					if (room.game.players[name].uin !== verified.uin) {
						joinError = 'This name is already taken by another student.';
					}
				} else {
					// New player — attempt to join
					const result = joinGame(room.game, name, verified.uin);
					if (result === 'ok') {
						// Persist immediately for durability; broadcast deferred until after accept
						await persistGameState(room);
						playerJoined = true;
					} else {
						const messages: Record<string, string> = {
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

		room.ctx.acceptWebSocket(server, [role, name]);

		// Cancel any pending inactivity cleanup alarm (someone reconnected)
		if (room.game.state !== 'completed') {
			const cleanupAt = await room.ctx.storage.get<number>('cleanupAt');
			if (cleanupAt) {
				await room.ctx.storage.delete('cleanupAt');
				if (!room.game.auto_advance) {
					await room.ctx.storage.deleteAlarm();
				}
			}
		}

		// Close stale connections for the same identity (last-connection-wins)
		forEachSocket(room, (ws, wsRole, wsName) => {
			if (ws === server) return;
			if (wsRole === role && wsName === name) {
				ws.close(WS_CLOSE_REPLACED, 'Replaced by new connection');
			}
		});

		// Initial connection: load full period history from storage
		const periods = await loadPeriodsFromStorage(room);
		server.send(
			JSON.stringify({
				type: 'gameState',
				payload: getVisibleState({
					game: room.game,
					role,
					name,
					allPeriods: periods,
					lastClearedPeriod: null,
					connectedClients: getConnectedClients(room)
				})
			})
		);

		// Broadcast after accept so all sockets (including the new one) are reachable.
		// When a new player joined, this notifies admins of the updated players list.
		// For all connections, this updates the connected-client indicators.
		if (playerJoined) {
			await persistAndBroadcast(room);
		} else {
			broadcastConnectedClientsToAdmins(room);
		}

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
export async function handleMessage(
	role: string,
	name: string,
	msg: { type: string; payload?: any },
	room: RoomState
): Promise<{ changed: boolean; lastClearedPeriod?: Period | null }> {
	const p = msg.payload;
	switch (msg.type) {
		case 'createGame':
			if (role === 'admin' && p) return { changed: await handleCreateGame(p, room) };
			return { changed: false };
		case 'updateOptions':
			if (role === 'admin' && p) return { changed: updateOptions(room.game, p) };
			return { changed: false };
		case 'startGame':
			if (role === 'admin') return { changed: await handleStartGame(room) };
			return { changed: false };
		case 'advancePeriod':
			if (role === 'admin') {
				const result = await handleAdvancePeriod(room);
				return result ? { changed: true, lastClearedPeriod: result.period } : { changed: false };
			}
			return { changed: false };
		case 'setAutoAdvance':
			if (role === 'admin' && p) return { changed: await handleSetAutoAdvance(p.enabled, room) };
			return { changed: false };
		case 'setVisibility':
			if (role === 'admin' && p) return { changed: setVisibility(room.game, p.visibility) };
			return { changed: false };
		case 'submitOffers':
			if (role === 'participant' && p) return { changed: submitOffers(room.game, name, p.offers, p.period) };
			return { changed: false };
		case 'resetGame':
			if (role === 'admin') return { changed: await handleResetGame(room) };
			return { changed: false };
		case 'kickPlayer':
			if (role === 'admin' && p) return { changed: handleKickPlayer(p.playerId, room) };
			return { changed: false };
		case 'rewardPlayer':
			if (role === 'admin' && p) return { changed: rewardPlayer(room.game, p.playerId, p.amount) };
			return { changed: false };
		default:
			return { changed: false };
	}
}
