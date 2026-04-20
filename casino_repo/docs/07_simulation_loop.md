# Casino Resort Manager — Daily Simulation Loop
**Matches ruleset MVP 1.1, data model MVP 1.1.**

---

## Design Principles

- **One tick = one day.** The loop runs once per player-triggered day advance. It does not run on a timer or in the background.
- **Aggregate only.** No per-guest agents, no per-object revenue calculations, no pathfinding. All simulation is formula-based on totals.
- **Pure function core.** `runDailySimulation()` takes state in and returns a result object out. It does not mutate state directly — the caller applies the result. This makes the loop trivially unit-testable.
- **Strict step order.** Each step depends only on values computed in earlier steps or persisted state from the previous day. No step reads values it is responsible for writing.
- **No costs in MVP.** There are no daily expenses. The economy section documents where cost logic would slot in for post-MVP, but the step is a no-op in MVP.

---

## Ordered Simulation Steps

```
Step 1  — Compute casino capacity
Step 2  — Compute crowding penalty        (uses lastDayTotalGuests from previous tick)
Step 3  — Compute resort rating           (uses crowding penalty from step 2)
Step 4  — Compute hotel occupancy         (uses resort rating from step 3)
Step 5  — Compute hotel casino guests     (uses occupancy from step 4)
Step 6  — Compute walk-in guests          (uses resort rating and capacity from steps 1 & 3)
Step 7  — Compute total guests            (sums steps 5 & 6)
Step 8  — Assign demand to object types   (distributes totalGuests across slots/tables/bar)
Step 9  — Compute daily revenue           (uses totalGuests from step 7)
Step 10 — Compute daily costs             (no-op in MVP; placeholder for post-MVP)
Step 11 — Compute net income              (revenue − costs)
Step 12 — Update economy state            (cash, cumulativeIncome)
Step 13 — Store lastDayTotalGuests        (persists totalGuests for next tick's crowding penalty)
Step 14 — Append daily stats snapshot     (writes DayStats entry and updates ChartHistory)
Step 15 — Check progression goals        (evaluates active goal; fires callback if met)
Step 16 — Advance day counter
```

---

## Plain English Step Descriptions

**Step 1 — Casino Capacity**
Count the total guest capacity of all placed casino floor objects. WC and Bar do not contribute. If nothing is built, capacity is 0.

**Step 2 — Crowding Penalty**
If capacity is 0, skip and set penalty to 0. Otherwise, divide last day's total guests by current capacity. If the ratio exceeds 1.0, the excess drives a rating penalty scaled by 0.5. This uses yesterday's guests to avoid a circular dependency with rating.

**Step 3 — Resort Rating**
Sum all flat rating contributions from placed objects and hotel state. Subtract the crowding penalty. Clamp the result to [1.0, 5.0]. This is the rating that drives all guest formulas this tick.

**Step 4 — Hotel Occupancy**
If the player has no rooms, skip and set occupancy and booked rooms to 0. Otherwise, compute a fractional occupancy from a base rate plus bonuses from resort rating and hotel quality. Multiply by room count and floor the result to get booked rooms.

**Step 5 — Hotel Casino Guests**
Multiply booked rooms by 0.9. Round to nearest integer. These are hotel guests who visit the casino today.

**Step 6 — Walk-in Guests**
If capacity is 0, walk-in guests are 0 — there is no functional casino to attract anyone. Otherwise, apply rating and capacity multipliers to the base demand constant. Round to nearest integer.

**Step 7 — Total Guests**
Sum walk-in and hotel casino guests. This is the final guest count for the day.

**Step 8 — Demand Assignment**
Distribute total guests across object types for display and future use. This is cosmetic and informational in MVP — it does not affect revenue. The split tells the UI how busy each section of the floor looks.

**Step 9 — Daily Revenue**
Multiply total guests by the revenue-per-guest constant (20). No per-object variation in MVP.

**Step 10 — Daily Costs**
No-op in MVP. Zero costs. The step exists in the loop so post-MVP expenses (staff wages, maintenance) can be inserted here without restructuring.

