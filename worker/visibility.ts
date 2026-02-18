/**
 * @module visibility
 * State filtering for client broadcasts. All functions are pure — they take
 * explicit parameters and return filtered views of game state.
 *
 * Admin sees everything. Participants see only their own player/gen/period data.
 * Other players' money and offers are zeroed out to prevent information leakage.
 */

import type { GameState, Generator, Period, Player } from './types';

/** Parameters for building a role-filtered state snapshot. */
export interface VisibleStateParams {
	game: GameState;
	role: string;
	name: string;
	/** Non-null = initial connection (full history). Null = incremental broadcast. */
	allPeriods: Period[] | null;
	lastClearedPeriod: Period | null;
	connectedClients: string[];
	currentLoad: number | null;
	nextLoad: number | null;
}

/**
 * Build role-filtered state for a client.
 * - Admin: full visibility (all players, all gens, connected clients, currentLoad/nextLoad).
 * - Participant: own player gets real money/last_offer_time; others zeroed. Own gens only.
 *   Own period stats only (no other players' data, no gen details).
 *
 * The `_initial` flag drives the client's three-branch merge logic.
 * @see websocket.ts three-branch merge logic for how the client reconciles these.
 */
export function getVisibleState(params: VisibleStateParams): object {
	const { game, role, name, allPeriods, lastClearedPeriod, connectedClients, currentLoad, nextLoad } = params;
	const rawPeriods = allPeriods ?? (lastClearedPeriod ? [lastClearedPeriod] : []);
	const _initial = allPeriods !== null;

	if (role === 'admin') {
		return {
			...game,
			players: stripPlayerInternals(game.players),
			periods: stripPeriodGens(rawPeriods),
			connectedClients,
			currentLoad,
			nextLoad,
			_initial
		};
	}

	return {
		state: game.state,
		visibility: game.visibility,
		options: game.options,
		period: game.period,
		nplayers: game.nplayers,
		auto_advance: game.auto_advance,
		advance_time: game.advance_time,
		last_advance_time: game.last_advance_time,
		rank: getPlayerRank(name, game.players),
		nextLoad,
		players: filterPlayers(name, game.players),
		gens: filterGens(name, game.gens),
		periods: filterPeriods(name, rawPeriods),
		_initial
	};
}

/** Strip gens from period data to reduce broadcast size (only needed for CSV export). */
export function stripPeriodGens(periods: Period[]): object[] {
	return periods.map(({ gens, ...rest }) => rest);
}

/** Strip server-internal fields (id, uin, ngens) from player data before broadcast. */
export function stripPlayerInternals(players: Record<string, Player>): Record<string, object> {
	const result: Record<string, object> = {};
	for (const [key, player] of Object.entries(players)) {
		result[key] = { money: player.money, last_offer_time: player.last_offer_time };
	}
	return result;
}

export function getPlayerRank(name: string, players: Record<string, Player>): number {
	const sorted = Object.entries(players)
		.sort(([, a], [, b]) => b.money - a.money);
	const idx = sorted.findIndex(([key]) => key === name);
	return idx >= 0 ? idx + 1 : Object.keys(players).length;
}

export function filterPlayers(name: string, players: Record<string, Player>): Record<string, { money: number; last_offer_time: number }> {
	const result: Record<string, { money: number; last_offer_time: number }> = {};
	for (const [key, player] of Object.entries(players)) {
		result[key] = key === name
			? { money: player.money, last_offer_time: player.last_offer_time }
			: { money: 0, last_offer_time: 0 };
	}
	return result;
}

export function filterGens(name: string, gens: Record<string, Generator>): Record<string, Generator> {
	const result: Record<string, Generator> = {};
	for (const [key, gen] of Object.entries(gens)) {
		if (gen.owner === name) result[key] = gen;
	}
	return result;
}

export function filterPeriods(name: string, periods: Period[]): object[] {
	return periods.map((p) => ({
		number: p.number,
		load: p.load,
		marginal_cost: p.marginal_cost,
		players: { [name]: p.players[name] ?? { revenue: null, costs: null, profit: null, money: null } }
	}));
}
