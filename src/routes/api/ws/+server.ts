/**
 * WebSocket upgrade endpoint. Forwards the upgrade request to the MarketRoom Durable Object.
 * The DO handles all auth verification and WebSocket lifecycle management.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform, url }) => {
	const market = url.searchParams.get('market');
	if (!market) {
		return new Response('Missing market parameter', { status: 400 });
	}

	const env = platform!.env;
	const id = env.MARKET_ROOM.idFromName(market);
	const stub = env.MARKET_ROOM.get(id);
	return stub.fetch(request);
};
