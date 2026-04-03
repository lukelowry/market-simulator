/// <reference types="@cloudflare/workers-types" />

export interface Env {
	MARKET_ROOM: DurableObjectNamespace;
	MARKET_REGISTRY: DurableObjectNamespace;
	ADMIN_PASSWORD: string;
}
