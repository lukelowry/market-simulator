/**
 * @module websocket
 * WebSocket client with automatic reconnection and session persistence.
 * Manages the full connection lifecycle: connect → ping/pong heartbeat → exponential
 * backoff reconnect → terminal close handling.
 *
 * Session is persisted to `localStorage` so a page reload resumes the prior connection.
 * This is the sole writer to `connection` and `game` state — all state updates flow through here.
 */

import { game } from '$lib/stores/gameStore.svelte.js';
import { connection } from '$lib/stores/connectionStore.svelte.js';
import type { GameBroadcast, GameOptions, Visibility } from '$shared/game.js';
import {
	WS_CLOSE_REPLACED,
	WS_CLOSE_KICKED,
	WS_CLOSE_RESET,
	WS_CLOSE_DELETED
} from '$shared/constants.js';

export type ClientMessage =
	| { type: 'createGame'; payload: GameOptions }
	| { type: 'updateOptions'; payload: Partial<GameOptions> }
	| { type: 'startGame' }
	| { type: 'advancePeriod' }
	| { type: 'setAutoAdvance'; payload: { enabled: boolean } }
	| { type: 'setVisibility'; payload: { visibility: Visibility } }
	| { type: 'submitOffers'; payload: { offers: Record<string, number>; period: number } }
	| { type: 'resetGame' }
	| { type: 'kickPlayer'; payload: { playerId: string } }
	| { type: 'rewardPlayer'; payload: { playerId: string; amount: number } };

type ServerMessage =
	| { type: 'gameState'; payload: GameBroadcast }
	| { type: 'connectedClients'; payload: string[] }
	| { type: 'error'; payload: { message: string } };

/* ── Session persistence ─────────────────────────────────────────── */

const SESSION_KEY = 'msim_session';

/** Minimal data needed to reconstruct a connection. Admin sessions use `key`; participants use `token`. */
interface StoredSession {
	market: string;
	role: string;
	name: string;
	key?: string;
	token?: string;
}

function saveSession(s: StoredSession): void {
	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(s));
	} catch {
		/* quota / private browsing */
	}
}

export function loadSession(): StoredSession | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		/* no-op */
	}
}

/* ── WebSocket state ─────────────────────────────────────────────── */

const wsState = {
	ws: null as WebSocket | null,
	session: null as StoredSession | null,
	attempt: 0,
	awaitingPong: false,
	everConnected: false,
	timers: {
		reconnect: null as ReturnType<typeof setTimeout> | null,
		ping: null as ReturnType<typeof setInterval> | null,
		pong: null as ReturnType<typeof setTimeout> | null,
	}
};

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 5_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Application-defined close codes that signal the server rejected or forcibly closed the connection.
 * When received, the client does NOT attempt reconnection.
 */
const TERMINAL_CLOSE_MESSAGES: Record<number, string> = {
	[WS_CLOSE_KICKED]: 'You have been removed from this game.',
	[WS_CLOSE_REPLACED]: 'Connected from another tab.',
	[WS_CLOSE_RESET]: 'The game was reset by the instructor.',
	[WS_CLOSE_DELETED]: 'This market has been deleted by the instructor.'
};

/** Exponential backoff with ±20% jitter, capped at 30s. Prevents thundering herd on server recovery. */
function getReconnectDelay(): number {
	const base = Math.min(RECONNECT_BASE_MS * Math.pow(2, wsState.attempt), RECONNECT_MAX_MS);
	return Math.round(base * (0.8 + Math.random() * 0.4));
}

function clearTimers(): void {
	if (wsState.timers.reconnect) {
		clearTimeout(wsState.timers.reconnect);
		wsState.timers.reconnect = null;
	}
	if (wsState.timers.ping) {
		clearInterval(wsState.timers.ping);
		wsState.timers.ping = null;
	}
	if (wsState.timers.pong) {
		clearTimeout(wsState.timers.pong);
		wsState.timers.pong = null;
	}
	wsState.awaitingPong = false;
}

/** Detach all handlers and close the WebSocket cleanly. */
function closeWebSocket(): void {
	if (wsState.ws) {
		wsState.ws.onclose = null;
		wsState.ws.onerror = null;
		wsState.ws.onmessage = null;
		wsState.ws.onopen = null;
		wsState.ws.close();
		wsState.ws = null;
	}
}

function startPing(): void {
	if (wsState.timers.ping) clearInterval(wsState.timers.ping);
	wsState.timers.ping = setInterval(() => {
		if (wsState.ws && wsState.ws.readyState === WebSocket.OPEN) {
			wsState.awaitingPong = true;
			wsState.ws.send('ping');
			if (wsState.timers.pong) {
				clearTimeout(wsState.timers.pong);
				wsState.timers.pong = null;
			}
			wsState.timers.pong = setTimeout(() => {
				if (wsState.awaitingPong) {
					wsState.ws?.close();
				}
			}, PONG_TIMEOUT_MS);
		}
	}, PING_INTERVAL_MS);
}

