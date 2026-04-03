import { isAdmin } from '../auth';
import { WS_CLOSE_DELETED } from '$shared/constants.js';
import { createDefaultGameState } from '$shared/game.js';
import type { RoomState } from '.';
import { removeFromRegistry } from '../MarketRegistry';
import { forEachSocket } from './storage';

function isAuthorized(url: URL, room: RoomState): Promise<boolean> {
	return isAdmin(url.searchParams.get('key'), room.env.ADMIN_PASSWORD);
}

/** Route non-WebSocket HTTP requests to the appropriate handler. */
export async function handleRestRequest(
	url: URL,
	request: Request,
	room: RoomState
): Promise<Response> {
	if (url.pathname === '/destroy' && request.method === 'POST') {
		if (!(await isAuthorized(url, room))) return new Response('Unauthorized', { status: 401 });
		// Close all connected WebSockets
		forEachSocket(room, (ws) => ws.close(WS_CLOSE_DELETED, 'Market deleted'));
		// Remove from registry and reset state
		room.game = createDefaultGameState();
		await room.ctx.storage.deleteAlarm();
		await removeFromRegistry(room.env.MARKET_REGISTRY, room.marketName);
		// Delete all storage for this DO
		await room.ctx.storage.deleteAll();
		return new Response('OK');
	}

	if (url.pathname === '/info' && request.method === 'GET') {
		if (!(await isAuthorized(url, room))) return new Response('Unauthorized', { status: 401 });

		try {
			const { periods: _p, ...meta } = room.game;
			const gameBytes = new TextEncoder().encode(JSON.stringify(meta)).length;
			// Count period storage keys instead of loading all period data
			const periodKeys = await room.ctx.storage.list({ prefix: 'period:' });

			return Response.json({
				exists: room.game.state !== 'uninitialized',
				marketName: room.marketName || null,
				state: room.game.state,
				playerCount: Object.keys(room.game.players).length,
				periodCount: periodKeys.size || room.game.period,
				currentPeriod: room.game.period,
				estimatedStorageBytes: gameBytes,
				hasAlarm: (await room.ctx.storage.getAlarm()) !== null,
				connectedWebSockets: room.ctx.getWebSockets().length
			});
		} catch (err) {
			console.error('MarketRoom /info error:', err);
			return Response.json(
				{
					exists: false,
					marketName: room.marketName || null,
					state: room.game.state ?? 'unknown',
					playerCount: 0,
					periodCount: 0,
					currentPeriod: 0,
					estimatedStorageBytes: 0,
					hasAlarm: false,
					connectedWebSockets: 0,
					error: 'Internal error reading DO state'
				},
				{ status: 200 }
			); // 200 so caller can still display partial info
		}
	}

	return new Response('Not found', { status: 404 });
}
