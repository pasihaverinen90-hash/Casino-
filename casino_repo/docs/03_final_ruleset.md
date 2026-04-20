# Casino Resort Manager — MVP Final Ruleset
**Handoff document for engineering. Treat every rule as a spec requirement unless marked [TUNABLE].**

---

## 1. Build Rules

- The player has one currency: **Cash**.
- Starting cash: **7,500**.
- An object is placed by spending its cost. If the player cannot afford it, placement is blocked.
- There is no build queue, cooldown, or confirmation step. Purchase is instant.
- Objects cannot overlap each other or the lobby strip.
- Objects cannot be placed on pre-placed tiles (reception, elevators).
- Any placed object can be **demolished at any time** for a **50% cash refund**, rounded down.
- Demolition is instant. No confirmation required in MVP.
- Cash can never go below 0. No debt, no bankruptcy.

---

## 2. Object Placement Rules

All objects occupy a rectangular tile footprint on the grid. A tile is either fully occupied or fully free.

| Object | Footprint | Placement Zone |
|---|---|---|
| Slot machine | 1 × 1 | Any free non-wall, non-lobby tile |
| Small table | 2 × 3 | Any free non-wall, non-lobby tile |
| Large table | 2 × 4 | Any free non-wall, non-lobby tile |
| WC | 3 × 1 | Wall-snapped only (see Section 3) |
| Bar | 8 × 1 | Wall-snapped only (see Section 3) |

- **Rotation:** Floor objects (slot, tables) can be rotated 90°. Wall objects snap to the wall they are placed against and do not require separate rotation input.
- **Table type** (Blackjack / Poker / Roulette / Craps) is chosen at placement time. It is cosmetic only — no mechanical effect in MVP. Store the type on the object but do not branch logic on it.
- **Guests may occupy the same walkable tile simultaneously.** No pathfinding or collision between guests is required.

---

## 3. Wall-Object Rules

Wall objects (WC, Bar) have specific placement and structural requirements.

**Valid wall:** Any interior-facing wall tile on the perimeter of the buildable casino area. The lobby strip walls do not count as valid placement walls.

**Placement behaviour:**
- The object footprint extends **inward** from the wall (into the buildable floor area).
- The tiles directly against the wall are the object's back tiles. The door tile(s) face inward.
- No other object may occupy tiles within the footprint.

**WC specifics:**
- Footprint: 3 × 1 (3 tiles wide, 1 tile deep from wall).
- Door tile: the middle tile of the 3.
- No functional door logic required in MVP. The door tile is visual only.

**Bar specifics:**
- Footprint: 8 × 1 (8 tiles wide, 1 tile deep from wall).
- Door tiles: tile 4 and tile 5 (the two centre tiles).
- **Limit: exactly 1 bar on the map at any time.**
- Demolishing the bar resets the limit — a new bar can then be placed.
- If a bar already exists, the bar is greyed out and unselectable in the build menu.

---

## 4. Hotel Upgrade Rules

The hotel is managed entirely through the Hotel Panel UI. It has no grid presence beyond the pre-placed reception and elevators (which are non-interactive in MVP).

**Starting state:** 0 rooms, quality level 1.

### Room Capacity Purchases
These are one-time purchasable increments. They can be bought in any order, any number of times.

| Option | Rooms Added | Cost |
|---|---|---|
| Small expansion | +2 | 1,000 |
| Medium expansion | +4 | 1,800 |
| Large expansion | +8 | 3,200 |

- There is no room cap in MVP.
- Room count is a running total. Track as a single integer: `roomCount`.

### Hotel Quality Upgrades
Linear progression, must be purchased in order.

| Upgrade | Cost |
|---|---|
| Level 1 → Level 2 | 2,000 |
| Level 2 → Level 3 | 4,000 |

- Quality level is capped at 3.
- Track as a single integer: `hotelQualityLevel` (starting value: 1).

---

## 5. Rating Rules

Resort Rating is recalculated **at the start of every day tick**, before guest generation.

### Formula
```
ResortRating =
    1.50                          // base
  + 0.02 × slotCount
  + 0.18 × smallTableCount
  + 0.25 × largeTableCount
  + 0.20 × wcCount
  + (barExists ? 0.35 : 0.00)
  + 0.03 × roomCount
  + 0.25 × hotelQualityLevel
  − crowdingPenalty               // see Section 7
  → clamped to [1.0, 5.0]
```

- All terms are additive. No multiplicative interactions between rating components.
- `hotelQualityLevel` starts at 1, so the hotel always contributes at least +0.25 to rating.
- The clamp is applied as the final step, after the penalty.
- Display rating to the player rounded to one decimal place.

---

## 6. Capacity Rules

Casino capacity determines how many guests the floor can support, and drives the CapacityMultiplier.

### Formula
```
casinoCapacity = slotCount + (4 × smallTableCount) + (6 × largeTableCount)
```

- WC and Bar do not contribute to capacity.
- There is no hard cap on capacity in MVP.
- If `casinoCapacity = 0`, walk-in guests are 0 (no functional casino = no walk-ins).

---

