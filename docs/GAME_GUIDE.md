# Game Guide

## Overview

The Power Market Simulator models a simplified electricity wholesale market. Each student acts as a power plant owner with a portfolio of generators. Every period, students set offer prices for their generators. The market then clears using **merit-order dispatch** — the cheapest generators are dispatched first to meet demand. Profits depend on which generators are dispatched and the selected **payment method**.

The goal: maximize your total money across all periods.

## Game Flow

1. **Admin creates a game** — configures payment method, generator preset, load profile, number of periods, and other settings.
2. **Players join** — students enter their name and UIN to join the market lobby.
3. **Admin starts the game** — generators are distributed and the first period begins.
4. **Each period:**
   - Students see the current demand (load in MW) and set offer prices for each of their generators.
   - When the period advances (manually or by auto-timer), the market clears.
   - Results show each generator's dispatch, revenue, costs, and profit.
5. **Game ends** after all periods are played. Final rankings are displayed.

> **Period timing note:** Market clearing for period N happens when the game advances *to* period N+1. The first advance (period 0 to 1) opens play but does not clear. Players submit offers during the current period; those offers are used when the period advances.

### Game States

| State | Description |
|-------|-------------|
| **Forming** | Lobby is open; players can join. |
| **Full** | Max players reached; no more can join (admin can still start). |
| **Running** | Periods are being played. |
| **Completed** | All periods finished; results are final. |

## Market Clearing (Merit Order Dispatch)

Each period, the system:

1. **Shuffles** all generators randomly (Fisher-Yates) for fair tie-breaking.
2. **Sorts** by offer price ascending — this is the **merit order** (cheapest first).
3. **Dispatches** generators in order, each producing up to its capacity, until total demand (load) is met.
4. The offer price of the **last dispatched generator** becomes the **marginal cost** (clearing price).

Generators with offers above the clearing price are not dispatched and earn nothing.

### Supply Shortage

If demand exceeds total supply (all generators at full capacity), all generators are dispatched and the clearing price equals the highest offer. Unserved demand is silently dropped.

If the admin has configured a **scarcity price** (> 0), the clearing price is overridden to that value during supply shortages, providing a stronger price signal.

## Payment Methods

The payment method determines how dispatched generators are compensated. This is the central strategic variable of the simulation.

### Last Accepted Offer (LAO) — Uniform Pricing

All dispatched generators are paid the **marginal cost** (the clearing price), regardless of their individual offer.

**Revenue per generator** = marginal cost x MW dispatched

This models real-world uniform-price auctions (used in most U.S. wholesale markets like ERCOT). Key strategic implications:

- Generators with low offers dispatched below the clearing price earn a **surplus** (revenue above their cost).
- There is incentive to offer near or above your cost, since the clearing price is set by the most expensive dispatched unit.
- Offering too high risks not being dispatched at all.

**Example:** Three generators are dispatched at offers of $20, $35, and $50. The clearing price is $50. All three are paid $50/MW.

### Pay As Offered (PAO) — Discriminatory Pricing

Each dispatched generator is paid its **own offer price**.

**Revenue per generator** = generator's offer x MW dispatched

This models pay-as-bid auctions. Key strategic implications:

- There is no surplus from the clearing price — you earn exactly what you offer.
- Offering at cost yields zero profit. Players must offer above cost to profit.
- Players must **guess** what the clearing price will be to set profitable offers without pricing themselves out.

**Example:** Three generators are dispatched at offers of $20, $35, and $50. Each is paid its own offer: $20/MW, $35/MW, and $50/MW respectively.

### Comparison

| Aspect | LAO (Uniform) | PAO (Discriminatory) |
|--------|--------------|---------------------|
| Payment basis | Clearing price (marginal cost) | Each generator's own offer |
| Low-cost generator surplus | Yes — paid above their offer | No — paid exactly their offer |
| Optimal strategy | Offer near true cost | Offer above cost, estimate clearing price |
| Real-world analogue | ERCOT, PJM, most U.S. ISOs | UK electricity market (pre-NETA), some gas markets |

## Financial Calculations

For each dispatched generator in a period:

- **Revenue** = (payment price) x (MW dispatched)
  - LAO: payment price = marginal cost
  - PAO: payment price = generator's offer
