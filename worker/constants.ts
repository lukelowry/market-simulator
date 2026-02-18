/**
 * @module constants
 * Static game configuration: load profiles, generator presets, validation sets,
 * WebSocket close codes, and shared utility functions.
 */

import type { GameOptions, GenPreset, LoadProfile } from './types';

/**
 * Hourly demand multipliers for a 24-period cycle. Values are fractions of `nplayers * 100 MW`.
 * Index is `(periodNumber - 1) % 24`, so games >24 periods repeat the same daily pattern.
 */
export const LOAD_PROFILES: Record<LoadProfile, number[]> = {
	realistic: [
		0.522441691, 0.472495937, 0.44734451, 0.43918225,
		0.524746677, 0.635641158, 0.732903576, 0.789389988,
		0.804715331, 0.76067869, 0.708948052, 0.616364574,
		0.535339516, 0.488753845, 0.485078364, 0.502676387,
		0.58499257, 0.693471822, 0.789035563, 0.842958247,
		0.850073775, 0.804827558, 0.74614858, 0.645890024
	],
	flat: [
		0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65,
		0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65,
		0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65
	],
	peak: [
		0.35, 0.32, 0.30, 0.30, 0.35, 0.45, 0.70, 0.90,
		0.95, 0.80, 0.60, 0.45, 0.40, 0.38, 0.38, 0.42,
		0.55, 0.75, 0.92, 0.95, 0.85, 0.65, 0.50, 0.40
	],
	volatile: [
		0.45, 0.30, 0.55, 0.35, 0.80, 0.40, 0.90, 0.50,
		0.95, 0.35, 0.70, 0.45, 0.85, 0.30, 0.60, 0.90,
		0.40, 0.95, 0.50, 0.80, 0.35, 0.70, 0.55, 0.45
	]
};

/**
 * Generator portfolio templates. Each player receives ALL generators in the selected preset.
 * All presets total exactly 100 MW per player. Initial `offer` is set to `cost` (marginal cost pricing as default).
 */
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

/** Another tab connected with the same identity — last connection wins. */
export const WS_CLOSE_REPLACED = 4000;
/** Admin kicked this player — permanently banned for this game instance. */
export const WS_CLOSE_KICKED = 4001;
/** Game was reset or a new game was created — all participants dropped. */
export const WS_CLOSE_RESET = 4002;
/** Market was deleted by the instructor — DO storage wiped. */
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

/** Clamp and validate provided option fields. Only fields present in `raw` are returned. */
export function sanitizeOptions(raw: Partial<GameOptions>): Partial<GameOptions> {
	const result: Partial<GameOptions> = {};
	if (raw.max_participants != null) result.max_participants = clamp(raw.max_participants, 2, 99);
	if (raw.num_periods != null) result.num_periods = clamp(raw.num_periods, 2, 99);
	if (raw.auto_advance_time != null) result.auto_advance_time = clamp(raw.auto_advance_time, 2, 9999);
	if (raw.payment_method != null && VALID_PAYMENT_METHODS.has(raw.payment_method)) result.payment_method = raw.payment_method;
	if (raw.max_offer_price != null) result.max_offer_price = clamp(raw.max_offer_price, 1, 9999);
	if (raw.starting_money != null) result.starting_money = clamp(raw.starting_money, 0, 999999);
	if (raw.gen_preset != null && VALID_GEN_PRESETS.has(raw.gen_preset)) result.gen_preset = raw.gen_preset;
	if (raw.load_profile != null && VALID_LOAD_PROFILES.has(raw.load_profile)) result.load_profile = raw.load_profile;
	if (raw.scarcity_price != null) result.scarcity_price = clamp(raw.scarcity_price, 0, 99999);
	if (raw.load_jitter != null) result.load_jitter = clamp(raw.load_jitter, 0, 30);
	return result;
}
