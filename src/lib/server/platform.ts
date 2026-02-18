/**
 * @module platform
 * Helpers for accessing Cloudflare Durable Object bindings from SvelteKit server code.
 */

import { getRequestEvent } from '$app/server';
import type { Env } from '$worker/env.js';

/** Get the typed Cloudflare env from the current request context. */
export function getEnv(): Env {
	const { platform } = getRequestEvent();
	return platform!.env;
}

/** Get a MarketRoom Durable Object stub by market name. */
export function getMarketRoom(name: string) {
	const env = getEnv();
	return env.MARKET_ROOM.get(env.MARKET_ROOM.idFromName(name));
}

/** Get the singleton MarketRegistry Durable Object stub. */
export function getRegistry() {
	const env = getEnv();
	return env.MARKET_REGISTRY.get(env.MARKET_REGISTRY.idFromName('global'));
}
