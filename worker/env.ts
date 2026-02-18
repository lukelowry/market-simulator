/**
 * @module env
 * Cloudflare Workers environment bindings for the TAMU Energy Market Simulator.
 */

export interface Env {
	/** DO namespace for game rooms. Each named instance (via `idFromName`) is one active market. */
	MARKET_ROOM: DurableObjectNamespace;
	/** DO namespace for market listing. Singleton instance named `'global'`. */
	MARKET_REGISTRY: DurableObjectNamespace;
	/** Shared secret: both the admin login password AND the HMAC signing key for all session tokens. */
	ADMIN_PASSWORD: string;
}
