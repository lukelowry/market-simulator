import { appendFileSync } from 'fs';

// Append Durable Object class exports to the adapter-cloudflare generated worker.
// The adapter overwrites worker-entry.ts with the SvelteKit worker code,
// so we re-add our DO exports after each build.
appendFileSync(
	'worker-entry.ts',
	'\nexport { MarketRoom } from "./worker/MarketRoom";\nexport { MarketRegistry } from "./worker/MarketRegistry";\n'
);
