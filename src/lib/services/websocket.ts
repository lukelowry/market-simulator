/**
 * @module websocket
 * WebSocket client with automatic reconnection and session persistence.
 * Manages the full connection lifecycle: connect → ping/pong heartbeat → exponential
 * backoff reconnect → terminal close handling.
 *
 * Session is persisted to `sessionStorage` so a page reload resumes the prior connection.
 * This is the sole writer to `connection` and `game` state — all state updates flow through here.
 */

import { game } from '$lib/stores/gameStore.svelte.js';
import { connection } from '$lib/stores/connectionStore.svelte.js';
import type { ClientMessage, ServerMessage } from '$lib/types/messages.js';

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
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
	} catch { /* quota / private browsing */ }
}

export function loadSession(): StoredSession | null {
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	try {
		sessionStorage.removeItem(SESSION_KEY);
	} catch { /* no-op */ }
}

/* ── WebSocket state ─────────────────────────────────────────────── */

let ws: WebSocket | null = null;
let reconnectParams: StoredSession | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let awaitingPong = false;
let hasConnectedOnce = false;
/** Tracks whether ANY successful connection was ever made in this browser session. Reset by softDisconnect (market switch = new connection context). */
let sessionEstablishedOnce = false;

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 5_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

const WS_CLOSE_REPLACED = 4000;
const WS_CLOSE_KICKED = 4001;
const WS_CLOSE_RESET = 4002;
const WS_CLOSE_DELETED = 4003;

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
	const base = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt), RECONNECT_MAX_MS);
	return Math.round(base * (0.8 + Math.random() * 0.4));
}

function clearTimers(): void {
	if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
	if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
	if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
	awaitingPong = false;
}

/** Detach all handlers and close the WebSocket cleanly. */
function closeWebSocket(): void {
	if (ws) {
		ws.onclose = null;
		ws.onerror = null;
		ws.onmessage = null;
		ws.onopen = null;
		ws.close();
		ws = null;
	}
}

function startPing(): void {
	if (pingInterval) clearInterval(pingInterval);
	pingInterval = setInterval(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			awaitingPong = true;
			ws.send('ping');
			if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
			pongTimeout = setTimeout(() => {
				if (awaitingPong) {
					ws?.close();
				}
			}, PONG_TIMEOUT_MS);
		}
	}, PING_INTERVAL_MS);
}

function scheduleReconnect(): void {
	if (!reconnectParams) return;
	const delay = getReconnectDelay();
	reconnectAttempt++;
	reconnectTimer = setTimeout(() => {
		if (reconnectParams) {
			connect(reconnectParams.market, reconnectParams.role, reconnectParams.name, reconnectParams.key, reconnectParams.token);
		}
	}, delay);
}

/**
 * Open a WebSocket connection to a market room.
 * Detects reconnection (same market+role+name) to preserve backoff state vs fresh connection.
 */
export function connect(market: string, role: string, name: string, key?: string, token?: string): void {
	const isReconnect = reconnectParams !== null
		&& reconnectParams.market === market
		&& reconnectParams.role === role
		&& reconnectParams.name === name;

	if (!isReconnect) {
		reconnectAttempt = 0;
		connection.reconnecting = false;
		connection.disconnectedAt = null;
	}

	const session: StoredSession = { market, role, name, key, token };
	reconnectParams = session;
	saveSession(session);
	clearTimers();
	closeWebSocket();

	const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const params = new URLSearchParams({ market, role, name });
	if (key) params.set('key', key);
	if (token) params.set('token', token);

	ws = new WebSocket(`${protocol}//${location.host}/api/ws?${params}`);

	ws.onopen = () => {
		hasConnectedOnce = true;
		sessionEstablishedOnce = true;
		connection.connected = true;
		connection.reconnecting = false;
		connection.disconnectedAt = null;
		connection.connectionError = null;
		reconnectAttempt = 0;
		startPing();
	};

	/**
	 * Three-branch merge strategy for gameState messages:
	 * 1. `_initial === true`: full state replacement
	 * 2. Non-running/completed state: full replacement
	 * 3. Running/completed incremental: upsert incoming periods by number into a Map
	 */
	ws.onmessage = (event) => {
		if (event.data === 'pong') {
			awaitingPong = false;
			if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
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
					const periodMap = new Map(current.periods.map(p => [p.number, p]));
					for (const p of incoming) {
						periodMap.set(p.number, p);
					}
					const merged = Array.from(periodMap.values()).sort((a, b) => a.number - b.number);
					game.state = { ...msg.payload, periods: merged, connectedClients: msg.payload.connectedClients ?? current.connectedClients };
				}
			} else if (msg.type === 'connectedClients') {
				game.state = { ...game.state, connectedClients: msg.payload };
			} else if (msg.type === 'error') {
				connection.connectionError = msg.payload.message;
			}
		} catch (err) {
			console.warn('Failed to parse WebSocket message:', err);
		}
	};

	ws.onclose = (event) => {
		connection.connected = false;
		clearTimers();

		const terminalMessage = TERMINAL_CLOSE_MESSAGES[event.code];
		if (terminalMessage) {
			reconnectParams = null;
			connection.reconnecting = false;
			connection.connectionError = terminalMessage;
			clearSession();
			return;
		}

		if (reconnectParams) {
			if (!sessionEstablishedOnce && !hasConnectedOnce && reconnectAttempt >= 3) {
				reconnectParams = null;
				connection.reconnecting = false;
				connection.connectionError = 'Session expired. Please sign in again.';
				clearSession();
				return;
			}
			connection.reconnecting = true;
			connection.disconnectedAt = Date.now();
			scheduleReconnect();
		}
	};

	ws.onerror = () => {
		connection.connectionError = 'Connection error. Retrying...';
	};
}

/** Send a message to the server. Returns false if not connected (message is dropped and logged). */
export function send(message: ClientMessage): boolean {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
		return true;
	}
	console.warn('WebSocket message dropped (not connected):', message.type);
	return false;
}

/** Close connection for market switching; preserves identity (role, name, token). */
export function softDisconnect(): void {
	reconnectParams = null;
	clearTimers();
	closeWebSocket();
	reconnectAttempt = 0;
	hasConnectedOnce = false;
	sessionEstablishedOnce = false;
	connection.reconnecting = false;
	connection.disconnectedAt = null;
	connection.connected = false;
	connection.connectionError = null;
	connection.marketName = '';
	game.reset();
}

/** Full teardown: clears all identity stores (role, name, token) and game state. Used on logout. */
export function disconnect(clearStoredSession = false): void {
	reconnectParams = null;
	clearTimers();
	closeWebSocket();
	reconnectAttempt = 0;
	hasConnectedOnce = false;
	connection.reset();
	game.reset();
	if (clearStoredSession) clearSession();
}
