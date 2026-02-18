import { readFileSync, writeFileSync } from 'fs';

// Append Durable Object class exports to the adapter-cloudflare generated worker.
// The adapter overwrites worker-entry.ts with the SvelteKit worker code,
// so we re-add our DO exports after each build.
// Uses a marker comment to ensure idempotency (safe to run multiple times).
const MARKER = '// DO-EXPORTS-PATCHED';
const EXPORTS = `\n${MARKER}\nexport { MarketRoom } from "./worker/MarketRoom";\nexport { MarketRegistry } from "./worker/MarketRegistry";\n`;
const content = readFileSync('worker-entry.ts', 'utf8');
if (!content.includes(MARKER)) {
	writeFileSync('worker-entry.ts', content + EXPORTS);
}
