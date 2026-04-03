/** Role-based state filtering. Admin sees everything; participants see only their own data. */

import type { GameState, Generator, Period, Player } from '$shared/game.js';
import { getCurrentLoad, getNextLoad } from '../game/engine';

/** Parameters for building a role-filtered state snapshot. */
interface VisibleStateParams {
	game: GameState;
	role: string;
	name: string;
	/** Non-null = initial connection (full history). Null = incremental broadcast. */
	allPeriods: Period[] | null;
	lastClearedPeriod: Period | null;
	connectedClients: string[];
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
	const {
		game,
		role,
		name,
		allPeriods,
		lastClearedPeriod,
		connectedClients
	} = params;
	const currentLoad = getCurrentLoad(game);
	const nextLoad = getNextLoad(game);
	const rawPeriods = allPeriods ?? (lastClearedPeriod ? [lastClearedPeriod] : []);
	const _initial = allPeriods !== null;

	if (role === 'admin') {
		return {
			...game,
			players: game.players,
			periods: rawPeriods,
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
		auto_advance: game.auto_advance,
		advance_time: game.advance_time,
		last_advance_time: game.last_advance_time,
		rank: getPlayerRank(name, game.players),
		nextLoad,
		players: filterPlayers(name, game.players),
		gens: filterGens(name, game.gens),
		periods: filterPeriodsForPlayer(name, rawPeriods, game.gens),
		_initial
	};
}


function getPlayerRank(name: string, players: Record<string, Player>): number {
	const sorted = Object.entries(players).sort(
		([nameA, a], [nameB, b]) => b.money - a.money || nameA.localeCompare(nameB)
	);
	const idx = sorted.findIndex(([key]) => key === name);
	return idx >= 0 ? idx + 1 : Object.keys(players).length;
}

function filterPlayers(
	name: string,
	players: Record<string, Player>
): Record<string, { money: number; last_offer_time: number }> {
	const result: Record<string, { money: number; last_offer_time: number }> = {};
	for (const [key, player] of Object.entries(players)) {
		result[key] =
			key === name
				? { money: player.money, last_offer_time: player.last_offer_time }
				: { money: 0, last_offer_time: 0 };
	}
	return result;
}

function filterGens(name: string, gens: Record<string, Generator>): Record<string, Generator> {
	const result: Record<string, Generator> = {};
	for (const [key, gen] of Object.entries(gens)) {
		if (gen.owner === name) result[key] = gen;
	}
	return result;
}

/** Filter periods to show only a single player's data and their own generators. */
function filterPeriodsForPlayer(
	name: string,
	periods: Period[],
	gens: Record<string, Generator>
): object[] {
	const emptyPlayer = { revenue: null, costs: null, profit: null, money: null };
	return periods.map((p) => ({
		number: p.number,
		load: p.load,
		marginal_cost: p.marginal_cost,
		players: { [name]: p.players[name] ?? emptyPlayer },
		gens: Object.fromEntries(
			Object.entries(p.gens ?? {}).filter(([gId]) => gens[gId]?.owner === name)
		)
	}));
}
