/**
 * @module marketCalcs
 * Derived market metrics computed from GameState. Kept separate from stores for use in non-Svelte contexts.
 */

import type { GameState } from '$lib/types/game.js';

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
