# Master Codebase Improvement Report

**Generated:** 2026-02-18
**Process:** 13 agents across 4 waves (deep review → critic → synthesizer → consolidation)
**Scope:** ~6,500 lines, ~45 files across 4 groups

---

## Executive Summary

- **24 total findings** across 4 groups, consolidated to **20 distinct actionable items** after cross-group deduplication
- **3 real bugs** require immediate attention: unauthenticated storage write (security), missing `await` (data loss), infinite reconnect loop (UX)
- **1 CLAUDE.md violation**: `platform!.env` non-null assertion
- **1 accessibility defect**: ConfirmModal Escape key unreachable
- The single highest-value refactor is promoting `isRunningOrCompleted` to a shared `$derived` on `GameStore` — it is inlined under 3 different names across 6 files
- All findings are S or M effort — no architectural changes needed
- 4 do-not-touch zones identified (hibernation constructor, persistAndBroadcast, WS merge logic, alarm timing)

---

## Phase 1: No-Risk Cleanup (5 items)

Zero behavioral impact. Each can be committed independently.

### P1-1: Remove unused `query` import
- **File:** `src/routes/admin.remote.ts:6`
- **Change:** `import { command, query }` → `import { command }`

### P1-2: Unexport internal helpers in visibility.ts
- **File:** `worker/visibility.ts`
- **Change:** Remove `export` from `stripPeriodGens`, `getPlayerRank`, `filterPlayers`, `filterGens`, `filterPeriods` (5 functions only used by `getVisibleState`)

### P1-3: Unexport internal helpers in gameEngine.ts
- **File:** `worker/gameEngine.ts`
- **Change:** Remove `export` from `isValidName`, `distributeGenerators`, `computeLoad`, `clearPeriod` (4 functions only used internally)

### P1-4: Fix stale JSDoc
- **Files:** `worker/gameEngine.ts:188` and `worker/MarketRoom.ts:163`
- **Changes:**
  - `initializeNewGame` JSDoc: remove "Returns the sanitized options" (function is void)
  - `alarm()` JSDoc: change "24h" to "48h" (constant is `48 * 60 * 60 * 1000`)

### P1-5: Deduplicate Request construction in registry.ts
- **File:** `worker/registry.ts:31-34, 62-67`
- **Change:** Extract `doRegistryRemove()` helper used by both `pushToRegistry` and `removeFromRegistry`

---

## Phase 2: Bug Fixes and Correctness (8 items)

Each has a measurable failure mode or guideline violation.

### P2-1: SECURITY — marketName written to storage before auth validation
- **File:** `worker/MarketRoom.ts:339-345`
- **Bug:** `handleWebSocketUpgrade` persists `marketName` to DO storage before checking admin auth or participant token. Unauthenticated requests can permanently set the name on uninitialized DOs.
- **Fix:** Move the marketName write to after auth/token checks pass (just before `new WebSocketPair()` on line 382).

### P2-2: Missing `await` on `scheduleCleanupAlarm`
- **File:** `worker/MarketRoom.ts:181`
- **Bug:** Fire-and-forget async call. If DO hibernates before promise resolves, cleanup alarm is silently dropped.
- **Fix:** `await this.scheduleCleanupAlarm();`

### P2-3: softDisconnect infinite retry loop
- **File:** `src/lib/services/websocket.ts:261-273`
- **Bug:** `softDisconnect()` resets `hasConnectedOnce` but not `sessionEstablishedOnce`. After any successful connection, switching to an unreachable market retries forever.
- **Fix:** Add `sessionEstablishedOnce = false;` to `softDisconnect()`

### P2-4: platform!.env non-null assertion (CLAUDE.md violation)
- **File:** `src/lib/server/platform.ts:12`
- **Bug:** `platform!.env` crashes with cryptic TypeError in non-Cloudflare environments.
- **Fix:** Guard with `if (!platform?.env) throw new Error('Cloudflare platform bindings unavailable...');`

