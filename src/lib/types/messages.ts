/**
 * @module messages
 * WebSocket message protocol and REST API response shapes.
 */

import type { GameOptions, GameState, Visibility } from './game.js';

/**
 * Client → Server WebSocket messages.
 * Role enforcement is handled in MarketRoom.handleMessage — admin-only messages
 * are rejected if sent by a participant, and vice versa.
 */
export type ClientMessage =
	| { type: 'createGame'; payload: GameOptions }          // admin: initialize game, overwrites prior forming game
	| { type: 'updateOptions'; payload: Partial<GameOptions> } // admin: live-update options (forming/full only)
	| { type: 'startGame' }                                 // admin: transition forming/full → running
	| { type: 'advancePeriod' }                             // admin: manually trigger next period
	| { type: 'setAutoAdvance'; payload: { enabled: boolean } } // admin: toggle auto-advance timer
	| { type: 'setVisibility'; payload: { visibility: Visibility } } // admin: toggle public/unlisted
	| { type: 'submitOffers'; payload: { offers: Record<string, number> } } // participant: gen id → offer price
	| { type: 'resetGame' }                                 // admin: reset to uninitialized (blocked while running)
	| { type: 'kickPlayer'; payload: { playerId: string } } // admin: permanently ban player (forming/full only)
	| { type: 'rewardPlayer'; payload: { playerId: string; amount: number } }; // admin: adjust player balance (±999999)

/**
 * Server → Client WebSocket messages.
 * - `gameState`: full state on initial connect (`_initial=true`), incremental on broadcasts.
 *   @see websocket.ts three-branch merge logic for how the client reconciles these.
 * - `connectedClients`: sent only to admin sockets on player connect/disconnect.
 * - `error`: sent only to the requesting client, never broadcast.
 */
export type ServerMessage =
	| { type: 'gameState'; payload: GameState }
	| { type: 'connectedClients'; payload: string[] }
	| { type: 'error'; payload: { message: string } };

/**
 * Durable Object storage diagnostics returned by `/api/markets/info` and `/api/markets/bulk-info`.
 * @remarks `estimatedStorageBytes` is approximate — encodes game meta only, not individual period keys.
 * `connectedWebSockets` counts raw WS connections, not unique players (admin + participants).
 */
export interface MarketStorageInfo {
	/** Injected by the bulk-info endpoint; absent on single-market `/info` responses. */
	name?: string;
	/** Market name as stored by the Durable Object. Null if never set. */
	marketName: string | null;
	exists: boolean;
	state: string | null;
	playerCount: number;
	periodCount: number;
	currentPeriod: number;
	estimatedStorageBytes: number;
	hasAlarm: boolean;
	connectedWebSockets: number;
	error?: string;
}

/**
 * Market listing entry from `GET /api/markets`.
 * Populated by MarketRegistry; not authoritative for live game state.
 */
export interface MarketListItem {
	name: string;
	state: string;
	visibility: Visibility;
	playerCount: number;
	maxPlayers: number;
	/** Epoch ms of the last registry update — reflects when MarketRoom last pushed state, not last player activity. */
	updatedAt: number;
}
