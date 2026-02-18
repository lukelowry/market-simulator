import type { Env } from '../worker/env';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf: CfProperties;
		}
	}
}

export {};
