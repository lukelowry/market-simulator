/**
 * @module game
 * Core domain types shared by the SvelteKit frontend and Cloudflare Worker backend.
 * The worker re-declares some of these locally to avoid cross-bundle imports; keep both in sync.
 *
 * @see worker/types.ts — server-side counterpart with additional fields (Player.id, Player.uin, Player.ngens)
 * @see worker/constants.ts — VALID_GEN_PRESETS, VALID_LOAD_PROFILES, VALID_PAYMENT_METHODS must match the unions here
 */

export type Visibility = 'public' | 'unlisted';

/** Determines the generator portfolio assigned to each player. All presets total 100 MW/player. */
export type GenPreset = 'standard' | 'simple' | 'competitive';

/** Demand curve shape applied over a 24-period cycle. */
export type LoadProfile = 'realistic' | 'flat' | 'peak' | 'volatile';

/**
 * Market settlement mechanism.
 * - `last_accepted_offer` (uniform/SMP): all dispatched gens paid the clearing price.
 * - `pay_as_offered` (discriminatory): each gen paid its own offer price.
 */
export type PaymentMethod = 'last_accepted_offer' | 'pay_as_offered';

export interface GameOptions {
	/** Max players allowed to join (2–99). */
	max_participants: number;
	/** Total periods in the game (2–99). */
	num_periods: number;
	/** Seconds between auto-advances. Note: seconds, not milliseconds (2–9999). */
	auto_advance_time: number;
	payment_method: PaymentMethod;
	/** Ceiling for player offer prices in $/MWh (1–9999). */
	max_offer_price: number;
	/** Initial balance given to each player when the game starts (0–999999). */
	starting_money: number;
	gen_preset: GenPreset;
	load_profile: LoadProfile;
	/** Price charged when demand exceeds total supply; 0 disables scarcity pricing (0–99999). */
	scarcity_price: number;
	/** Random load variation as an integer percentage, e.g. 10 means ±10% (0–30). */
	load_jitter: number;
}

export interface Player {
	/** Cumulative balance across all periods. Updated by profit/loss each period. */
	money: number;
	/** Epoch ms when this player last submitted offers. Compared to `last_advance_time` to detect stale submissions. */
	last_offer_time: number;
}

export interface Generator {
	id: string;
	/** Player name (key into `GameState.players`). */
	owner: string;
	/** Maximum output in MW. Immutable per-game. */
	capacity: number;
	/** True production cost in $/MWh. Immutable per-game. */
	cost: number;
	/** Current bid price in $/MWh. Mutable — set by player via submitOffers. Initialized to `cost`. */
	offer: number;
}

/** Per-period snapshot of a player's financials. All fields null for uncleared periods. */
export interface PeriodPlayer {
	revenue: number | null;
	costs: number | null;
	profit: number | null;
	/** Player's cumulative balance after this period settled. */
	money: number | null;
}

/** Per-period snapshot of a generator's dispatch result. All fields null for uncleared periods. */
export interface PeriodGen {
	/** The offer price this generator bid for the period. */
	offer: number | null;
	/** MW dispatched (0 if not called). */
	mw: number | null;
}

export interface Period {
	number: number;
	/** Total demand in MW for this period (after jitter). */
	load: number;
	/** Clearing price in $/MWh. Null before the period clears. */
	marginal_cost: number | null;
	players: Record<string, PeriodPlayer>;
	/** Generator dispatch details. Stripped from participant broadcasts; available to admins via CSV. */
	gens?: Record<string, PeriodGen>;
}

/**
 * Full game state as seen by a connected client.
 *
 * Lifecycle: `uninitialized` → `forming` → `full` → `running` → `completed`.
 * No back-transitions except via explicit reset (which returns to `uninitialized`).
 *
 * @remarks In the worker, `periods` is always empty in memory — periods are stored
 * individually under `'period:{N}'` keys and loaded on demand. On the frontend,
 * `periods` accumulates via incremental merge in websocket.ts.
 */
export interface GameState {
	state: 'uninitialized' | 'forming' | 'full' | 'running' | 'completed';
	visibility: Visibility;
	/** Undefined before game creation (state is `'uninitialized'`). Always guard access. */
	options?: GameOptions;
	players: Record<string, Player>;
	gens: Record<string, Generator>;
	periods: Period[];
	/** Current active period number. 0 means game has not started yet. */
	period: number;
	/** Server-authoritative player count. May differ from `Object.keys(players).length` during reconnection. */
	nplayers: number;
	auto_advance: boolean;
	/** Epoch ms deadline when the current period auto-advances. @see last_advance_time */
	advance_time: number;
	/** Epoch ms when the current period began. Used with `Player.last_offer_time` to detect stale offers. */
	last_advance_time: number;
	/** Connected participant names. Admin-only; omitted for participant clients. */
	connectedClients?: string[];
	/** Player's leaderboard position by money. Participant-only; omitted for admin clients. */
	rank?: number;
	/** Next period's expected load in MW (deterministic, no jitter). */
	nextLoad?: number | null;
	/** Current period's expected load in MW (deterministic, no jitter). Admin-only. */
	currentLoad?: number | null;
	/** True on initial connection (full period history); false/undefined on incremental broadcasts. @see websocket.ts merge logic */
	_initial?: boolean;
}
