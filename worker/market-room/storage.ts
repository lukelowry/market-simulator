import type { GameState, Period } from '$shared/game.js';
import type { RoomState } from '.';
import { pushToRegistry } from '../MarketRegistry';
import { getVisibleState } from '../game/visibility';

/** 48 hours — delay before storage cleanup after game completion / disconnect. */
const CLEANUP_DELAY_MS = 48 * 60 * 60 * 1000;

/** Iterate connected WebSockets with parsed tags. Silently skips disconnected sockets. */
export function forEachSocket(
	room: RoomState,
	fn: (ws: WebSocket, role: string, name: string) => void
): void {
	for (const ws of room.ctx.getWebSockets()) {
		try {
			const [role, name] = room.ctx.getTags(ws);
			fn(ws, role, name);
		} catch (err) {
			// Disconnected sockets throw on getTags() or send(). These are expected
			// during hibernation wake — the socket list can include stale entries.
			// TypeError covers CF runtime errors (e.g. "can't call method on closed WebSocket").
			// DOMException covers standard WebSocket API errors (InvalidStateError on send).
			if (err instanceof TypeError || err instanceof DOMException) continue;
			throw err;
		}
	}
}

export async function loadPeriodsFromStorage(room: RoomState): Promise<Period[]> {
	if (room.game.period < 1) return [];
	const entries = await room.ctx.storage.list<Period>({ prefix: 'period:' });
	const periods = [...entries.values()];
	periods.sort((a, b) => a.number - b.number);
	return periods;
}

export async function clearPeriodStorage(room: RoomState): Promise<void> {
	const keys = await room.ctx.storage.list({ prefix: 'period:' });
	if (keys.size > 0) await room.ctx.storage.delete([...keys.keys()]);
}

/** Get unique participant names from currently connected WebSockets. */
export function getConnectedClients(room: RoomState): string[] {
	const seen = new Set<string>();
	forEachSocket(room, (_ws, role, name) => {
		if (role === 'participant') seen.add(name);
	});
	return [...seen];
}

/** Broadcast the current connected-client list to all admin WebSockets. */
export function broadcastConnectedClientsToAdmins(room: RoomState): void {
	const clients = getConnectedClients(room);
	const msg = JSON.stringify({ type: 'connectedClients', payload: clients });
	forEachSocket(room, (ws, role) => {
		if (role === 'admin') ws.send(msg);
	});
}

/** Schedule a deferred storage-cleanup alarm 48h from now. */
export async function scheduleCleanupAlarm(room: RoomState): Promise<void> {
	const cleanupTime = Date.now() + CLEANUP_DELAY_MS;
	await room.ctx.storage.put({ cleanupAt: cleanupTime, alarmType: 'cleanup' });
	await room.ctx.storage.setAlarm(cleanupTime);
}

/** Serialize game state for storage, excluding periods (stored separately). */
function serializableGameState(game: GameState): Omit<GameState, 'periods'> {
	const { periods, ...meta } = game;
	return meta;
}

/** Persist game state to storage without broadcasting. Used during WebSocket upgrade
 *  where we need durability before accept but must defer broadcast until after. */
export async function persistGameState(room: RoomState): Promise<void> {
	await room.ctx.storage.put('game', serializableGameState(room.game));
	if (room.marketName) {
		await pushToRegistry(room.env.MARKET_REGISTRY, room.marketName, room.game);
	}
}

/**
 * Persist game state and broadcast to all connected WebSockets.
 *
 * STORAGE SPLIT BOUNDARY: `serializableGameState` explicitly excludes `periods` from the
 * `'game'` storage key. Period data is written individually in `advancePeriod()` under
 * `'period:{N}'` keys. This prevents the DO from loading the full period history
 * (potentially 24+ records) on every hibernation wake.
 *
 * WS sends are fire-and-forget; failed sends close the socket.
 */
export async function persistAndBroadcast(
	room: RoomState,
	options?: { submitterOnly?: WebSocket; lastClearedPeriod?: Period | null }
): Promise<void> {
	await room.ctx.storage.put('game', serializableGameState(room.game));

	if (room.marketName) {
		await pushToRegistry(room.env.MARKET_REGISTRY, room.marketName, room.game);
	}

	forEachSocket(room, (ws, role, name) => {
		if (options?.submitterOnly && role !== 'admin' && ws !== options.submitterOnly) return;
		try {
			ws.send(
				JSON.stringify({
					type: 'gameState',
					payload: getVisibleState({
						game: room.game,
						role,
						name,
						allPeriods: null,
						lastClearedPeriod: options?.lastClearedPeriod ?? null,
						connectedClients: getConnectedClients(room)
					})
				})
			);
		} catch {
			try {
				ws.close(1011, 'Send failed');
			} catch {
				/* already closed */
			}
		}
	});
}
