/**
 * @module disconnectTimer
 * Disconnect UI escalation timer. Distinguishes brief network blips (<3s) from
 * sustained disconnections that warrant a full-screen overlay.
 * Uses `setInterval` polling since this runs in a `.svelte.ts` module.
 */

import { connection } from '$lib/stores/connectionStore.svelte.js';

/** 3s: long enough to avoid false positives on mobile network handoffs, short enough to be useful. */
const DISCONNECT_THRESHOLD_MS = 3000;
const CHECK_INTERVAL_MS = 500;

/**
 * Creates a disconnect timer that sets `tooLong = true` when the WS has been
 * disconnected and reconnecting for longer than {@link DISCONNECT_THRESHOLD_MS}.
 *
 * MUST be called during component initialization (synchronously inside a `<script>` block)
 * so the internal `$effect` has a valid reactive context for cleanup on destroy.
 */
export function createDisconnectTimer() {
	let tooLong = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	function cleanup() {
		if (timer) { clearInterval(timer); timer = null; }
	}

	$effect(() => {
		cleanup();

		timer = setInterval(() => {
			if (connection.reconnecting && connection.disconnectedAt && Date.now() - connection.disconnectedAt > DISCONNECT_THRESHOLD_MS) {
				tooLong = true;
			} else {
				tooLong = false;
			}
		}, CHECK_INTERVAL_MS);

		return cleanup;
	});

	return {
		get tooLong() { return tooLong; }
	};
}
