/**
 * @module gameEngine
 * Pure game state mutations and computations. All functions take `GameState`
 * as a mutable parameter — no DO/storage/WebSocket dependencies.
 *
 * MarketRoom delegates here for state logic and handles DO side effects itself.
 */

import { computeMeritOrder, dispatchGenerators, calculateFinancials } from './clearing';
import { LOAD_PROFILES, GEN_PRESETS, DEFAULT_GAME_OPTIONS, sanitizeOptions, clamp } from './constants';
import type { GameOptions, GameState, Period } from './types';
import { defaultGameState } from './types';

export type JoinResult = 'ok' | 'kicked' | 'not_forming' | 'invalid_name' | 'name_taken';

function isValidName(name: string): boolean {
	const trimmed = name.trim();
	return trimmed.length >= 1 && trimmed.length <= 20 && /^[a-zA-Z0-9 _-]+$/.test(trimmed);
}

export function joinGame(game: GameState, kickedPlayers: Set<string>, name: string, uin: string = ''): JoinResult {
	if (kickedPlayers.has(name)) return 'kicked';
	if (game.state !== 'forming') return 'not_forming';
	if (!isValidName(name)) return 'invalid_name';
	if (game.players[name]) return 'name_taken';

	game.players[name] = { id: name, uin, money: 0, ngens: 0, last_offer_time: 0 };
	game.nplayers = Object.keys(game.players).length;

	if (game.options && game.nplayers >= game.options.max_participants) {
		game.state = 'full';
	}
	return 'ok';
}

export function updateOptions(game: GameState, options: Partial<GameOptions>): boolean {
	if (game.state !== 'forming' && game.state !== 'full') return false;
	if (!game.options) return false;

	Object.assign(game.options, sanitizeOptions(options));

	if (game.nplayers >= game.options.max_participants) {
		game.state = 'full';
	} else if (game.state === 'full') {
		game.state = 'forming';
	}
	return true;
}

export function setVisibility(game: GameState, visibility: string): boolean {
	if (visibility !== 'public' && visibility !== 'unlisted') return false;
	game.visibility = visibility;
	return true;
}

export function submitOffers(game: GameState, playerName: string, offers: Record<string, number>): boolean {
	if (game.state !== 'running') return false;
	const maxOffer = game.options?.max_offer_price ?? 200;

	for (const [genId, offerValue] of Object.entries(offers)) {
		const gen = game.gens[genId];
		if (gen && gen.owner === playerName) {
			gen.offer = (typeof offerValue === 'number' && isFinite(offerValue))
				? clamp(offerValue, 0, maxOffer)
				: gen.offer;
		}
	}

	if (game.players[playerName]) {
		game.players[playerName].last_offer_time = Date.now();
	}
	return true;
}

export function rewardPlayer(game: GameState, playerId: string, amount: number): boolean {
	if (game.state !== 'running' && game.state !== 'completed') return false;
	if (!game.players[playerId]) return false;
	if (typeof amount !== 'number' || !isFinite(amount)) return false;
	game.players[playerId].money += clamp(amount, -999999, 999999);
	return true;
}

/**
 * Remove a player from the game and add to kicked set. Returns true if removed.
 * Caller is responsible for closing the player's WebSocket (DO-specific side effect).
 */
export function kickPlayer(game: GameState, kickedPlayers: Set<string>, playerId: string): boolean {
	if (game.state !== 'forming' && game.state !== 'full') return false;
	if (!game.players[playerId]) return false;

	delete game.players[playerId];
	game.nplayers = Object.keys(game.players).length;
	kickedPlayers.add(playerId);

	if (game.state === 'full' && game.options && game.nplayers < game.options.max_participants) {
		game.state = 'forming';
	}
	return true;
}

// --- Generator Distribution ---

/**
 * Assign generators from the selected preset to every player.
 * Gen IDs are sequential across all players: player 1 gets Gen 1..N, player 2 gets Gen N+1..2N, etc.
 */
function distributeGenerators(game: GameState): void {
	game.gens = {};
	const templates = GEN_PRESETS[game.options?.gen_preset ?? 'standard'] ?? GEN_PRESETS.standard;
	let geni = 1;
	for (const key of Object.keys(game.players)) {
		const player = game.players[key];
		player.ngens = 0;
		for (const tmpl of templates) {
			const id = `Gen ${geni}`;
			game.gens[id] = { id, owner: key, capacity: tmpl.capacity, cost: tmpl.cost, offer: tmpl.cost };
			player.ngens += 1;
			geni += 1;
		}
	}
}

// --- Load Computation ---

/**
 * Compute demand for a period. Formula: `nplayers * 100 MW * profile[(period-1) % 24]`.
 * @param applyJitter - false for deterministic preview (display), true for actual clearing (random ± load_jitter%).
 */
