/**
 * @module markets.remote
 * Market listing remote query. Replaces /api/markets REST endpoint.
 */

import { query } from '$app/server';
import * as v from 'valibot';
import { isAdmin } from '$worker/auth.js';
import { getEnv, getRegistry } from '$lib/server/platform.js';

/** Fetch market list from the registry DO. Pass an admin key to include unlisted markets. */
export const listMarkets = query(
	v.optional(v.string()),
	async (adminKey) => {
		const env = getEnv();
		const registry = getRegistry();
		const isAdminAuth = adminKey ? await isAdmin(adminKey, env.ADMIN_PASSWORD) : false;
		const listUrl = isAdminAuth ? 'https://registry/list?admin=true' : 'https://registry/list';
		const res = await registry.fetch(new Request(listUrl));
		return await res.json();
	}
);
