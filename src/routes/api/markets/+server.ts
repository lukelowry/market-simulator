/**
 * Market listing endpoint. Bypasses SvelteKit query caching so the sidebar
 * can poll for fresh data on every request.
 */

import type { RequestHandler } from './$types';
import { isAdmin, verifyPlayerToken } from '$worker/auth.js';

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = platform!.env;
	const key = url.searchParams.get('key');
	const isAdminAuth = key ? await isAdmin(key, env.ADMIN_PASSWORD) : false;

	const listParams = new URLSearchParams();
	if (isAdminAuth) listParams.set('admin', 'true');

	const token = url.searchParams.get('token');
	if (token) {
		const verified = await verifyPlayerToken(token, env.ADMIN_PASSWORD);
		if (verified) listParams.set('uin', verified.uin);
	}

	const listUrl = `https://registry/list?${listParams}`;
	const registryId = env.MARKET_REGISTRY.idFromName('global');
	const registry = env.MARKET_REGISTRY.get(registryId);
	const res = await registry.fetch(new Request(listUrl));
	const data = await res.json();

	return Response.json(data, {
		headers: { 'Cache-Control': 'no-store' }
	});
};
