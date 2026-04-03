export type Visibility = 'public' | 'unlisted';
export type GenPreset = 'standard' | 'simple' | 'competitive';
export type LoadProfile = 'realistic' | 'flat' | 'peak' | 'volatile';
export type PaymentMethod = 'last_accepted_offer' | 'pay_as_offered';

export interface GameOptions {
	max_participants: number;
	num_periods: number;
	/** Seconds, not milliseconds. */
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

export interface Generator {
	id: string;
	owner: string;
	capacity: number;
	/** True production cost in $/MWh. Immutable per-game. */
	cost: number;
	/** Current bid price in $/MWh. Set by player. Initialized to `cost`. */
	offer: number;
}

export interface Player {
	uin: string;
	money: number;
	last_offer_time: number;
}

export interface Period {
	number: number;
	load: number;
	marginal_cost: number | null;
	players: Record<string, {
		revenue: number | null;
		costs: number | null;
		profit: number | null;
		money: number | null;
	}>;
	/** Present in storage and CSV export; stripped before client broadcasts. */
	gens?: Record<string, {
		offer: number | null;
		mw: number | null;
	}>;
}

export interface MarketListItem {
	name: string;
	state: GameState['state'] | 'connecting';
	visibility: Visibility;
	playerCount: number;
	maxPlayers: number;
	updatedAt: number;
	isMember?: boolean;
}

export interface GameState {
	state: 'uninitialized' | 'forming' | 'running' | 'completed';
	visibility: Visibility;
	options?: GameOptions;
	players: Record<string, Player>;
	gens: Record<string, Generator>;
	periods: Period[];
	period: number;
	auto_advance: boolean;
	advance_time: number;
	last_advance_time: number;
}

/** Wire format for WS broadcasts — extends persisted state with runtime-only fields. */
export interface GameBroadcast extends GameState {
	connectedClients?: string[];
	rank?: number;
	currentLoad?: number | null;
	nextLoad?: number | null;
	_initial?: boolean;
}

export function createDefaultGameState(): GameState {
	return {
		state: 'uninitialized',
		visibility: 'public',
		players: {},
		gens: {},
		periods: [],
		period: 0,
		auto_advance: false,
		advance_time: 0,
		last_advance_time: 0
	};
}
