/**
 * @module csv
 * CSV export pipeline: fetch game data from the worker, generate a CSV string, and trigger a browser download.
 * Admin exports include all players and generators; participant exports are server-filtered to own data only.
 */

import type { Period, Player, Generator, GameOptions } from '$lib/types/game.js';

/** RFC 4180 quoting — fields with commas, quotes, or newlines are double-quoted with internal quotes doubled. */
function escapeCsvField(field: string): string {
	if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
		return `"${field.replace(/"/g, '""')}"`;
	}
	return field;
}

/** Shape returned by the `/api/csv-data` endpoint. */
interface CsvData {
	periods: Period[];
	players: Record<string, Player>;
	gens: Record<string, Generator>;
	options?: GameOptions;
}

/**
 * Build a CSV string from game data. `isAdmin` controls which players/gens are included;
 * when false, only the participant's own data appears.
 */
export function generateCsvFromData(data: CsvData, isAdmin: boolean, participantName: string): string {
	const playerKeys = Object.keys(data.players).filter(k => isAdmin || participantName === k);
	const genKeys = Object.keys(data.gens).filter(k => isAdmin || data.gens[k].owner === participantName);

	const header = [
		'Period', 'Load', 'Marginal Price ($/MWh)',
		...playerKeys.flatMap(k => [`${k} Revenue`, `${k} Costs`, `${k} Profit`, `${k} Money`]),
		...genKeys.flatMap(k => [`${k} Offer`, `${k} MW`])
	];

	const rows = [header, ...data.periods.map(period => [
		String(period.number),
		String(period.load),
		String(period.marginal_cost ?? ''),
		...playerKeys.flatMap(k => {
			const pp = period.players[k];
			return [String(pp?.revenue ?? ''), String(pp?.costs ?? ''), String(pp?.profit ?? ''), String(pp?.money ?? '')];
		}),
		...genKeys.flatMap(k => {
			const pg = period.gens?.[k];
			return [String(pg?.offer ?? ''), String(pg?.mw ?? '')];
		})
	])];

	return rows.map(r => r.map(escapeCsvField).join(',')).join('\n');
}

/** Fetch full game data from `/api/csv-data`. The `role` param controls server-side filtering, not just display. */
export async function fetchCsvData(market: string, role: string, name: string, key?: string, token?: string): Promise<CsvData> {
	const params = new URLSearchParams({ market, role, name });
	if (key) params.set('key', key);
	if (token) params.set('token', token);
	const res = await fetch(`/api/csv-data?${params.toString()}`);
	if (!res.ok) throw new Error(`Failed to fetch CSV data: ${res.status}`);
	return res.json();
}

/** Trigger a browser file download via a temporary `<a>` element. Safe to call `revokeObjectURL` synchronously after click. */
export function downloadCsv(csvData: string, filename: string = 'TAMU_Market_Data.csv'): void {
	const blob = new Blob([csvData], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.download = filename;
	link.href = url;
	link.style.display = 'none';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