## 7. Guest Generation Rules

Guest generation runs once per day tick, **after** rating is recalculated.

### Walk-in Guests
```
ratingMultiplier   = 0.6 + (resortRating / 5.0)
capacityMultiplier = min(1.5, casinoCapacity / 30.0)
walkInGuests       = round(30 × ratingMultiplier × capacityMultiplier)
```

- `30` is BaseDemand [TUNABLE].
- `capacityMultiplier` is 0 when capacity is 0, reaches 1.0 at capacity 30, caps at 1.5 at capacity 45.

### Hotel Guests
```
occupancy          = min(1.0, 0.35 + (0.10 × resortRating) + (0.08 × hotelQualityLevel))
bookedRooms        = floor(roomCount × occupancy)
hotelCasinoGuests  = round(bookedRooms × 0.9)
```

- If `roomCount = 0`, `hotelCasinoGuests = 0`. No division or formula evaluation needed.

### Total Guests
```
totalGuests = walkInGuests + hotelCasinoGuests
```

### Crowding Penalty (applied next tick)
```
crowdingPenalty = max(0.0, (lastDayTotalGuests / casinoCapacity − 1.0) × 0.5)
```

- Uses `lastDayTotalGuests` (stored from the previous tick) to avoid circular dependency with rating.
- On day 1, `lastDayTotalGuests = 0`, so penalty is 0.
- If `casinoCapacity = 0`, skip penalty calculation entirely (no division by zero).

### Tick Order (strict)
```
1. Recalculate resortRating (using lastDayTotalGuests for crowdingPenalty)
2. Calculate walkInGuests
3. Calculate hotelCasinoGuests
4. totalGuests = walkInGuests + hotelCasinoGuests
5. Generate daily revenue
6. lastDayTotalGuests = totalGuests
7. Check progression goals
```

---

## 8. Economy Rules

### Daily Revenue
```
dailyRevenue   = totalGuests × 20
cumulativeIncome += dailyRevenue
cash           += dailyRevenue
```

- `revenuePerGuest = 20` [TUNABLE — primary pacing lever post-playtest].
- `cumulativeIncome` starts at 0 and only increments from daily revenue. Starting cash is excluded.
- There are no expenses, wages, or maintenance costs in MVP.

### Cash Operations Summary
| Event | Cash Change |
|---|---|
| Place object | − object cost |
| Demolish object | + floor(objectCost × 0.5) |
| Buy hotel rooms | − purchase cost |
| Upgrade hotel quality | − upgrade cost |
| End of day tick | + dailyRevenue |

- Cash is a single integer or fixed-point value. Minimum value: 0.

---

## 9. Progression Rules

Goals are linear and evaluated in order at step 7 of each day tick. Only the current active goal is checked. On completion, advance to the next goal and award the goal reward.

| # | Goal Label | Trigger Condition |
|---|---|---|
| 1 | Build 3 slot machines | `slotCount >= 3` |
| 2 | Reach 35 guests / day | `totalGuests >= 35` |
| 3 | Build first WC | `wcCount >= 1` |
| 4 | Build first small table | `smallTableCount >= 1` |
| 5 | Reach Resort Rating 2.0 | `resortRating >= 2.0` |
| 6 | Earn 5,000 total | `cumulativeIncome >= 5000` |
| 7 | Expand hotel to 4 rooms | `roomCount >= 4` |
| 8 | Reach 60 guests / day | `totalGuests >= 60` |
| 9 | Upgrade hotel to quality 2 | `hotelQualityLevel >= 2` |
| 10 | Build the bar | `barExists == true` |

**Implementation notes:**
- Store active goal as an index (0–9). Increment on completion.
- All conditions are simple comparisons against already-tracked variables. No additional tracking is needed beyond what the economy and rating systems already maintain.
- Goal rewards (cash bonus or UI feedback) are TBD. Reserve a `onGoalComplete(goalIndex)` callback in code so rewards can be wired in later without restructuring.
- After goal 10 is completed, MVP progression is finished. Show a summary or end-state screen.

---

## Variable Reference

All state variables used across the ruleset, for quick implementation reference.

| Variable | Type | Initial Value | Notes |
|---|---|---|---|
| `cash` | int | 7,500 | Never below 0 |
| `cumulativeIncome` | int | 0 | Revenue only; excludes starting cash |
| `slotCount` | int | 0 | |
| `smallTableCount` | int | 0 | |
| `largeTableCount` | int | 0 | |
| `wcCount` | int | 0 | |
| `barExists` | bool | false | |
| `roomCount` | int | 0 | |
| `hotelQualityLevel` | int | 1 | Range: 1–3 |
| `casinoCapacity` | int | derived | Recalculate when objects change |
| `resortRating` | float | derived | Recalculate each tick; clamp [1.0, 5.0] |
| `totalGuests` | int | derived | Recalculate each tick |
| `lastDayTotalGuests` | int | 0 | Set at end of each tick |
| `activeGoalIndex` | int | 0 | Range: 0–9 |

---

*Ruleset version: MVP 1.1 — final. No new systems to be added before this ruleset is fully implemented.*
