# MarketRoom.ts Refactor Design — COMPLETED 2026-02-17

## Problem

MarketRoom.ts is ~1092 lines mixing types, constants, pure math, game logic, WS handling, REST endpoints, storage, and registry sync in one file. Hard to navigate, hard to trace logic, hard to reason about any one piece.

## Approach

Extract 4 focused modules from MarketRoom.ts. The class stays but becomes a thin orchestrator. Zero runtime behavior change — just import reorganization.

## New Files

### `worker/types.ts`
All interfaces and type aliases currently at lines 5-118:
- `GenPreset`, `LoadProfile`, `PaymentMethod`
- `GameOptions`, `Player`, `Generator`, `PeriodPlayer`, `PeriodGen`, `Period`, `GameState`
- `defaultGameState()` factory function

### `worker/constants.ts`
Static configuration currently at lines 120-150:
- `LOAD_PROFILES` — hourly demand multipliers
- `GEN_PRESETS` — generator portfolio templates
- `VALID_GEN_PRESETS`, `VALID_LOAD_PROFILES`, `VALID_PAYMENT_METHODS`
- `WS_CLOSE_REPLACED`, `WS_CLOSE_KICKED`, `WS_CLOSE_RESET`
- `clamp()` utility

### `worker/clearing.ts`
Stateless market clearing math currently at lines 153-224:
- `computeMeritOrder(gens)` — Fisher-Yates shuffle + merit order sort
- `dispatchGenerators(meritOrder, period)` — cheapest-first dispatch
- `calculateFinancials(meritOrder, period, players, paymentMethod)` — revenue/cost/profit settlement

### `worker/visibility.ts`
State filtering for client broadcasts currently at lines 887-998:
- `getVisibleState(params)` — build role-filtered state
- `stripPeriodGens(periods)` — remove gen details from broadcast
- `stripPlayerInternals(players)` — remove server-only fields (id, uin, ngens)
- `filterPlayers(name, players)` — zero out other players' data
- `filterGens(name, gens)` — own generators only
- `filterPeriods(name, periods)` — own period stats only
- `getPlayerRank(name, players)` — leaderboard position

All become pure exported functions taking explicit parameters.

## What Stays in MarketRoom.ts (~680 lines)

- Class fields and constructor (hibernation restore)
- `fetch()`, WS handlers, `alarm()`
- `handleRestRequest()` — REST endpoints
- `handleWebSocketUpgrade()` — join flow
- `handleMessage()` — dispatch switch
- All game logic handlers (handleCreateGame, handleStartGame, handleAdvancePeriod, etc.)
- `distributeGenerators()`, `computeLoad()` — stay as private methods
- `persistAndBroadcast()`, `updateRegistry()`

## Invariants

- No logic changes — extraction only
- No interface changes — same WS protocol, same REST API, same storage keys
- `computeLoad` stays in the class (reads `this.game` directly)
- All extracted functions are already stateless or become stateless via explicit params
- Build and type check must pass after each step

## Verification

1. `npm run check` — 0 errors, 0 warnings
2. `npm run build` — success
3. `npm run dev` + `npm run dev:worker` — manual smoke test (create game, join, run periods, complete)
