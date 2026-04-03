/**
 * @module marketCalcs
 * Derived market metrics computed from GameState. Kept separate from stores for use in non-Svelte contexts.
 */

import type { GameBroadcast, GameState, Generator } from '$shared/game.js';
import { GEN_PRESETS } from '$shared/constants.js';

export const GEN_COUNT_BY_PRESET: Record<string, number> = Object.fromEntries(
	Object.entries(GEN_PRESETS).map(([k, v]) => [k, v.length])
);

/** Sum of all generator capacities. */
export function getTotalCapacity(gens: Record<string, Generator>): number {
	return Object.values(gens).reduce((s, g) => s + g.capacity, 0);
}

/**
 * Count how many players have submitted offers since the last period advance.
 * Compares each `player.last_offer_time` (epoch ms) against `game.last_advance_time` (epoch ms).
 */
export function getOffersSubmitted(game: GameState): { submitted: number; total: number } {
	let submitted = 0;
	const total = Object.keys(game.players).length;
	for (const player of Object.values(game.players)) {
		if (player.last_offer_time > game.last_advance_time) submitted++;
	}
	return { submitted, total };
}

/** True if the player has submitted offers since the last period advance. */
export function hasSubmitted(lastOfferTime: number, lastAdvanceTime: number): boolean {
	return lastOfferTime > lastAdvanceTime;
}

/** Aggregate market KPI stats derived from period history. */
export function getMarketStats(game: GameBroadcast) {
	const costs = game.periods
		.map((p) => p.marginal_cost)
		.filter((c): c is number => c !== null);
	return {
		currentMarginal: costs.length > 0 ? costs[costs.length - 1] : null,
		avgMarginal:
			costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : null,
		peakMarginal: costs.length > 0 ? Math.max(...costs) : null,
		totalCapacity: getTotalCapacity(game.gens),
		currentLoad: game.currentLoad ?? 0
	};
}
