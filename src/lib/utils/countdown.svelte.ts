/**
 * @module countdown
 * Svelte 5 rune-based countdown timer factory for the auto-advance clock.
 * Uses `setInterval` polling (every 200ms) since this runs in a `.svelte.ts` module.
 *
 * Uses a snapshot-based local countdown to avoid clock skew between server and client.
 * Server sends absolute `advance_time` (epoch ms from its own clock). Instead of comparing
 * that directly against client's `Date.now()` on every tick (which drifts with clock skew),
 * we snapshot once when `advance_time` changes and count down using purely client-local time.
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

	/** Last `advance_time` value we've snapshotted — used to detect period advances and toggle changes. */
	let trackedAdvanceTime = 0;
	/** Client-local epoch ms when the countdown should reach zero. */
	let countdownEndClient = 0;

	function tick() {
		const totalMs = (game.state.options?.auto_advance_time ?? 30) * 1000;

		// Detect when server sends a new advance_time (period advance or auto-advance toggle)
		if (game.state.advance_time !== trackedAdvanceTime) {
			trackedAdvanceTime = game.state.advance_time;
			const serverRemaining = game.state.advance_time - Date.now();
			const clamped = Math.max(0, Math.min(serverRemaining, totalMs));

			// Fresh period: server says ~full duration remaining → start at exactly full
			if (clamped >= totalMs * 0.95) {
				countdownEndClient = Date.now() + totalMs;
			} else {
				// Mid-period reconnection or re-enabled auto-advance: use server estimate
				countdownEndClient = Date.now() + clamped;
			}
		}

		remainingMs = Math.max(0, countdownEndClient - Date.now());
	}

	function start() {
		stop();
		active = true;
		// Reset so the first tick() takes a fresh snapshot
		trackedAdvanceTime = 0;
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
			return active ? `${this.seconds}s` : '';
		},
		get active() {
			return active;
		},
		start,
		stop
	};
}
