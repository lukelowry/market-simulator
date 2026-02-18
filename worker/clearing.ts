/**
 * @module clearing
 * Stateless market-clearing math: merit order construction, generator dispatch,
 * and financial settlement. All functions are pure — no side effects, no storage access.
 */

import type { Generator, Period, Player } from './types';

/**
 * Fisher-Yates shuffle for fair tie-breaking, then sort by offer ascending (merit order / supply stack).
 * The shuffle is critical: without it, generators with identical offers would be ordered by
 * `Object.values()` insertion order, creating systematic bias toward earlier-joined players.
 */
export function computeMeritOrder(gens: Record<string, Generator>): Generator[] {
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
 * Returns the marginal cost (clearing price) — the offer of the last dispatched generator.
 *
 * @remarks When demand exceeds total capacity, `loadLeft > 0` after the loop and
 * `marginalCost` holds the highest offer. The caller applies scarcity_price override.
 */
export function dispatchGenerators(meritOrder: Generator[], period: Period): number {
	let marginalCost = 0;
	let loadLeft = period.load;

	for (const g of meritOrder) {
		period.gens[g.id] = { offer: g.offer, mw: 0 };
	}

	for (const g of meritOrder) {
		const mw = Math.min(g.capacity, loadLeft);
		period.gens[g.id].mw = mw;
		if (mw > 0) marginalCost = g.offer;
		loadLeft -= mw;
		if (loadLeft <= 0) break;
	}

	return marginalCost;
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
export function calculateFinancials(
	meritOrder: Generator[],
	period: Period,
	players: Record<string, Player>,
	paymentMethod: string
): void {
	for (const key of Object.keys(players)) {
		period.players[key] = { revenue: 0, costs: 0, profit: 0, money: null };
	}

	for (const g of meritOrder) {
		const clearedMw = period.gens[g.id].mw!;
		const revenue = paymentMethod === 'pay_as_offered'
			? g.offer * clearedMw
			: period.marginal_cost! * clearedMw;
		const cost = g.cost * clearedMw;
		const profit = revenue - cost;

		if (players[g.owner]) {
			players[g.owner].money += profit;
			period.players[g.owner].revenue! += revenue;
			period.players[g.owner].costs! += cost;
			period.players[g.owner].profit! += profit;
		}
	}

	for (const key of Object.keys(players)) {
		period.players[key].money = players[key].money;
	}
}
