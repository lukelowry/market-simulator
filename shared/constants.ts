import type { GameOptions, GenPreset, LoadProfile } from './game.js';

/** Hourly demand multipliers for a 24-period cycle (index = (period-1) % 24). */
export const LOAD_PROFILES: Record<LoadProfile, number[]> = {
	realistic: [
		0.522441691, 0.472495937, 0.44734451, 0.43918225, 0.524746677, 0.635641158, 0.732903576,
		0.789389988, 0.804715331, 0.76067869, 0.708948052, 0.616364574, 0.535339516, 0.488753845,
		0.485078364, 0.502676387, 0.58499257, 0.693471822, 0.789035563, 0.842958247, 0.850073775,
		0.804827558, 0.74614858, 0.645890024
	],
	flat: [
		0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65,
		0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65
	],
	peak: [
		0.35, 0.32, 0.3, 0.3, 0.35, 0.45, 0.7, 0.9, 0.95, 0.8, 0.6, 0.45, 0.4, 0.38, 0.38, 0.42,
		0.55, 0.75, 0.92, 0.95, 0.85, 0.65, 0.5, 0.4
	],
	volatile: [
		0.45, 0.3, 0.55, 0.35, 0.8, 0.4, 0.9, 0.5, 0.95, 0.35, 0.7, 0.45, 0.85, 0.3, 0.6, 0.9,
		0.4, 0.95, 0.5, 0.8, 0.35, 0.7, 0.55, 0.45
	]
};

/** Generator portfolio templates. All presets total 100 MW per player. */
export const GEN_PRESETS: Record<GenPreset, { capacity: number; cost: number }[]> = {
	standard: [
		{ capacity: 50, cost: 20 },
		{ capacity: 20, cost: 30 },
		{ capacity: 10, cost: 40 },
		{ capacity: 10, cost: 50 },
		{ capacity: 10, cost: 65 }
	],
	simple: [
		{ capacity: 50, cost: 20 },
		{ capacity: 30, cost: 35 },
		{ capacity: 20, cost: 55 }
	],
	competitive: [
		{ capacity: 30, cost: 15 },
		{ capacity: 20, cost: 25 },
		{ capacity: 15, cost: 30 },
		{ capacity: 10, cost: 40 },
		{ capacity: 10, cost: 50 },
		{ capacity: 10, cost: 60 },
		{ capacity: 5, cost: 75 }
	]
};

export const VALID_GEN_PRESETS = new Set<string>(Object.keys(GEN_PRESETS));
export const VALID_LOAD_PROFILES = new Set<string>(Object.keys(LOAD_PROFILES));
export const VALID_PAYMENT_METHODS = new Set<string>(['last_accepted_offer', 'pay_as_offered']);

export const WS_CLOSE_REPLACED = 4000;
export const WS_CLOSE_KICKED = 4001;
export const WS_CLOSE_RESET = 4002;
export const WS_CLOSE_DELETED = 4003;

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
	max_participants: 6,
	num_periods: 24,
	auto_advance_time: 180,
	payment_method: 'last_accepted_offer',
	max_offer_price: 200,
	starting_money: 0,
	gen_preset: 'standard',
	load_profile: 'realistic',
	scarcity_price: 0,
	load_jitter: 0
};