function computeLoad(game: GameState, periodNumber: number, applyJitter = false): number {
	const profile = LOAD_PROFILES[game.options?.load_profile ?? 'realistic'] ?? LOAD_PROFILES.realistic;
	const base = game.nplayers * 100 * profile[(periodNumber - 1) % 24];
	if (!applyJitter) return Math.floor(base);
	const jitter = game.options?.load_jitter ?? 0;
	if (jitter <= 0) return Math.floor(base);
	const factor = 1 + (Math.random() * 2 - 1) * (jitter / 100);
	return Math.max(1, Math.floor(base * factor));
}

export function getCurrentLoad(game: GameState): number | null {
	if (game.state !== 'running' && game.state !== 'completed') return null;
	if (!game.options || game.period < 1 || game.period > game.options.num_periods) return null;
	return computeLoad(game, game.period);
}

export function getNextLoad(game: GameState): number | null {
	if (game.state !== 'running' || !game.options) return null;
	const nextPeriod = game.period + 1;
	if (nextPeriod > game.options.num_periods) return null;
	return computeLoad(game, nextPeriod);
}

// --- Market Clearing ---

/**
 * Clear the market for the current period. Returns the settled Period result.
 * Caller is responsible for persisting the period to storage.
 * Returns null if period is 0 or options are missing (no-op).
 */
function clearPeriod(game: GameState): Period | null {
	if (game.period === 0 || !game.options) return null;

	const period: Period = {
		number: game.period,
		load: computeLoad(game, game.period, true),
		marginal_cost: null,
		players: {},
		gens: {}
	};

	const meritOrder = computeMeritOrder(game.gens);
	period.marginal_cost = dispatchGenerators(meritOrder, period);

	// Scarcity pricing: when demand exceeds total supply and scarcity_price is set
	const scarcityPrice = game.options.scarcity_price ?? 0;
	if (scarcityPrice > 0) {
		const totalSupply = Object.values(game.gens).reduce((s, g) => s + g.capacity, 0);
		if (period.load > totalSupply) {
			period.marginal_cost = scarcityPrice;
		}
	}

	calculateFinancials(meritOrder, period, game.players, game.options.payment_method);
	return period;
}

// --- Game Lifecycle ---

/** Reset game fields for a new game. */
export function initializeNewGame(game: GameState, options: GameOptions): void {
	game.gens = {};
	game.periods = [];
	game.period = 0;
	game.auto_advance = false;
	game.advance_time = 0;
	game.last_advance_time = 0;
	game.options = { ...DEFAULT_GAME_OPTIONS, ...sanitizeOptions(options) };
	game.state = 'forming';
	game.players = {};
	game.nplayers = 0;
}

/**
 * Transition forming/full → running. Applies starting_money, distributes generators.
 * Returns false if preconditions aren't met.
 * Caller must call advancePeriod() after this to start period 1.
 */
export function startGame(game: GameState): boolean {
	if (game.state !== 'forming' && game.state !== 'full') return false;
	if (game.nplayers === 0) return false;

	game.state = 'running';
	game.period = 0;
	game.periods = [];
	game.auto_advance = true;

	const startingMoney = game.options?.starting_money ?? 0;
	for (const player of Object.values(game.players)) {
		player.money = startingMoney;
	}
	distributeGenerators(game);
	return true;
}

export interface AdvanceResult {
	/** Whether the game completed (period exceeded num_periods). */
	completed: boolean;
	/** The cleared period, if any (null for period 0 → 1 transition). */
	period: Period | null;
	/** Alarm time to set for auto-advance (only when not completed and auto_advance enabled). */
	alarmTime: number | null;
}

/**
 * Clear the current period and advance to the next.
 * Returns a result describing what happened so the caller can handle DO side effects.
 */
export function advancePeriod(game: GameState): AdvanceResult | null {
	if (game.state !== 'running' || !game.options) return null;

	const period = clearPeriod(game);
	game.period += 1;

	if (game.period > game.options.num_periods) {
		game.state = 'completed';
		return { completed: true, period, alarmTime: null };
	}

	game.last_advance_time = Date.now();
	game.advance_time = Date.now() + game.options.auto_advance_time * 1000;

	return {
		completed: false,
		period,
		alarmTime: game.auto_advance ? game.advance_time : null
	};
}

export interface AutoAdvanceResult {
	alarmTime: number | null;
	deleteAlarm: boolean;
}

/** Toggle auto-advance. Returns alarm action for the caller. */
export function setAutoAdvance(game: GameState, enabled: boolean): AutoAdvanceResult | null {
	if (game.state !== 'running') return null;
	game.auto_advance = enabled;
	if (enabled && game.options) {
		const remaining = Math.max(5000, game.advance_time - Date.now());
		game.advance_time = Date.now() + remaining;
		return { alarmTime: game.advance_time, deleteAlarm: false };
	}
	return { alarmTime: null, deleteAlarm: true };
}

/** Reset to uninitialized. Returns new default state. */
export function resetGame(): GameState {
	return defaultGameState();
}
