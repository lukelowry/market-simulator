import {
	LOAD_PROFILES,
	GEN_PRESETS,
	VALID_GEN_PRESETS,
	VALID_LOAD_PROFILES,
	VALID_PAYMENT_METHODS,
	DEFAULT_GAME_OPTIONS,
	clamp
} from '$shared/constants.js';
import type { GameOptions, GameState, Generator, Period, Player } from '$shared/game.js';
import { createDefaultGameState } from '$shared/game.js';

/** Round to 2 decimal places. Eliminates floating-point drift in financial accumulation. */
function round2(x: number): number {
	return Math.round(x * 100) / 100;
}

const CLAMP_RULES: Record<string, [number, number]> = {
	max_participants: [2, 99],
	num_periods: [2, 99],
	auto_advance_time: [2, 9999],
	max_offer_price: [1, 9999],
	starting_money: [0, 999999],
	scarcity_price: [0, 99999],
	load_jitter: [0, 30]
};

const ENUM_RULES: Record<string, Set<string>> = {
	payment_method: VALID_PAYMENT_METHODS,
	gen_preset: VALID_GEN_PRESETS,
	load_profile: VALID_LOAD_PROFILES
};

/** Clamp and validate provided option fields. Only fields present in `raw` are returned. */
function sanitizeOptions(raw: Partial<GameOptions>): Partial<GameOptions> {
	const result: Partial<GameOptions> = {};
	for (const [key, [min, max]] of Object.entries(CLAMP_RULES)) {
		const v = (raw as any)[key];
		if (v != null) (result as any)[key] = clamp(v, min, max);
	}
	for (const [key, valid] of Object.entries(ENUM_RULES)) {
		const v = (raw as any)[key];
		if (v != null && valid.has(v)) (result as any)[key] = v;
	}
	return result;
}

export type JoinResult = 'ok' | 'not_forming' | 'invalid_name' | 'name_taken';

function isValidName(name: string): boolean {
	const trimmed = name.trim();
	return trimmed.length >= 1 && trimmed.length <= 20 && /^[a-zA-Z0-9 _-]+$/.test(trimmed);
}

export function joinGame(
	game: GameState,
	name: string,
	uin: string = ''
): JoinResult {
	if (game.state !== 'forming') return 'not_forming';
	if (!isValidName(name)) return 'invalid_name';
	if (game.players[name]) return 'name_taken';
	if (game.options && Object.keys(game.players).length >= game.options.max_participants) return 'not_forming';

	game.players[name] = { uin, money: 0, last_offer_time: 0 };
	return 'ok';
}

export function updateOptions(game: GameState, options: Partial<GameOptions>): boolean {
	if (game.state !== 'forming') return false;
	if (!game.options) return false;

	Object.assign(game.options, sanitizeOptions(options));
	return true;
}

export function setVisibility(game: GameState, visibility: string): boolean {
	if (visibility !== 'public' && visibility !== 'unlisted') return false;
	game.visibility = visibility;
	return true;
}

