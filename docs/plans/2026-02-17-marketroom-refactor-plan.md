# MarketRoom.ts Refactor Implementation Plan — COMPLETED 2026-02-17

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 4 focused modules from MarketRoom.ts to make the game engine readable and navigable without changing any runtime behavior.

**Architecture:** MarketRoom.ts currently mixes types, constants, pure math, game logic, WS handling, REST endpoints, storage, and visibility filtering in 1237 lines. We extract 4 modules bottom-up: types → constants → clearing → visibility. MarketRoom becomes a thin orchestrator importing from these. `computeLoad` stays in the class (reads `this.game`).

**Tech Stack:** TypeScript, Cloudflare Workers Durable Objects

---

## Task 1: Extract types into `worker/types.ts`

**Files:**
- Create: `worker/types.ts`
- Modify: `worker/MarketRoom.ts`

**Step 1: Create `worker/types.ts`**

Move all type aliases, interfaces, and `defaultGameState()` from MarketRoom.ts lines 30–207 into a new file. Export everything.

```typescript
// worker/types.ts
/**
 * @module types
 * Server-internal game domain types. These mirror the frontend types in
 * src/lib/types/game.ts but include additional server-only fields
 * (Player.id, Player.uin, Player.ngens). Keep both in sync when modifying shared fields.
 */

export type GenPreset = 'standard' | 'simple' | 'competitive';
export type LoadProfile = 'realistic' | 'flat' | 'peak' | 'volatile';
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
	gens: Record<string, PeriodGen>;
}

export interface GameState {
	state: 'uninitialized' | 'forming' | 'full' | 'running' | 'completed';
	visibility: 'public' | 'unlisted';
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
```

**Step 2: Update MarketRoom.ts imports**

Delete lines 30–207 from MarketRoom.ts (all type definitions and `defaultGameState`). Add an import at the top:

```typescript
import type { GenPreset, LoadProfile, PaymentMethod, GameOptions, Player, Generator, PeriodPlayer, PeriodGen, Period, GameState } from './types';
import { defaultGameState } from './types';
```

**Step 3: Verify**

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add worker/types.ts worker/MarketRoom.ts
git commit -m "refactor: extract types and defaultGameState into worker/types.ts"
```

---

## Task 2: Extract constants into `worker/constants.ts`

**Files:**
- Create: `worker/constants.ts`
- Modify: `worker/MarketRoom.ts`

**Step 1: Create `worker/constants.ts`**

Move LOAD_PROFILES, GEN_PRESETS, validation sets, WS close codes, and `clamp()` from MarketRoom.ts (what was originally lines 120–192, now the block immediately after the import). Export everything.

```typescript
// worker/constants.ts
/**
 * @module constants
 * Static game configuration: load profiles, generator presets, validation sets,
 * WebSocket close codes, and shared utility functions.
 */

import type { GenPreset, LoadProfile } from './types';

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

// Application-defined WebSocket close codes (no reconnect on client side)
/** Another tab connected with the same identity — last connection wins. */
export const WS_CLOSE_REPLACED = 4000;
/** Admin kicked this player — permanently banned for this game instance. */
export const WS_CLOSE_KICKED = 4001;
/** Game was reset or a new game was created — all participants dropped. */
export const WS_CLOSE_RESET = 4002;

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
```

**Step 2: Update MarketRoom.ts imports**

Delete the constants block from MarketRoom.ts (everything from the `LOAD_PROFILES` declaration through the `defaultGameState` function — now only the constants remain after Task 1 removed types). Add import:

```typescript
import { LOAD_PROFILES, GEN_PRESETS, VALID_GEN_PRESETS, VALID_LOAD_PROFILES, VALID_PAYMENT_METHODS, WS_CLOSE_REPLACED, WS_CLOSE_KICKED, WS_CLOSE_RESET, clamp } from './constants';
```

**Step 3: Verify**

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add worker/constants.ts worker/MarketRoom.ts
git commit -m "refactor: extract constants, presets, and clamp into worker/constants.ts"
```

---

## Task 3: Extract clearing logic into `worker/clearing.ts`

**Files:**
- Create: `worker/clearing.ts`
- Modify: `worker/MarketRoom.ts`

**Step 1: Create `worker/clearing.ts`**

Move `computeMeritOrder`, `dispatchGenerators`, and `calculateFinancials` from MarketRoom.ts. These are already module-level functions (not class methods), so extraction is direct.

```typescript
// worker/clearing.ts
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
```

**Step 2: Update MarketRoom.ts**

Delete `computeMeritOrder`, `dispatchGenerators`, and `calculateFinancials` from MarketRoom.ts (the `// --- Merit Order / Market Clearing Helpers ---` section). Add import:

```typescript
import { computeMeritOrder, dispatchGenerators, calculateFinancials } from './clearing';
```