**Step 11 — Net Income**
Revenue minus costs. In MVP this always equals revenue.

**Step 12 — Update Economy State**
Add net income to cash. Add net income to cumulativeIncome. Both fields are updated atomically.

**Step 13 — Store lastDayTotalGuests**
Write totalGuests from this tick into the persisted `lastDayGuests` field. This value will be used in step 2 of the next tick.

**Step 14 — Append Daily Stats**
Create a DayStats snapshot from all values computed this tick. Append to statsHistory. Append each value to the corresponding ChartHistory array. Trim both to 30 entries if needed.

**Step 15 — Check Progression Goals**
Evaluate the single active goal condition against current state. If met, mark it complete, increment activeGoalIndex, and fire `onGoalComplete(goalIndex)`. If the new activeGoalIndex equals 10, the game is complete — fire `onGameComplete()`. Do not evaluate more than one goal per tick.

**Step 16 — Advance Day Counter**
Increment dayNumber by 1.

---

## Pseudocode

```typescript
// ─── Input / Output types ────────────────────────────────────────────────────

interface SimulationInput {
  // Persisted state — read-only inside the loop
  lastDayGuests:     number
  slotCount:         number
  smallTableCount:   number
  largeTableCount:   number
  wcCount:           number
  barExists:         boolean
  roomCount:         number
  hotelQualityLevel: number
  cash:              number
  cumulativeIncome:  number
  dayNumber:         number
  activeGoalIndex:   number
}

interface SimulationResult {
  // All computed values for this tick
  casinoCapacity:    number
  crowdingPenalty:   number
  resortRating:      number
  occupancyRate:     number
  bookedRooms:       number
  hotelGuests:       number
  walkInGuests:      number
  totalGuests:       number
  demandSplit:       DemandSplit
  dailyRevenue:      number
  dailyCosts:        number
  netIncome:         number

  // Updated economy fields
  newCash:              number
  newCumulativeIncome:  number

  // For persistence
  newLastDayGuests:   number
  newDayNumber:       number

  // Stats snapshot (ready to append)
  dayStats:           DayStats

  // Progression
  goalCompleted:      boolean
  completedGoalIndex: number     // -1 if none
  gameComplete:       boolean
}

interface DemandSplit {
  slotsGuests:       number
  tableGuests:       number
  barGuests:         number
  unassignedGuests:  number   // guests when no matching object exists
}


// ─── Constants ───────────────────────────────────────────────────────────────

const REVENUE_PER_GUEST  = 20       // [TUNABLE]
const BASE_DEMAND        = 30       // [TUNABLE]
const RATING_BASE        = 1.50
const RATING_CLAMP_MIN   = 1.0
const RATING_CLAMP_MAX   = 5.0
const HISTORY_MAX        = 30


// ─── Main entry point ────────────────────────────────────────────────────────

function runDailySimulation(input: SimulationInput): SimulationResult {

  // ── Step 1: Casino Capacity ──────────────────────────────────────────────
  const casinoCapacity =
    input.slotCount +
    (4 * input.smallTableCount) +
    (6 * input.largeTableCount)


  // ── Step 2: Crowding Penalty ─────────────────────────────────────────────
  // Uses lastDayGuests — avoids circular dependency with rating.
  let crowdingPenalty = 0.0
  if (casinoCapacity > 0 && input.lastDayGuests > 0) {
    crowdingPenalty = Math.max(0.0,
      (input.lastDayGuests / casinoCapacity - 1.0) * 0.5
    )
  }


  // ── Step 3: Resort Rating ────────────────────────────────────────────────
  const rawRating =
    RATING_BASE +
    (0.02 * input.slotCount) +
    (0.18 * input.smallTableCount) +
    (0.25 * input.largeTableCount) +
    (0.20 * input.wcCount) +
    (input.barExists ? 0.35 : 0.0) +
    (0.03 * input.roomCount) +
    (0.25 * input.hotelQualityLevel) +
    -crowdingPenalty

  const resortRating = clamp(rawRating, RATING_CLAMP_MIN, RATING_CLAMP_MAX)


  // ── Step 4: Hotel Occupancy ──────────────────────────────────────────────
  let occupancyRate = 0.0
  let bookedRooms   = 0

  if (input.roomCount > 0) {
    occupancyRate = Math.min(1.0,
      0.35 +
      (0.10 * resortRating) +
      (0.08 * input.hotelQualityLevel)
    )
    bookedRooms = Math.floor(input.roomCount * occupancyRate)
  }


  // ── Step 5: Hotel Casino Guests ──────────────────────────────────────────
  const hotelGuests = Math.round(bookedRooms * 0.9)


  // ── Step 6: Walk-in Guests ───────────────────────────────────────────────
  let walkInGuests = 0

  if (casinoCapacity > 0) {
    const ratingMultiplier   = 0.6 + (resortRating / 5.0)
    const capacityMultiplier = Math.min(1.5, casinoCapacity / 30.0)
    walkInGuests = Math.round(BASE_DEMAND * ratingMultiplier * capacityMultiplier)
  }


  // ── Step 7: Total Guests ─────────────────────────────────────────────────
  const totalGuests = walkInGuests + hotelGuests


  // ── Step 8: Demand Assignment ────────────────────────────────────────────
  // Distributes totalGuests across object categories for display purposes.
  // Does not affect revenue. Proportional split based on capacity weights.
  const demandSplit = assignDemand(totalGuests, input)


  // ── Step 9: Daily Revenue ────────────────────────────────────────────────
  const dailyRevenue = totalGuests * REVENUE_PER_GUEST


  // ── Step 10: Daily Costs (no-op in MVP) ──────────────────────────────────
  const dailyCosts = 0
  // POST-MVP: insert staff wages, maintenance, etc. here


  // ── Step 11: Net Income ──────────────────────────────────────────────────
  const netIncome = dailyRevenue - dailyCosts


  // ── Step 12: Update Economy ──────────────────────────────────────────────
  const newCash             = input.cash + netIncome           // cash never goes below 0; income is always >= 0
  const newCumulativeIncome = input.cumulativeIncome + netIncome


  // ── Step 13: Store lastDayTotalGuests ────────────────────────────────────
  const newLastDayGuests = totalGuests


  // ── Step 14: Daily Stats Snapshot ───────────────────────────────────────
  const dayStats: DayStats = {
    day:              input.dayNumber,
    totalGuests,
    walkInGuests,
    hotelGuests,
    dailyRevenue,
    cumulativeIncome: newCumulativeIncome,
    cash:             newCash,
    resortRating,
    casinoCapacity,
    bookedRooms,
    crowdingPenalty,
  }


  // ── Step 15: Progression Goals ───────────────────────────────────────────
  // Build a snapshot of all state that goals may check against.
  // Use the updated values (post-revenue) so income/rating goals see current state.
  const goalState: GoalCheckState = {
    slotCount:         input.slotCount,
    smallTableCount:   input.smallTableCount,
    wcCount:           input.wcCount,
    barExists:         input.barExists,
    roomCount:         input.roomCount,
    hotelQualityLevel: input.hotelQualityLevel,
    totalGuests,
    resortRating,
    cumulativeIncome:  newCumulativeIncome,
  }

  const { goalCompleted, completedGoalIndex, gameComplete } =
    checkActiveGoal(input.activeGoalIndex, goalState)


  // ── Step 16: Advance Day ─────────────────────────────────────────────────
  const newDayNumber = input.dayNumber + 1


  // ── Return full result ───────────────────────────────────────────────────
  return {
    casinoCapacity,
    crowdingPenalty,
    resortRating,
    occupancyRate,
    bookedRooms,
    hotelGuests,
    walkInGuests,
    totalGuests,
    demandSplit,
    dailyRevenue,
    dailyCosts,
    netIncome,
    newCash,
    newCumulativeIncome,
    newLastDayGuests,
    newDayNumber,
    dayStats,
    goalCompleted,
    completedGoalIndex,
    gameComplete,
  }
}


// ─── Step 8 helper: Demand Assignment ────────────────────────────────────────
// Splits total guests proportionally across object categories by capacity weight.
// Cosmetic only — does not affect revenue.

function assignDemand(totalGuests: number, input: SimulationInput): DemandSplit {
  const slotCapacity  = input.slotCount
  const tableCapacity = (4 * input.smallTableCount) + (6 * input.largeTableCount)
  const totalCapacity = slotCapacity + tableCapacity

  if (totalCapacity === 0) {
    // Nothing built — all guests are walk-throughs with nowhere to go
    return { slotsGuests: 0, tableGuests: 0, barGuests: 0, unassignedGuests: totalGuests }
  }

  // Proportional split by capacity weight
  const slotShare  = slotCapacity  / totalCapacity
  const tableShare = tableCapacity / totalCapacity

  const slotsGuests = Math.round(totalGuests * slotShare)
  const tableGuests = Math.round(totalGuests * tableShare)

  // Bar gets a fixed small draw if it exists (cosmetic only)
  // Not deducted from revenue — just used to show bar activity
  const barGuests = input.barExists ? Math.min(Math.round(totalGuests * 0.15), totalGuests) : 0

  // Rounding may leave a tiny remainder — assign to unassigned, not a bug
  const assignedTotal    = slotsGuests + tableGuests
  const unassignedGuests = Math.max(0, totalGuests - assignedTotal)

  return { slotsGuests, tableGuests, barGuests, unassignedGuests }
}


// ─── Step 15 helper: Goal Checking ───────────────────────────────────────────

interface GoalCheckState {
  slotCount:         number
  smallTableCount:   number
  wcCount:           number
  barExists:         boolean
  roomCount:         number
  hotelQualityLevel: number
  totalGuests:       number
  resortRating:      number
  cumulativeIncome:  number
}

interface GoalCheckResult {
  goalCompleted:      boolean
  completedGoalIndex: number    // -1 if not completed this tick
  gameComplete:       boolean
}

function checkActiveGoal(
  activeGoalIndex: number,
  state:           GoalCheckState
): GoalCheckResult {

  const NO_COMPLETION: GoalCheckResult = {
    goalCompleted: false, completedGoalIndex: -1, gameComplete: false
  }

  // All 10 goals already done
  if (activeGoalIndex >= 10) {
    return NO_COMPLETION
  }

  const met = isGoalMet(activeGoalIndex, state)

  if (!met) {
    return NO_COMPLETION
  }

  const nextIndex    = activeGoalIndex + 1
  const gameComplete = nextIndex >= 10

  // onGoalComplete(activeGoalIndex) is called by the caller, not here.
  // This function only returns data — it does not fire events or mutate state.

  return {
    goalCompleted:      true,
    completedGoalIndex: activeGoalIndex,
    gameComplete,
  }
}

function isGoalMet(goalIndex: number, state: GoalCheckState): boolean {
  switch (goalIndex) {
    case 0:  return state.slotCount         >= 3
    case 1:  return state.totalGuests       >= 35
    case 2:  return state.wcCount           >= 1
    case 3:  return state.smallTableCount   >= 1
    case 4:  return state.resortRating      >= 2.0
    case 5:  return state.cumulativeIncome  >= 5000
    case 6:  return state.roomCount         >= 4
    case 7:  return state.totalGuests       >= 60
    case 8:  return state.hotelQualityLevel >= 2
    case 9:  return state.barExists         === true
    default: return false
  }
}


// ─── Caller: apply result and fire events ────────────────────────────────────
// This lives outside the simulation function — in the game controller.
// Shown here for completeness.

function advanceDay(game: GameState): void {

  // Build input from current state
  const input: SimulationInput = buildSimInput(game)

  // Run the pure simulation
  const result = runDailySimulation(input)

  // Apply economy updates
  game.economy.cash             = result.newCash
  game.economy.cumulativeIncome = result.newCumulativeIncome
  game.economy.lastDayGuests    = result.newLastDayGuests
  game.economy.resortRating     = result.resortRating
  game.economy.casinoCapacity   = result.casinoCapacity
  game.economy.totalGuests      = result.totalGuests
  game.economy.walkInGuests     = result.walkInGuests
  game.economy.dailyRevenue     = result.dailyRevenue
  game.hotel.occupancyRate      = result.occupancyRate
  game.hotel.bookedRooms        = result.bookedRooms
  game.hotel.hotelCasinoGuests  = result.hotelGuests

  // Apply stats history
  appendDayStats(game, result.dayStats)

  // Apply progression
  if (result.goalCompleted) {
    game.progression.completedGoals[result.completedGoalIndex] = true
    game.progression.activeGoalIndex += 1
    onGoalComplete(result.completedGoalIndex)    // fire reward / UI callback
  }

  if (result.gameComplete) {
    onGameComplete()
  }

  // Advance day
  game.dayNumber = result.newDayNumber

  // Trigger save
  saveGame(game)
}


// ─── Stats history append ────────────────────────────────────────────────────

function appendDayStats(game: GameState, stats: DayStats): void {
  // Append to full history
  game.statsHistory.push(stats)
  if (game.statsHistory.length > HISTORY_MAX) {
    game.statsHistory.shift()
  }

  // Append to chart parallel arrays
  const ch = game.chartHistory
  ch.days.push(stats.day)
  ch.guestsPerDay.push(stats.totalGuests)
  ch.revenuePerDay.push(stats.dailyRevenue)
  ch.ratingPerDay.push(stats.resortRating)
  ch.capacityPerDay.push(stats.casinoCapacity)

  if (ch.days.length > HISTORY_MAX) {
    ch.days.shift()
    ch.guestsPerDay.shift()
    ch.revenuePerDay.shift()
    ch.ratingPerDay.shift()
    ch.capacityPerDay.shift()
  }
}


// ─── Utility ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
```

