/**
 * @module connectionStore
 * Svelte 5 rune-based connection and session identity state.
 * All mutation flows through websocket.ts; components should treat these as read-only.
 */

/** True only when the WS `onopen` has fired and `onclose` has not. */
/** User-facing error message from terminal close codes or connection failures. */
/** Null until authenticated; `'admin'` or `'participant'` for the session duration. */
class ConnectionState {
	connected = $state(false);
	connectionError = $state<string | null>(null);
	role = $state<'admin' | 'participant' | null>(null);
	participantName = $state('');
	uin = $state('');
	marketName = $state('');
	playerToken = $state('');
	adminKey = $state('');
	logoutHandler = $state<(() => void) | null>(null);
	reconnecting = $state(false);
	disconnectedAt = $state<number | null>(null);

	/** Reset all fields to defaults. Used by disconnect/softDisconnect. */
	reset() {
		this.connected = false;
		this.connectionError = null;
		this.role = null;
		this.participantName = '';
		this.uin = '';
		this.marketName = '';
		this.playerToken = '';
		this.adminKey = '';
		this.logoutHandler = null;
		this.reconnecting = false;
		this.disconnectedAt = null;
	}
}

export const connection = new ConnectionState();