**Step 3: Verify**

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add worker/clearing.ts worker/MarketRoom.ts
git commit -m "refactor: extract market clearing math into worker/clearing.ts"
```

---

## Task 4: Extract visibility filtering into `worker/visibility.ts`

**Files:**
- Create: `worker/visibility.ts`
- Modify: `worker/MarketRoom.ts`

This is the most complex extraction. The following private methods become pure exported functions with explicit parameters:
- `getVisibleState` → takes a params object instead of `this.*`
- `stripPeriodGens` → already pure
- `stripPlayerInternals` → already pure
- `filterPlayers` → takes `players` param
- `filterGens` → takes `gens` param
- `filterPeriods` → takes `periods` param
- `getPlayerRank` → takes `players` param

These methods stay in MarketRoom (they access `this.ctx` or `this.computeLoad`):
- `getConnectedClients` (needs `this.ctx.getWebSockets()`)
- `getCurrentLoad` (needs `this.game` + `this.computeLoad`)
- `getNextLoad` (needs `this.game` + `this.computeLoad`)

**Step 1: Create `worker/visibility.ts`**

```typescript
// worker/visibility.ts
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
		players: { [name]: p.players[name] || { revenue: null, costs: null, profit: null, money: null } }
	}));
}
```

**Step 2: Update MarketRoom.ts**

Add import:

```typescript
import { getVisibleState, stripPlayerInternals } from './visibility';
```

Delete these private methods from MarketRoom class:
- `getVisibleState` (the method, including JSDoc — lines ~1019–1062)
- `stripPeriodGens` (lines ~1064–1067)
- `stripPlayerInternals` — keep only the method but replace its body to call the imported function, OR delete it and update the one call site in `handleRestRequest`'s `/csv-data` endpoint (line ~523). **Decision: delete it, update the call site.**
- `getPlayerRank` (lines ~1089–1094)
- `filterPlayers` (lines ~1109–1117)
- `filterGens` (lines ~1119–1125)
- `filterPeriods` (lines ~1127–1134)

Keep in the class:
- `getConnectedClients` (needs `this.ctx`)
- `getCurrentLoad` (needs `this.computeLoad`)
- `getNextLoad` (needs `this.computeLoad`)

Update all call sites in MarketRoom:

**`handleWebSocketUpgrade`** (line ~608–611): Change:
```typescript
// Before:
server.send(JSON.stringify({
    type: 'gameState',
    payload: this.getVisibleState(role, name, periods)
}));
// After:
server.send(JSON.stringify({
    type: 'gameState',
    payload: getVisibleState({
        game: this.game, role, name,
        allPeriods: periods,
        lastClearedPeriod: this.lastClearedPeriod,
        connectedClients: this.getConnectedClients(),
        currentLoad: this.getCurrentLoad(),
        nextLoad: this.getNextLoad()
    })
}));
```

**`persistAndBroadcast`** (line ~1228–1231): Change:
```typescript
// Before:
ws.send(JSON.stringify({
    type: 'gameState',
    payload: this.getVisibleState(tags[0], tags[1])
}));
// After:
ws.send(JSON.stringify({
    type: 'gameState',
    payload: getVisibleState({
        game: this.game, role: tags[0], name: tags[1],
        allPeriods: null,
        lastClearedPeriod: this.lastClearedPeriod,
        connectedClients: this.getConnectedClients(),
        currentLoad: this.getCurrentLoad(),
        nextLoad: this.getNextLoad()
    })
}));
```

**`handleRestRequest` `/csv-data`** (line ~523): Change:
```typescript
// Before:
this.stripPlayerInternals(this.game.players)
// After (import already added):
stripPlayerInternals(this.game.players)
```

**Step 3: Verify**

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add worker/visibility.ts worker/MarketRoom.ts
git commit -m "refactor: extract visibility filtering into worker/visibility.ts"
```

---

## Task 5: Clean up and final verification

**Files:**
- Review: `worker/MarketRoom.ts`

**Step 1: Clean up stale section comments**

Remove the `// --- Server-internal types ---`, `// --- Merit Order / Market Clearing Helpers ---`, and `// --- Visibility Filtering ---` section comments if they are now empty or only contain the kept methods.

**Step 2: Final line count check**

MarketRoom.ts should be approximately 600–700 lines (down from 1237). Verify by counting.

**Step 3: Full verification**

Run: `npm run check`
Expected: 0 errors, 0 warnings

Run: `npm run build`
Expected: Success

**Step 4: Final commit**

```bash
git add worker/MarketRoom.ts
git commit -m "refactor: clean up MarketRoom.ts section comments after module extraction"
```

---

## Summary

| File | Before | After | Change |
|------|--------|-------|--------|
| `worker/MarketRoom.ts` | 1237 lines | ~650 lines | -587 lines |
| `worker/types.ts` | new | ~100 lines | +100 lines |
| `worker/constants.ts` | new | ~85 lines | +85 lines |
| `worker/clearing.ts` | new | ~90 lines | +90 lines |
| `worker/visibility.ts` | new | ~105 lines | +105 lines |
| **Net** | 1237 lines | ~1030 lines | -207 lines (shared JSDoc) |

Each new file has a single responsibility:
- **types.ts** — what the data looks like
- **constants.ts** — static configuration and validation
- **clearing.ts** — how market math works
- **visibility.ts** — what each role can see
- **MarketRoom.ts** — orchestration, lifecycle, WS/REST, storage