### P2-5: ConfirmModal Escape key unreachable
- **File:** `src/lib/components/shared/ConfirmModal.svelte:25`
- **Bug:** `onkeydown` on `tabindex="-1"` div, but no `focus()` on mount. Keyboard users can't dismiss with Escape.
- **Fix:** `bind:this={dialogEl}` + `onMount(() => dialogEl.focus())`

### P2-6: MarketList fetch errors silently swallowed
- **File:** `src/lib/components/MarketList.svelte:11-18`
- **Bug:** Catch block sets `loading = false` but no error state. Network failures display as "No Active Markets."
- **Fix:** Add `fetchError` state variable and distinct error UI.

### P2-7: PlayerView setTimeout not cleaned up
- **File:** `src/lib/components/PlayerView.svelte:38-40`
- **Bug:** Welcome banner timeout handle not captured; no cleanup returned from `onMount`.
- **Fix:** Capture handle, `return () => clearTimeout(timer)` from `onMount`.

### P2-8: WS_CLOSE_DELETED = 4003 missing from server constants
- **File:** `worker/constants.ts` (add) + `worker/MarketRoom.ts:219` (use constant)
- **Bug:** Server uses magic number `4003`; no named constant. Protocol contract gap with client.
- **Fix:** Add `export const WS_CLOSE_DELETED = 4003;` to constants.ts, import in MarketRoom.

---

## Phase 3: Infrastructure Consolidation (4 items)

Coordinated multi-file changes. Batch into a single PR.

### P3-1: Promote `isRunningOrCompleted` to GameStore (CROSS-GROUP)
- **Add to:** `src/lib/stores/gameStore.svelte.ts`
- **Remove from:** AdminDashboard:59, AnalyticsSidebar:4, PlayerDetailModal:13, PlayerView:59, Sidebar:8, PlayerCardGrid:6
- **Change:** `isActive = $derived(this.state.state === 'running' || this.state.state === 'completed');`
- All 6 sites become `game.isActive`

### P3-2: Create shared frontend constants for GEN_PRESETS
- **New file:** `src/lib/utils/gameConstants.ts`
- **Update:** `src/lib/components/PlayerView.svelte:72-75`
- **Change:** Replace hardcoded ternary with `GEN_COUNT_BY_PRESET[preset] ?? 5` lookup

### P3-3: Document nplayers/playerCount naming boundary
- **Files:** `worker/types.ts:105` and `worker/registry.ts:43`
- **Change:** Add JSDoc cross-references documenting the intentional rename at the serialization boundary. Full rename deferred (too much churn for no user-visible benefit).

### P3-4: Extract totalCapacity to marketCalcs.ts
- **Add to:** `src/lib/utils/marketCalcs.ts`
- **Update:** `src/lib/components/admin/GameControls.svelte:62`, `AnalyticsSidebar.svelte:8`
- **Change:** `getTotalCapacity(gens)` shared utility

---

## Phase 4: Component Improvements (5 items)

Non-breaking quality improvements.

### P4-1: Hoist `getMarketVisibility()` with `{@const}` in MarketSidebar
- **File:** `src/lib/components/admin/MarketSidebar.svelte:125,128,133`
- Called 3x per list item; use `{@const visibility = getMarketVisibility(market.name)}`

### P4-2: `let chart` → `$state` in MarketHistoryChart
- **File:** `src/lib/components/admin/MarketHistoryChart.svelte:27`
- Non-reactive `let` read inside `$effect`; should be `$state<Chart | null>(null)`

### P4-3: `$effect` → `onMount` for focus in GameConfigModal
- **File:** `src/lib/components/admin/GameConfigModal.svelte:74-77`
- One-time DOM action should use `onMount`, not `$effect`

### P4-4: Extract PAO/LAO label to utility
- **Files:** `src/lib/components/admin/GameControls.svelte:252,295`
- Add `paymentLabel()` to `src/lib/utils/stateLabels.ts`

