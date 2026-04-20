# Casino Resort Manager — Progression System
**Matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1.**

---

## Version Note

Your request listed goals 4 and 5 in the original order (Rating 2.2 → then first small table).
The critical review (issue #2) identified this as a reachability problem and corrected it:
- Goals 4 and 5 are **swapped**
- Rating target is **lowered from 2.2 → 2.0**

This document uses the corrected v1.1 order throughout. See the critical review document for the full reasoning.

---

## Structure: Sequential, One Active Goal at a Time

Goals are **strictly sequential**. Only one goal is active at a time. The player cannot skip ahead, and multiple goals cannot complete in the same event. The active goal is stored as a single index (0–9).

**Why sequential:**
- Simpler to implement — one check per event, not ten.
- Clearer player focus — the UI always has one thing to show.
- Easier to balance pacing — each goal's difficulty is tuned relative to the one before it.
- No risk of reward stacking or out-of-order completion.

**One edge case to handle:** Goals 1, 3, 4, and 9 (build goals) can be satisfied by a build action that happens between day ticks. These must be checked immediately on placement, not just at end-of-day. Goals 2, 5, 6, 7, 8 are metric thresholds checked at end-of-day tick only.

---

## Goal Definitions

### Goal 1 — Build 3 Slot Machines

| Field | Value |
|---|---|
| **Index** | 0 |
| **Label** | "First Machines" |
| **Condition** | `slotCount >= 3` |
| **Check trigger** | Immediately after any placement or demolition event |
| **Reward** | +500 cash |
| **Unlocks** | Nothing — all objects already available |
| **Notes** | Starting cash (7,500) covers 3 slots (2,250) with 5,250 left over. This goal should complete within the first few player actions and serves as a tutorial push to get something on the floor. |

---

### Goal 2 — Reach 35 Guests Per Day

| Field | Value |
|---|---|
| **Index** | 1 |
| **Label** | "First Crowd" |
| **Condition** | `totalGuests >= 35` |
| **Check trigger** | End-of-day tick only (step 15 of simulation loop) |
| **Reward** | +800 cash |
| **Unlocks** | Nothing |
| **Notes** | At 3 slots only, walk-in guests are ~3/day. This goal cannot be reached with slots alone — it naturally pushes the player toward adding more capacity (tables) or hotel rooms. It bridges the gap between "built 3 slots" and "spend serious money on a table." |

---

### Goal 3 — Build First WC

| Field | Value |
|---|---|
| **Index** | 2 |
| **Label** | "Basic Amenity" |
| **Condition** | `wcCount >= 1` |
| **Check trigger** | Immediately after any placement or demolition event |
| **Reward** | +600 cash |
| **Unlocks** | Nothing |
| **Notes** | The WC is the best rating-per-cash object in the game. Placing this goal here teaches the player that amenities matter, not just floor objects. The reward (600) partially offsets the WC cost (1,200). If the player demolishes their only WC, `wcCount` drops to 0 — but the goal is already completed and cannot un-complete. |

---

### Goal 4 — Build First Small Table

| Field | Value |
|---|---|
| **Index** | 3 |
| **Label** | "Real Gaming" |
| **Condition** | `smallTableCount >= 1` |
| **Check trigger** | Immediately after any placement or demolition event |
| **Reward** | +1,200 cash |
| **Unlocks** | Nothing (large tables are already available) |
| **Notes** | The small table (2,500) is the first major investment. The reward (1,200) softens the cost. This goal intentionally comes before the rating target (goal 5) — the small table's +0.18 rating contribution is what makes goal 5 reachable. Reversing them (original order) left the player stuck. |

---

### Goal 5 — Reach Resort Rating 2.0

| Field | Value |
|---|---|
| **Index** | 4 |
| **Label** | "Rising Star" |
| **Condition** | `resortRating >= 2.0` |
| **Check trigger** | End-of-day tick only |
| **Reward** | +1,000 cash |
| **Unlocks** | Nothing |
| **Notes** | Achievable after goals 1–4 are complete: 3 slots (+0.06) + 1 WC (+0.20) + 1 small table (+0.18) + base 1.75 = 2.19. The player has comfortable margin above 2.0, so crowding or rounding never block this. Checking at end-of-day means the player sees the rating update, then the goal fires — the sequence is clear. |

---

### Goal 6 — Earn 5,000 Total

| Field | Value |
|---|---|
| **Index** | 5 |
| **Label** | "First Profit" |
| **Condition** | `cumulativeIncome >= 5000` |
| **Check trigger** | End-of-day tick only |
| **Reward** | +1,500 cash |
| **Unlocks** | Nothing |
| **Notes** | `cumulativeIncome` starts at 0 and counts daily revenue only — starting cash is excluded. At ~170/day (3 slots + 1 small table + 1 WC), this takes roughly 30 days. This is the first time goal — it rewards sustained operation, not just building. The 1,500 reward is the largest so far and is timed to arrive just as hotel expansion starts to look attractive. |

---

### Goal 7 — Expand Hotel to 4 Rooms

| Field | Value |
|---|---|
| **Index** | 6 |
| **Label** | "Hotel Open" |
| **Condition** | `roomCount >= 4` |
| **Check trigger** | Immediately after any hotel room purchase |
| **Reward** | +1,000 cash |
| **Unlocks** | Nothing — hotel panel already accessible |
| **Notes** | The cheapest path is two Small Expansions (+2 each, 1,000 each = 2,000 total), or one Medium Expansion (+4, 1,800). Either triggers the goal. The player chooses their preferred spend. This is the first hotel system goal — it ensures the player opens the hotel panel and engages with the room upgrade mechanic before progressing further. |

---

### Goal 8 — Reach 60 Guests Per Day

| Field | Value |
|---|---|
| **Index** | 7 |
| **Label** | "Busy Floor" |
| **Condition** | `totalGuests >= 60` |
| **Check trigger** | End-of-day tick only |
| **Reward** | +2,000 cash |
| **Unlocks** | Nothing |
| **Notes** | 60 guests requires meaningful floor investment and some hotel rooms contributing hotel casino guests. This is not reachable by floor alone at typical early-game capacity — the hotel integration is necessary. Forces the player to think about both systems together. The 2,000 reward is the largest single reward and arrives just before the expensive hotel quality upgrade. |

---

### Goal 9 — Upgrade Hotel Quality to Level 2

| Field | Value |
|---|---|
| **Index** | 8 |
| **Label** | "Quality Service" |
| **Condition** | `hotelQualityLevel >= 2` |
| **Check trigger** | Immediately after any hotel quality upgrade purchase |
| **Reward** | +1,500 cash |
| **Unlocks** | Nothing — quality level 3 already purchasable if affordable |
| **Notes** | Costs 2,000. The reward (1,500) partially offsets it. This upgrade gives +0.25 to rating and raises occupancy, compounding over all subsequent days. The goal positions it as the second-to-last task — the player should understand its value from watching occupancy improve. |

---

### Goal 10 — Build the Bar

| Field | Value |
|---|---|
| **Index** | 9 |
| **Label** | "Grand Bar" |
| **Condition** | `barExists == true` |
| **Check trigger** | Immediately after bar placement |
| **Reward** | +3,000 cash + end-state screen |
| **Unlocks** | **End-state screen** (MVP complete) |
| **Notes** | The bar costs 6,500 and requires a free 8-tile wall run. At this stage the player has enough cash and floor experience to plan the placement properly. The +0.35 rating bonus is the largest single build-action gain in the game — the player should see their rating jump visibly on the next tick. The 3,000 reward is symbolic — the MVP is complete. Show a summary screen: days played, final rating, total earned, total built. |

---

## Goal Summary Table

| # | Index | Label | Condition | Check When | Reward |
|---|---|---|---|---|---|
| 1 | 0 | First Machines | `slotCount >= 3` | On build/demolish | +500 |
| 2 | 1 | First Crowd | `totalGuests >= 35` | End of day | +800 |
| 3 | 2 | Basic Amenity | `wcCount >= 1` | On build/demolish | +600 |
| 4 | 3 | Real Gaming | `smallTableCount >= 1` | On build/demolish | +1,200 |
| 5 | 4 | Rising Star | `resortRating >= 2.0` | End of day | +1,000 |
| 6 | 5 | First Profit | `cumulativeIncome >= 5000` | End of day | +1,500 |
| 7 | 6 | Hotel Open | `roomCount >= 4` | On hotel purchase | +1,000 |
| 8 | 7 | Busy Floor | `totalGuests >= 60` | End of day | +2,000 |
| 9 | 8 | Quality Service | `hotelQualityLevel >= 2` | On hotel purchase | +1,500 |
| 10 | 9 | Grand Bar | `barExists == true` | On build | +3,000 + end screen |

**Total rewards across all goals:** 13,100 cash

---

## Feature Unlocks Through Goals

**No hard feature locks in MVP.** All objects and hotel upgrades are available to purchase from the start — the player is only constrained by cash.

This is intentional. Feature gating adds implementation complexity and can frustrate players who understand the game well. In MVP, natural cash constraints serve as the soft progression gate.

**One exception: the end-state screen.** This is triggered exclusively by goal 10 completion. It is not accessible any other way.

**Post-MVP suggestion (do not implement now):** Consider locking large tables behind goal 4 (first small table) to ensure the player encounters small tables before skipping ahead. In MVP, trust cash constraints to do this work.

---

## Goal Checking Logic

### Two check triggers

```typescript
// Trigger A — after any build or demolish action on the map
function checkGoalOnBuildEvent(game: GameState): void {
  checkAndAdvanceGoal(game)
}

// Trigger B — after any hotel room or quality purchase
function checkGoalOnHotelPurchase(game: GameState): void {
  checkAndAdvanceGoal(game)
}

// Trigger C — at step 15 of the daily simulation loop (end of day)
function checkGoalOnDayEnd(game: GameState): void {
  checkAndAdvanceGoal(game)
}
```

All three call the same function. The function is idempotent — calling it when the condition is not met does nothing.

### Core check function

```typescript
function checkAndAdvanceGoal(game: GameState): void {
  const idx = game.progression.activeGoalIndex

  // All goals complete
  if (idx >= 10) return

  // Build goal-check state snapshot from current game state
  const s: GoalCheckState = {
    slotCount:         game.economy.slotCount,
    smallTableCount:   game.economy.smallTableCount,
    wcCount:           game.economy.wcCount,
    barExists:         game.economy.barExists,
    roomCount:         game.hotel.roomCount,
    hotelQualityLevel: game.hotel.qualityLevel,
    totalGuests:       game.economy.totalGuests,
    resortRating:      game.economy.resortRating,
    cumulativeIncome:  game.economy.cumulativeIncome,
  }

  if (!isGoalMet(idx, s)) return

  // Mark complete
  game.progression.completedGoals[idx] = true
  game.progression.activeGoalIndex     = idx + 1

  // Apply reward
  const reward = GOAL_REWARDS[idx]
  game.economy.cash += reward

  // Fire callback (UI notification, sound, etc.)
  onGoalComplete(idx, reward)

  // Check if game is now complete
  if (game.progression.activeGoalIndex >= 10) {
    onGameComplete(game)
  }
}


function isGoalMet(idx: number, s: GoalCheckState): boolean {
  switch (idx) {
    case 0: return s.slotCount         >= 3
    case 1: return s.totalGuests       >= 35
    case 2: return s.wcCount           >= 1
    case 3: return s.smallTableCount   >= 1
    case 4: return s.resortRating      >= 2.0
    case 5: return s.cumulativeIncome  >= 5000
    case 6: return s.roomCount         >= 4
    case 7: return s.totalGuests       >= 60
    case 8: return s.hotelQualityLevel >= 2
    case 9: return s.barExists         === true
    default: return false
  }
}


const GOAL_REWARDS: number[] = [
  500,    // 0 — First Machines
  800,    // 1 — First Crowd
  600,    // 2 — Basic Amenity
  1200,   // 3 — Real Gaming
  1000,   // 4 — Rising Star
  1500,   // 5 — First Profit
  1000,   // 6 — Hotel Open
  2000,   // 7 — Busy Floor
  1500,   // 8 — Quality Service
  3000,   // 9 — Grand Bar
]
```

### Handling demolished objects

Goals are **never un-completed.** If the player completes goal 1 (3 slots) then demolishes two slots, goal 1 stays complete and `activeGoalIndex` stays at 1. The condition `slotCount >= 3` is only evaluated while goal 1 is active.

This means:
- No rollback logic needed
- No "completed goals" validation on load
- `completedGoals[i]` is write-once — set to true, never reset

---

## UI Presentation

### Active goal widget

Display a persistent card in the HUD showing the current active goal. The card has three states:

**State 1 — In Progress**
```
┌─────────────────────────────────────┐
│  GOAL 4 OF 10                       │
│  Real Gaming                        │
│  Build your first small table       │
│                                     │
│  [░░░░░░░░░░░░░░░░]  0 / 1         │
└─────────────────────────────────────┘
```

**State 2 — Just Completed** (show for ~2 seconds, then advance)
```
┌─────────────────────────────────────┐
│  ✓ GOAL COMPLETE                    │
│  Real Gaming                        │
│  +1,200 cash                        │
└─────────────────────────────────────┘
```

**State 3 — All Complete**
```
┌─────────────────────────────────────┐
│  ✓ ALL GOALS COMPLETE               │
│  View your resort summary →         │
└─────────────────────────────────────┘
```

### Progress bar values per goal

| Goal | Shown as | Current value | Target |
|---|---|---|---|
| 1 | `slotCount / 3` | `slotCount` | 3 |
| 2 | `totalGuests / 35` | `totalGuests` | 35 |
| 3 | `wcCount / 1` | `wcCount` | 1 |
| 4 | `smallTableCount / 1` | `smallTableCount` | 1 |
| 5 | `resortRating / 2.0` | `resortRating` | 2.0 |
| 6 | `cumulativeIncome / 5000` | `cumulativeIncome` | 5,000 |
| 7 | `roomCount / 4` | `roomCount` | 4 |
| 8 | `totalGuests / 60` | `totalGuests` | 60 |
| 9 | `hotelQualityLevel / 2` | `hotelQualityLevel` | 2 |
| 10 | `barExists ? 1 : 0` | — | 1 |

For goals with binary conditions (3, 4, 9, 10), the bar shows 0% or 100% — no partial fill.
For goals with numeric thresholds (1, 2, 5, 6, 7, 8), the bar fills linearly.

### Goal list panel (optional tap-to-open)

A secondary panel showing all 10 goals with their completion state. Not the primary UI — the player should not need to open this panel regularly.

```
✓  First Machines      Build 3 slots
✓  First Crowd         Reach 35 guests/day
✓  Basic Amenity       Build first WC
▶  Real Gaming         Build first small table   ← active
○  Rising Star         Reach rating 2.0
○  First Profit        Earn 5,000 total
○  Hotel Open          Expand to 4 rooms
○  Busy Floor          Reach 60 guests/day
○  Quality Service     Upgrade hotel to level 2
○  Grand Bar           Build the bar
```

Legend: `✓` = complete, `▶` = active, `○` = locked

Do not show reward amounts in the goal list. Rewards are revealed only on completion to preserve the surprise.

### Goal completion animation

On completion, trigger in sequence:
1. Goal card switches to "COMPLETE" state with reward amount
2. Cash counter animates up by reward amount
3. After 2 seconds, goal card transitions to next active goal
4. Brief flash or shimmer on the new goal card to draw attention

Keep animations under 2 seconds total. Do not block player interaction during the animation.

---

## Edge Cases

| Situation | Behaviour |
|---|---|
| Player completes goal during day tick and build event in same tick | Only one check happens per event call. No double-fire. |
| Goal condition is already met when game loads from save | `checkAndAdvanceGoal` is called once at game load after state is restored. Handles any save where a goal was met but not recorded. |
| Player demolishes bar (goal 10 already complete) | `barExists` becomes false but goal stays complete. No regression. |
| `cumulativeIncome` overflows | Not possible in MVP scope. int range is sufficient. |
| Active goal index is 10 (all done) | `checkAndAdvanceGoal` returns immediately. No checks run. |

---

*Progression system version: MVP 1.1 — matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1, economy model MVP 1.1, rating system MVP 1.1.*
