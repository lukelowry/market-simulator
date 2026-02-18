/**
 * @module admin.remote
 * Admin remote functions. Replaces /api/markets/* REST endpoints.
 */

import { command } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { isAdmin } from '$worker/auth.js';
import { getEnv, getMarketRoom, getRegistry } from '$lib/server/platform.js';

/** Verify admin key or throw 401. */
async function requireAdmin(key: string) {
	const env = getEnv();
	if (!(await isAdmin(key, env.ADMIN_PASSWORD))) {
		error(401, 'Unauthorized');
	}
}

export const destroyMarket = command(
	v.object({ name: v.string(), key: v.string() }),
	async ({ name, key }) => {
		await requireAdmin(key);
		await getMarketRoom(name).fetch(
			new Request(`https://room/destroy?key=${encodeURIComponent(key)}`, { method: 'POST' })
		);
		return { success: true };
	}
);

export const purgeMarkets = command(
	v.object({ key: v.string(), destroyStorage: v.optional(v.boolean()) }),
	async ({ key, destroyStorage }) => {
		await requireAdmin(key);
		const registry = getRegistry();
		const res = await registry.fetch(new Request('https://registry/purge', { method: 'POST' }));
		const { removed }: { removed: string[] } = await res.json();

		if (destroyStorage) {
			await Promise.allSettled(
				removed.map((name) =>
					getMarketRoom(name).fetch(
						new Request(`https://room/destroy?key=${encodeURIComponent(key)}`, { method: 'POST' })
					)
				)
			);
		}

		return { success: true, removed };
	}
);

export const updateMarketSettings = command(
	v.object({ name: v.string(), key: v.string(), visibility: v.optional(v.string()) }),
	async ({ name, key, visibility }) => {
		await requireAdmin(key);
		await getMarketRoom(name).fetch(
			new Request(`https://room/settings?key=${encodeURIComponent(key)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visibility })
			})
		);
		return { success: true };
	}
);

export const getMarketInfo = command(
	v.object({ name: v.string(), key: v.string() }),
	async ({ name, key }) => {
		await requireAdmin(key);
		const res = await getMarketRoom(name).fetch(
			new Request(`https://room/info?key=${encodeURIComponent(key)}`)
		);
		return await res.json();
	}
);

/** Race a promise against a timeout. Returns the result or a timeout error. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), ms);
		promise.then(
			(v) => { clearTimeout(timer); resolve(v); },
			(e) => { clearTimeout(timer); reject(e); }
		);
	});
}

export const getBulkMarketInfo = command(
	v.object({ key: v.string() }),
	async ({ key }) => {
		await requireAdmin(key);
		const registry = getRegistry();
		const listRes = await registry.fetch(new Request('https://registry/list?admin=true'));
		const marketList: { name: string }[] = await listRes.json();

		const results = await Promise.allSettled(
			marketList.map(async (m) => {
				const res = await withTimeout(
					getMarketRoom(m.name).fetch(
						new Request(`https://room/info?key=${encodeURIComponent(key)}`)
					),
					8000 // 8s per-DO timeout
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const info = await res.json();
				return { name: m.name, ...(info as object) };
			})
		);

		const infos = results.map((r, i) => {
			if (r.status === 'fulfilled') return r.value;
			const reason = r.reason instanceof Error ? r.reason.message : 'unknown';
			return { name: marketList[i].name, error: `Failed: ${reason}` };
		});

		return { markets: infos };
	}
);
