/**
 * CSV data endpoint. Proxies to the MarketRoom DO's /csv-data endpoint.
 * Kept as a +server.ts route because CsvExport.svelte uses fetch() + JSON processing.
 */

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const market = url.searchParams.get('market');
	if (!market) {
		return new Response('Missing market parameter', { status: 400 });
	}

	const env = platform!.env;
	const id = env.MARKET_ROOM.idFromName(market);
	const stub = env.MARKET_ROOM.get(id);
	const res = await stub.fetch(new Request(`https://room/csv-data?${url.searchParams.toString()}`));
	return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
};