---

## Goals that trigger outside the daily tick

Some goals depend on build actions rather than daily simulation values. Goals 0, 2, 3, and 9 (slot count, WC count, table count, bar) change immediately when the player places or demolishes an object — they do not need to wait for the end-of-day tick to be triggered.

For these build-triggered goals, run `isGoalMet(activeGoalIndex, goalState)` immediately after any placement or demolition event, in addition to the daily tick check. No duplication risk — `isGoalMet` is a pure function and calling it twice is free.

```typescript
// Called after any placement or demolition
function checkGoalAfterBuildEvent(game: GameState): void {
  if (game.progression.activeGoalIndex >= 10) return

  const state = buildGoalCheckState(game)   // same snapshot as used in daily tick
  const met   = isGoalMet(game.progression.activeGoalIndex, state)

  if (met) {
    game.progression.completedGoals[game.progression.activeGoalIndex] = true
    game.progression.activeGoalIndex += 1
    onGoalComplete(game.progression.activeGoalIndex - 1)

    if (game.progression.activeGoalIndex >= 10) {
      onGameComplete()
    }
  }
}
```

---

## Testing Checklist

Each step of `runDailySimulation()` can be tested in isolation with the following cases:

| Step | Key test cases |
|---|---|
| Capacity | 0 objects → 0; 1 slot → 1; 1 small table → 4; mixed |
| Crowding penalty | lastDayGuests=0 → 0; guests=capacity → 0; guests=2×capacity → 0.5 |
| Resort rating | base only → 1.75 (1.5 + 0.25 quality); clamped at 5.0; penalty applied |
| Occupancy | roomCount=0 → 0 bookedRooms; high rating → high occupancy; clamp at 1.0 |
| Hotel guests | bookedRooms=10 → 9; bookedRooms=0 → 0 |
| Walk-in guests | capacity=0 → 0; capacity=30, rating=2.5 → check formula manually |
| Total guests | simple sum; verify no float bleed |
| Revenue | totalGuests × 20; totalGuests=0 → revenue=0 |
| Cumulative income | starts at 0; never includes starting cash; accumulates correctly |
| Goal check | each of the 10 conditions at boundary values (just below and at threshold) |

---

*Daily simulation loop version: MVP 1.1 — matches ruleset MVP 1.1, data model MVP 1.1.*
