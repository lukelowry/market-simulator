/**
 * @module gameStore
 * Svelte 5 rune-based game state. Updated exclusively by websocket.ts via the incremental merge protocol.
 */

import type { GameBroadcast } from '$shared/game.js';
import { createDefaultGameState } from '$shared/game.js';
import { connection } from './connectionStore.svelte.js';

class GameStore {
	state = $state<GameBroadcast>(createDefaultGameState());

	playerCount = $derived(Object.keys(this.state.players).length);

	/** True when game is running or completed — the two states with period/gen data to display. */
	isActive = $derived(this.state.state === 'running' || this.state.state === 'completed');

	/** Player's leaderboard rank (participant-only). Null when not running/completed or when admin. */
	playerRank = $derived(this.state.rank ?? null);

	/** Role-dependent status message. Returns empty string for `running` state (UI shows period progress instead). */
	statusMessage = $derived.by(() => {
		switch (this.state.state) {
			case 'uninitialized':
				return 'Welcome to the Market Simulator! Login to Begin.';
			case 'forming':
				return connection.role === 'admin'
					? 'A new market has been formed. Close the market when ready.'
					: 'Waiting for the instructor to start the game.';
			case 'running':
				return '';
			case 'completed':
				return `Market complete after ${this.state.options?.num_periods ?? 0} periods! See results below.`;
			default:
				return '';
		}
	});

	/** Reset to default state. */
	reset() {
		this.state = createDefaultGameState();
	}
}

export const game = new GameStore();
