/**
 * @module gameStore
 * Svelte 5 rune-based game state. Updated exclusively by websocket.ts via the incremental merge protocol.
 */

import type { GameState } from '$lib/types/game.js';
import { connection } from './connectionStore.svelte.js';

/** Reset target used by softDisconnect/disconnect. Any new GameState fields need defaults added here. */
export const DEFAULT_GAME_STATE: GameState = {
	state: 'uninitialized',
	visibility: 'public',
	players: {},
	gens: {},
	periods: [],
	period: 0,
	nplayers: 0,
	auto_advance: false,
	advance_time: 0,
	last_advance_time: 0
};

class GameStore {
	state = $state<GameState>({ ...DEFAULT_GAME_STATE });

	/** Server-authoritative player count. May differ from `Object.keys(players).length` during reconnection. */
	playerCount = $derived(this.state.nplayers);

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
			case 'full':
				return 'The market is full. Waiting for the game to begin.';
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
		this.state = { ...DEFAULT_GAME_STATE };
	}
}

export const game = new GameStore();
