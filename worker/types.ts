/**
 * @module types
 * Server-internal game domain types. These mirror the frontend types in
 * src/lib/types/game.ts but include additional server-only fields
 * (Player.id, Player.uin, Player.ngens). Keep both in sync when modifying shared fields.
 *
 * @see src/lib/types/game.ts — frontend counterpart (source of truth for shared type unions)
 * @see worker/constants.ts — VALID_GEN_PRESETS, VALID_LOAD_PROFILES, VALID_PAYMENT_METHODS must match
 */

export type Visibility = 'public' | 'unlisted';

/** @see src/lib/types/game.ts GenPreset */
export type GenPreset = 'standard' | 'simple' | 'competitive';
/** @see src/lib/types/game.ts LoadProfile */
export type LoadProfile = 'realistic' | 'flat' | 'peak' | 'volatile';
/** @see src/lib/types/game.ts PaymentMethod */
export type PaymentMethod = 'last_accepted_offer' | 'pay_as_offered';

export interface GameOptions {
	max_participants: number;
	num_periods: number;
	/** Seconds between auto-advances (not milliseconds). */
	auto_advance_time: number;
	payment_method: PaymentMethod;
	max_offer_price: number;
	starting_money: number;
	gen_preset: GenPreset;
	load_profile: LoadProfile;
	scarcity_price: number;
	/** Random load variation as integer percentage (0–30). */
	load_jitter: number;
}

/** Server-internal Player — includes `id`, `uin`, `ngens` not sent to clients. */
export interface Player {
	id: string;
	/** University ID. Used server-side for identity verification on reconnect; never broadcast. */
	uin: string;
	/** Cumulative balance across all periods. */
	money: number;
	/** Number of generators assigned to this player. */
	ngens: number;
	/** Epoch ms when this player last submitted offers. */
	last_offer_time: number;
}

export interface Generator {
	id: string;
	/** Player name (key into `GameState.players`). */
	owner: string;
	capacity: number;
	/** True production cost in $/MWh. Immutable per-game. */
	cost: number;
	/** Current bid in $/MWh. Mutable — set by player. Initialized to `cost`. */
	offer: number;
}

export interface PeriodPlayer {
	revenue: number | null;
	costs: number | null;
	profit: number | null;
	/** Player's cumulative balance after this period settled. */
	money: number | null;
}

export interface PeriodGen {
	offer: number | null;
	/** MW dispatched (0 if not called). */
	mw: number | null;
}

export interface Period {
	number: number;
	/** Total demand in MW (after jitter). */
	load: number;
	/** Clearing price in $/MWh. Null before clearing. */
	marginal_cost: number | null;
	players: Record<string, PeriodPlayer>;
	/** Generator dispatch details. Stripped from broadcast via stripPeriodGens(); present in storage and CSV. */
	gens: Record<string, PeriodGen>;
}

/** Summary metadata pushed by MarketRoom to MarketRegistry on state changes. */
export interface MarketInfo {
	name: string;
	state: string;
	visibility: Visibility;
	playerCount: number;
	maxPlayers: number;
	/** Epoch ms of the last registry push from MarketRoom. */
	updatedAt: number;
}

export interface GameState {
	state: 'uninitialized' | 'forming' | 'full' | 'running' | 'completed';
	visibility: Visibility;
	options?: GameOptions;
	players: Record<string, Player>;
	gens: Record<string, Generator>;
	/** Always empty in worker memory. Periods stored per-key; loaded on demand. */
	periods: Period[];
	/** Current active period number. 0 = game not started. */
	period: number;
	nplayers: number;
	auto_advance: boolean;
	/** Epoch ms deadline when the current period auto-advances. */
	advance_time: number;
	/** Epoch ms when the current period began. */
	last_advance_time: number;
}

export function defaultGameState(): GameState {
	return {
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
}