export function submitOffers(
	game: GameState,
	playerName: string,
	offers: Record<string, number>,
	forPeriod?: number
): boolean {
	if (game.state !== 'running') return false;
	// Reject stale offers from a previous period (debounce can race with auto-advance)
	if (forPeriod !== undefined && forPeriod !== game.period) return false;
	const maxOffer = game.options?.max_offer_price ?? 200;

	for (const [genId, offerValue] of Object.entries(offers)) {
		const gen = game.gens[genId];
		if (gen && gen.owner === playerName) {
			gen.offer =
				typeof offerValue === 'number' && isFinite(offerValue)
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
	game.players[playerId].money = round2(game.players[playerId].money + clamp(amount, -999999, 999999));
	return true;
}

/**
 * Remove a player from the game. Returns true if removed.
 * Caller is responsible for closing the player's WebSocket (DO-specific side effect).
 */
export function kickPlayer(game: GameState, playerId: string): boolean {
	if (game.state !== 'forming') return false;
	if (!game.players[playerId]) return false;

	delete game.players[playerId];
	return true;
}

// --- Generator Distribution ---

/**
 * Assign generators from the selected preset to every player.
 * Gen IDs are sequential across all players: player 1 gets Gen 1..N, player 2 gets Gen N+1..2N, etc.
 */
/** Caller must ensure game.options exists (startGame validates this). */
function distributeGenerators(game: GameState): void {
	game.gens = {};
	const templates = GEN_PRESETS[game.options!.gen_preset] ?? GEN_PRESETS.standard;
	let geni = 1;
	for (const key of Object.keys(game.players)) {
		for (const tmpl of templates) {
			const id = `Gen ${geni}`;
			game.gens[id] = {
				id,
				owner: key,
				capacity: tmpl.capacity,
				cost: tmpl.cost,
				offer: tmpl.cost
			};
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
	const profile =
		LOAD_PROFILES[game.options?.load_profile ?? 'realistic'] ?? LOAD_PROFILES.realistic;
	const base = Object.keys(game.players).length * 100 * profile[(periodNumber - 1) % 24];
	if (!applyJitter) return Math.floor(base);
	const jitter = game.options?.load_jitter ?? 0;
	if (jitter <= 0) return Math.floor(base);
	const factor = 1 + (Math.random() * 2 - 1) * (jitter / 100);
	return Math.max(1, Math.floor(base * factor));
}

export function getCurrentLoad(game: GameState): number | null {
	if (game.state !== 'running') return null;
	if (!game.options || game.period < 1 || game.period > game.options.num_periods) return null;
	return computeLoad(game, game.period);
}

export function getNextLoad(game: GameState): number | null {
	if (game.state !== 'running' || !game.options) return null;
	const nextPeriod = game.period + 1;
	if (nextPeriod > game.options.num_periods) return null;
	return computeLoad(game, nextPeriod);
}

// --- Market Clearing Math ---

/** Stateless market-clearing math: merit order, generator dispatch, financial settlement. */

/**
 * Fisher-Yates shuffle for fair tie-breaking, then sort by offer ascending (merit order / supply stack).
 * The shuffle is critical: without it, generators with identical offers would be ordered by
 * `Object.values()` insertion order, creating systematic bias toward earlier-joined players.
 */
function computeMeritOrder(gens: Record<string, Generator>): Generator[] {
	const list = Object.values(gens).slice();
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[list[i], list[j]] = [list[j], list[i]];
	}
	list.sort((a, b) => a.offer - b.offer);
	return list;
}

/**
 * Dispatch generators in merit order (cheapest first) to meet demand.
 * Each generator produces up to its capacity until load is fully served.
 * Returns marginalCost (clearing price) and unmetMw (demand shortfall, 0 when fully served).
 * The caller uses unmetMw to decide whether scarcity pricing applies.
 */
function dispatchGenerators(meritOrder: Generator[], period: Period): { marginalCost: number; unmetMw: number } {
	let marginalCost = 0;
	let loadLeft = period.load;

	for (const g of meritOrder) {
		period.gens![g.id] = { offer: g.offer, mw: 0 };
	}

	for (const g of meritOrder) {
		const mw = Math.min(g.capacity, loadLeft);
		period.gens![g.id].mw = mw;
		if (mw > 0) marginalCost = g.offer;
		loadLeft -= mw;
		if (loadLeft <= 0) break;
	}

	return { marginalCost, unmetMw: Math.max(0, loadLeft) };
}

/**
 * Calculate revenue, costs, and profit for each player based on dispatched MW.
 * Two payment methods model real electricity markets:
 * - `last_accepted_offer` (uniform/SMP): all dispatched generators paid the clearing price.
 *   Incentivizes strategic bidding above cost (classic uniform-price auction).
 * - `pay_as_offered` (discriminatory): each generator paid its own offer price.
 *   Theoretically no incentive to bid above cost.
 *
 * For both: `cost = gen.cost * mw` (true production cost), `profit = revenue - cost`.
 * Player's cumulative `money` is updated: `player.money += profit`.
 */
function calculateFinancials(
	meritOrder: Generator[],
	period: Period,
	players: Record<string, Player>,
	paymentMethod: string
): void {
	for (const key of Object.keys(players)) {
		period.players[key] = { revenue: 0, costs: 0, profit: 0, money: null };
	}

	for (const g of meritOrder) {
		const clearedMw = period.gens![g.id].mw!;
		const revenue = round2(
			paymentMethod === 'pay_as_offered' ? g.offer * clearedMw : period.marginal_cost! * clearedMw
		);
		const cost = round2(g.cost * clearedMw);
		const profit = round2(revenue - cost);

		if (players[g.owner]) {
			players[g.owner].money = round2(players[g.owner].money + profit);
			period.players[g.owner].revenue! = round2(period.players[g.owner].revenue! + revenue);
			period.players[g.owner].costs! = round2(period.players[g.owner].costs! + cost);
			period.players[g.owner].profit! = round2(period.players[g.owner].profit! + profit);
		}
	}

	for (const key of Object.keys(players)) {
		period.players[key].money = players[key].money;
	}
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
	const dispatch = dispatchGenerators(meritOrder, period);
	period.marginal_cost = dispatch.marginalCost;

	// Scarcity pricing: when actual demand goes unmet (not just capacity comparison)
	// and scarcity_price is configured. Uses real dispatch shortfall, not theoretical capacity.
	const scarcityPrice = game.options.scarcity_price ?? 0;
	if (scarcityPrice > 0 && dispatch.unmetMw > 0) {
		period.marginal_cost = scarcityPrice;
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
}

/**
 * Transition forming/full → running. Applies starting_money, distributes generators.
 * Returns false if preconditions aren't met.
 * Caller must call advancePeriod() after this to start period 1.
 */
export function startGame(game: GameState): boolean {
	if (game.state !== 'forming') return false;
	if (!game.options) return false;
	if (Object.keys(game.players).length === 0) return false;

	game.state = 'running';
	game.period = 0;
	game.periods = [];
	game.auto_advance = true;

	for (const player of Object.values(game.players)) {
		player.money = game.options.starting_money;
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
		game.period = game.options.num_periods; // cap at last period for display
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
		// Reset to full duration so the timer doesn't fire immediately after a long pause.
		// Without this, pausing for longer than the remaining time would leave only 5s on unpause.
		game.advance_time = Date.now() + game.options.auto_advance_time * 1000;
		return { alarmTime: game.advance_time, deleteAlarm: false };
	}
	return { alarmTime: null, deleteAlarm: true };
}

/** Reset to uninitialized. */
export function resetGame(): GameState {
	return createDefaultGameState();
}