- **Costs** = generator's production cost x MW dispatched
- **Profit** = revenue - costs
- **Money** = cumulative total across all periods (starts at the configured starting money)

## Generator Presets

Each player receives an identical portfolio based on the selected preset.

### Standard (5 generators, 100 MW total)

| Capacity | Production Cost |
|----------|----------------|
| 50 MW | $20/MW |
| 20 MW | $30/MW |
| 10 MW | $40/MW |
| 10 MW | $50/MW |
| 10 MW | $65/MW |

### Simple (3 generators, 100 MW total)

| Capacity | Production Cost |
|----------|----------------|
| 50 MW | $20/MW |
| 30 MW | $35/MW |
| 20 MW | $55/MW |

### Competitive (7 generators, 100 MW total)

| Capacity | Production Cost |
|----------|----------------|
| 30 MW | $15/MW |
| 20 MW | $25/MW |
| 15 MW | $30/MW |
| 10 MW | $40/MW |
| 10 MW | $50/MW |
| 10 MW | $60/MW |
| 5 MW  | $75/MW |

### Default Offers

When a game starts, each generator's initial offer is set to its **production cost**. This means a completely passive player (one who never changes their offers) will have different outcomes depending on the payment method:

- **LAO:** A passive player's generators are dispatched at cost and paid the clearing price. They still earn profit whenever the clearing price exceeds their cost — which is common for low-cost generators.
- **PAO:** A passive player's generators are dispatched at cost and paid exactly that cost. Revenue equals cost, so profit is **$0** every period.

This asymmetry is intentional and illustrates a key difference between uniform and discriminatory pricing.

## Load Profiles

Load (demand) varies each period based on a 24-hour cycle that repeats. The formula is:

**Load = floor(number of players x 100 x profile multiplier)**

Each player contributes a base of 100 MW of potential demand, scaled by the profile.

### Realistic
Models a typical daily demand curve with morning and evening peaks and an overnight valley. Multipliers range from ~0.44 to ~0.85.

### Flat
Constant demand at 65% of capacity every period. Useful for isolating pricing strategy from demand variability.

### Peak
Extreme peaks (up to 95%) and deep valleys (down to 30%). Tests how players respond to dramatic demand swings.

### Volatile
Demand jumps unpredictably between 30% and 95% with no smooth pattern. Tests adaptability under uncertainty.

### Load Cycling

The profile repeats on a 24-period cycle: `profile[(periodNumber - 1) % 24]`. A 48-period game plays through the profile twice. Players who memorize the pattern can anticipate demand.

### Load Jitter

When **load jitter** is enabled (1–30%), each period's actual demand is randomly varied from the profile value by up to ±X%. The demand forecast shown to players before clearing uses the base profile value (no jitter), so there is a surprise element at clearing time. This reduces the advantage of memorizing the load profile.

## Admin Features

- **Auto-advance timer** — periods advance automatically on a configurable countdown (default 180 seconds). Can be toggled on/off mid-game.
- **Manual advance** — admin can advance the period at any time.
- **Kick players** — remove a player during the lobby phase.
- **Reward/penalize** — adjust a player's money during a running or completed game.
- **Market visibility** — set to public (appears in market list) or unlisted (join by name only).
- **Join policy** — lock or unlock the lobby to prevent/allow new players.
- **CSV export** — download full game data (periods, players, generators) as CSV files.
- **Market settings** — all game parameters (payment method, generator preset, demand profile, offer cap, starting money, scarcity price, load jitter, etc.) are editable via the settings modal while the game is in the forming/full state. Once the game starts, settings become read-only.
- **Storage management** — view, probe, and destroy Durable Object storage for all markets.

## Player Features

- **Real-time offer submission** — set offer prices for each generator at any time during a period.
- **Period results** — view revenue, costs, and profit per period.
- **Profit chart** — visual chart of cumulative money over time.
- **Leaderboard rank** — see your position relative to other players (other players' exact money is hidden).
- **Auto-reconnect** — if disconnected, the client automatically reconnects with exponential backoff.

### Information Visibility

Players can see their own money, period results, and leaderboard rank. Other players' exact money is hidden (shown as $0). Players cannot see other players' offers or dispatch details.

### Offer Validation

Offers are silently clamped to `[0, max_offer_price]`. Non-finite values (NaN, Infinity) are rejected and the previous offer is retained.