### P4-5: KPI strip markup deduplication in GameControls
- **File:** `src/lib/components/admin/GameControls.svelte:236-297`
- Extract `{#snippet kpiStrip(finalMode)}` to eliminate 19 duplicated HTML lines

---

## Naming Canonicalization Table

| Current name | Canonical name | Files to update |
|---|---|---|
| `isRunningOrCompleted` (3 admin files) | `game.isActive` | gameStore + 6 components |
| `showGameData` (PlayerView) | `game.isActive` | PlayerView.svelte |
| `isActive` (Sidebar) | `game.isActive` | Sidebar.svelte |
| `nplayers` (GameState) | Keep as-is, add JSDoc | types.ts, registry.ts |
| `WS_CLOSE_DELETED` (client-only) | Add to worker/constants.ts | constants.ts, MarketRoom.ts |

---

## Do-Not-Touch Zones

### 1. MarketRoom constructor `blockConcurrencyWhile` (MarketRoom.ts:69-102)
Hibernation state restoration gate. Every in-memory field must be restored here with safe defaults. `periods = []` is intentional — periods stored per-key and loaded on demand.

### 2. `persistAndBroadcast` periods exclusion (MarketRoom.ts:628-666)
`const { periods: _periods, ...meta } = this.game;` is the storage split boundary. New large fields excluded the same way.

### 3. websocket.ts three-branch merge logic (websocket.ts:193-207)
Initial replacement, non-active full replacement, active incremental upsert. The `_initial` flag and period `Map` upsert are load-bearing.

### 4. MarketRoom alarm timing (MarketRoom.ts:168-196)
`cleanupAt - 1000` jitter guard is intentional. Dual-purpose alarm (auto-advance vs cleanup) distinguished by `cleanupAt` storage key.

---

## Full Finding Registry

| # | Title | Group | Phase |
|---|---|---|---|
| F-01 | marketName written before auth validation | G1#1 | P2-1 |
| F-02 | Missing await on scheduleCleanupAlarm | G1#2 | P2-2 |
| F-03 | Duplicated Request construction in registry.ts | G1#3 | P1-5 |
| F-04 | Unused function exports in gameEngine.ts | G1#4 | P1-3 |
| F-05 | Stale JSDoc (alarm 24h→48h, initializeNewGame) | G1#5 | P1-4 |
| F-06 | nplayers/playerCount naming inconsistency | G1#6 | P3-3 |
| F-07 | Internal helpers exported in visibility.ts | G1#7 | P1-2 |
| F-08 | isRunningOrCompleted duplicated 6x | G2#1+G3#3+G4#4 | P3-1 |
| F-09 | Inline PAO/LAO ternary | G2#2 | P4-4 |
| F-10 | getMarketVisibility() called 3x per item | G2#3 | P4-1 |
| F-11 | KPI strip markup duplicated | G2#4 | P4-5 |
| F-12 | let chart should be $state | G2#5 | P4-2 |
| F-13 | $effect for focus should be onMount | G2#6 | P4-3 |
| F-14 | totalCapacity reduce duplicated | G2#7 | P3-4 |
| F-15 | ConfirmModal Escape key unreachable | G3#1 | P2-5 |
| F-16 | MarketList fetch errors silently swallowed | G3#2 | P2-6 |
| F-17 | PlayerView setTimeout not cleaned up | G3#4 | P2-7 |
| F-18 | genCount hardcoded GEN_PRESETS | G3#5 | P3-2 |
| F-19 | platform!.env non-null assertion | G4#1 | P2-4 |
| F-20 | WS_CLOSE_DELETED absent from constants | G4#2 | P2-8 |
| F-21 | softDisconnect infinite retry loop | G4#3 | P2-3 |
| F-22 | Unused query import | G4#5 | P1-1 |
