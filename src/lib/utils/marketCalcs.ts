/**
 * @module marketCalcs
 * Derived market metrics computed from GameState. Kept separate from stores for use in non-Svelte contexts.
 */

import type { GameState, Generator } from '$lib/types/game.js';

/** Generator count per preset. Mirrors worker/constants.ts GEN_PRESETS (can't import across bundle boundary). */
export const GEN_COUNT_BY_PRESET: Record<string, number> = {
	simple: 3,
	standard: 5,
	competitive: 7
};

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
