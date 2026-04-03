import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import type { MarketListItem, GameState } from '$shared/game.js';

export type RegistryEntry = Omit<MarketListItem, 'isMember'> & { playerUins: string[] };

/** Singleton DO that maintains the market listing for the lobby browser. */
export class MarketRegistry extends DurableObject<Env> {
	private markets: Record<string, RegistryEntry> = {};

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			const entries = await this.ctx.storage.list<RegistryEntry>({ prefix: 'market:' });
			const stale: string[] = [];
			for (const [key, info] of entries) {
				if (!info.playerUins) {
					stale.push(key);
				} else {
					this.markets[key.slice('market:'.length)] = info;
				}
			}
			if (stale.length > 0) await this.ctx.storage.delete(stale);
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/list' && request.method === 'GET') {
			const uin = url.searchParams.get('uin');
			const toListItem = ({ playerUins, ...rest }: RegistryEntry): MarketListItem => ({
				...rest,
				...(uin ? { isMember: playerUins.includes(uin) } : {})
			});
			const all = Object.values(this.markets);
			if (url.searchParams.get('admin') === 'true') return Response.json(all.map(toListItem));
			return Response.json(all.filter((m) => m.visibility === 'public').map(toListItem));
		}

		if (url.pathname === '/update' && request.method === 'POST') {
			const info: RegistryEntry = await request.json();
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

		if (url.pathname === '/purge' && request.method === 'POST') {
			const names = Object.keys(this.markets);
			this.markets = {};
			const keys = names.map((n) => `market:${n}`);
			if (keys.length > 0) await this.ctx.storage.delete(keys);
			return Response.json({ removed: names });
		}

		return new Response('Not found', { status: 404 });
	}
}

/** Push current game state to the global MarketRegistry DO. Retries once on failure. */
export async function pushToRegistry(
	registryNS: DurableObjectNamespace,
	marketName: string,
	game: GameState
): Promise<boolean> {
	if (!marketName) return false;

	const doUpdate = async () => {
		const registry = registryNS.get(registryNS.idFromName('global'));
		if (game.state === 'uninitialized') {
			await removeFromRegistry(registryNS, marketName);
		} else {
			await registry.fetch(
				new Request('https://registry/update', {
					method: 'POST',
					body: JSON.stringify({
						name: marketName,
						state: game.state,
						visibility: game.visibility,
						playerCount: Object.keys(game.players).length,
						maxPlayers: game.options?.max_participants ?? 0,
						updatedAt: Date.now(),
						playerUins: Object.values(game.players).map(p => p.uin)
					})
				})
			);
		}
	};

	try {
		await doUpdate();
		return true;
	} catch (err) {
		console.warn('Registry update failed, retrying:', err);
	}

	// Single retry after brief delay — covers DO cold-start and transient network errors
	try {
		await new Promise(r => setTimeout(r, 200));
		await doUpdate();
		return true;
	} catch (err) {
		console.error('Registry update failed after retry:', err);
		return false;
	}
}

/** Remove a market from the global MarketRegistry DO. */
export async function removeFromRegistry(
	registryNS: DurableObjectNamespace,
	marketName: string
): Promise<void> {
	if (!marketName) return;
	try {
		const registry = registryNS.get(registryNS.idFromName('global'));
		await registry.fetch(
			new Request('https://registry/remove', {
				method: 'POST',
				body: JSON.stringify({ name: marketName })
			})
		);
	} catch (err) {
		console.error('Registry remove failed:', err);
	}
}
