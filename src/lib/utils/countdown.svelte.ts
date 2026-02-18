/**
 * @module countdown
 * Svelte 5 rune-based countdown timer factory for the auto-advance clock.
 * Uses `setInterval` polling (every 200ms) since this runs in a `.svelte.ts` module.
 */

import { game } from '$lib/stores/gameStore.svelte.js';

/**
 * Creates a countdown instance that tracks the time remaining until the next auto-advance.
 * The consuming component must call `start()` on mount and `stop()` on destroy (typically in a `$effect`).
 */
export function createCountdown() {
	let remainingMs = $state(0);
	let active = $state(false);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function tick() {
		remainingMs = Math.max(0, game.state.advance_time - Date.now());
	}

	function start() {
		stop();
		active = true;
		tick();
		intervalId = setInterval(tick, 200);
	}

	function stop() {
		active = false;
		remainingMs = 0;
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	return {
		get seconds() {
			return Math.ceil(remainingMs / 1000);
		},
		/** Fraction of auto_advance_time remaining (0–100). */
		get percent() {
			if (!game.state.options) return 100;
			const totalMs = game.state.options.auto_advance_time * 1000;
			return totalMs > 0 ? (remainingMs / totalMs) * 100 : 100;
		},
		get text() {
			return active ? `${this.seconds}s` : 'paused';
		},
		get active() {
			return active;
		},
		start,
		stop
	};
}
