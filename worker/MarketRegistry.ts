/**
 * @module MarketRegistry
 * Singleton Durable Object (instantiated as `'global'`) that maintains the market listing.
 * Stores each market's summary metadata for the lobby browser.
 * Not authoritative for game state — MarketRoom pushes updates here via `updateRegistry()`.
 *
 * Storage schema: one key per market as `market:{name}`. Legacy single-blob `'markets'` key
 * is auto-migrated on first load after deployment.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import type { MarketInfo } from './types';

export class MarketRegistry extends DurableObject<Env> {
	private markets: Record<string, MarketInfo> = {};

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			// Load current per-key entries
			const entries = await this.ctx.storage.list<MarketInfo>({ prefix: 'market:' });
			for (const [key, info] of entries) {
				const name = key.slice('market:'.length);
				info.visibility = info.visibility || 'public';
				this.markets[name] = info;
			}

			// Migrate from legacy single-blob storage
			if (entries.size === 0) {
				const legacy = await this.ctx.storage.get<Record<string, MarketInfo>>('markets');
				if (legacy) {
					const batch: Record<string, MarketInfo> = {};
					for (const name of Object.keys(legacy)) {
						const info = legacy[name];
						info.visibility = info.visibility || 'public';
								this.markets[name] = info;
						batch[`market:${name}`] = info;
					}
					if (Object.keys(batch).length > 0) {
						await this.ctx.storage.put(batch);
					}
					await this.ctx.storage.delete('markets');
				}
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/list' && request.method === 'GET') {
			const showAll = url.searchParams.get('admin') === 'true';
			const all = Object.values(this.markets);
			if (showAll) {
				return Response.json(all);
			}
			return Response.json(all.filter(m => m.visibility === 'public'));
		}

		if (url.pathname === '/update' && request.method === 'POST') {
			const info: MarketInfo = await request.json();
			this.markets[info.name] = info;
			await this.ctx.storage.put(`market:${info.name}`, info);
			return new Response('OK');
		}

		if (url.pathname === '/remove' && request.method === 'POST') {
			const { name }: { name: string } = await request.json();
			delete this.markets[name];
			await this.ctx.storage.delete(`market:${name}`);
			return new Response('OK');
		}

		// Purge only removes from registry; does NOT delete MarketRoom DO storage.
		// Call /api/markets/destroy on each room separately for full cleanup.
		if (url.pathname === '/purge' && request.method === 'POST') {
			const names = Object.keys(this.markets);
			this.markets = {};
			const keys = names.map(n => `market:${n}`);
			if (keys.length > 0) await this.ctx.storage.delete(keys);
			return Response.json({ removed: names });
		}

		return new Response('Not found', { status: 404 });
	}
}