function scheduleReconnect(): void {
	if (!wsState.session) return;
	const delay = getReconnectDelay();
	wsState.attempt++;
	wsState.timers.reconnect = setTimeout(() => {
		if (wsState.session) {
			connect(
				wsState.session.market,
				wsState.session.role,
				wsState.session.name,
				wsState.session.key,
				wsState.session.token
			);
		}
	}, delay);
}

/**
 * Open a WebSocket connection to a market room.
 * Detects reconnection (same market+role+name) to preserve backoff state vs fresh connection.
 */
export function connect(
	market: string,
	role: string,
	name: string,
	key?: string,
	token?: string
): void {
	const isReconnect =
		wsState.session !== null &&
		wsState.session.market === market &&
		wsState.session.role === role &&
		wsState.session.name === name;

	if (!isReconnect) {
		wsState.attempt = 0;
		connection.reconnecting = false;
		connection.disconnectedAt = null;
	}

	const session: StoredSession = { market, role, name, key, token };
	wsState.session = session;
	saveSession(session);
	clearTimers();
	closeWebSocket();
	connection.connectionError = null;

	const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const params = new URLSearchParams({ market, role, name });
	if (key) params.set('key', key);
	if (token) params.set('token', token);

	wsState.ws = new WebSocket(`${protocol}//${location.host}/api/ws?${params}`);

	wsState.ws.onopen = () => {
		wsState.everConnected = true;
		connection.connected = true;
		connection.reconnecting = false;
		connection.disconnectedAt = null;
		connection.connectionError = null;
		wsState.attempt = 0;
		startPing();
	};

	/**
	 * Three-branch merge strategy for gameState messages:
	 * 1. `_initial === true`: full state replacement
	 * 2. Non-running/completed state: full replacement
	 * 3. Running/completed incremental: upsert incoming periods by number into a Map
	 */
	wsState.ws.onmessage = (event) => {
		if (event.data === 'pong') {
			wsState.awaitingPong = false;
			if (wsState.timers.pong) {
				clearTimeout(wsState.timers.pong);
				wsState.timers.pong = null;
			}
			return;
		}

		try {
			const msg: ServerMessage = JSON.parse(event.data);
			if (msg.type === 'gameState') {
				const isInitial = msg.payload._initial;
				delete msg.payload._initial;

				if (isInitial) {
					game.state = msg.payload;
				} else if (msg.payload.state !== 'running' && msg.payload.state !== 'completed') {
					game.state = msg.payload;
				} else {
					const current = game.state;
					const incoming = msg.payload.periods ?? [];
					const periodMap = new Map(current.periods.map((p) => [p.number, p]));
					for (const p of incoming) {
						periodMap.set(p.number, p);
					}
					const merged = Array.from(periodMap.values()).sort((a, b) => a.number - b.number);
					game.state = {
						...msg.payload,
						periods: merged,
						connectedClients: msg.payload.connectedClients ?? current.connectedClients
					};
				}
			} else if (msg.type === 'connectedClients') {
				game.state = { ...game.state, connectedClients: msg.payload };
			} else if (msg.type === 'error') {
				// Route action-level rejections (e.g. stale offers) to transient error,
				// not the global connectionError which signals connection-level problems.
				connection.lastActionError = msg.payload.message;
			}
		} catch (err) {
			console.warn('Failed to parse WebSocket message:', err);
		}
	};

	wsState.ws.onclose = (event) => {
		connection.connected = false;
		clearTimers();

		const terminalMessage = TERMINAL_CLOSE_MESSAGES[event.code];
		if (terminalMessage) {
			wsState.session = null;
			connection.reconnecting = false;
			connection.connectionError = terminalMessage;
			clearSession();
			return;
		}

		if (wsState.session) {
			if (!wsState.everConnected && wsState.attempt >= 3) {
				wsState.session = null;
				connection.reconnecting = false;
				connection.connectionError = 'Could not connect to this market.';
				clearSession();
				return;
			}
			connection.reconnecting = true;
			connection.disconnectedAt = Date.now();
			scheduleReconnect();
		}
	};

	wsState.ws.onerror = () => {
		connection.connectionError = 'Connection error. Retrying...';
	};
}

/** Send a message to the server. Returns false if not connected (message is dropped and logged). */
export function send(message: ClientMessage): boolean {
	if (wsState.ws && wsState.ws.readyState === WebSocket.OPEN) {
		wsState.ws.send(JSON.stringify(message));
		return true;
	}
	console.warn('WebSocket message dropped (not connected):', message.type);
	return false;
}

/**
 * Close connection and reset state.
 * - `keepIdentity`: preserves role/name/token (used for market switching)
 * - `clearStoredSession`: removes localStorage session (used for logout)
 */
export function disconnect(opts: { keepIdentity?: boolean; clearStoredSession?: boolean } = {}): void {
	wsState.session = null;
	wsState.attempt = 0;
	wsState.everConnected = false;
	clearTimers();
	closeWebSocket();
	if (opts.keepIdentity) {
		connection.connected = false;
		connection.connectionError = null;
		connection.reconnecting = false;
		connection.disconnectedAt = null;
		connection.marketName = '';
	} else {
		connection.reset();
	}
	game.reset();
	if (opts.clearStoredSession) clearSession();
}
