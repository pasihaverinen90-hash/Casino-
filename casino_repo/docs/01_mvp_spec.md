# Casino Resort Manager — MVP Game Design Spec

---

## 1. Core Game Concept

A mobile-style top-down casino resort management game. The player places and arranges casino objects on a grid floor, manages a simplified hotel through a UI panel, and grows their Resort Rating to attract more guests and earn more money. The core loop is: **build → earn → upgrade → build more**.

No time-of-day or day-of-week simulation. Tick-based economy (one "day" per cycle). Simple, expandable systems throughout.

---

## 2. MVP Scope

**In scope:**
- 36×24 grid casino floor with free placement
- 5 buildable object types (slots, small table, large table, WC, bar)
- Hotel managed entirely via UI panel (no room grid)
- Single economy currency (cash)
- Resort Rating (1.0–5.0) as the main progression score
- Guest flow formula driving daily income
- 10 linear progression goals
- No decoration system, no time simulation, no staff

**Out of scope (post-MVP):**
- Decoration influence zones
- Staff hiring or pathing
- Day/week cycle
- Multiple floors built by the player
- Room-by-room hotel construction
- Realistic crowd simulation

---

## 3. Map Structure

| Property | Value |
|---|---|
| Grid size | 36 × 24 tiles |
| Lobby | Pre-placed, centre of the map |
| Lobby dimensions | 6 tiles wide × 24 tiles tall (full height, centred horizontally) |
| Buildable casino area | 15 tiles wide on each side (15 + 6 + 15 = 36) |
| Hotel reception | Pre-placed in lobby, non-removable |
| Elevators | Pre-placed on walls, non-removable |
| Casino area | Both sides of the lobby, fully open from start |
| Tile passability | All walkable tiles are passable; guests may share tiles |

**Zones (logical, not hard-walled):**
- **Lobby strip** — contains reception and elevator access
- **West casino area** — open buildable space
- **East casino area** — open buildable space

Player can build anywhere in the casino areas. No unlocking of zones required.

---

## 4. Buildable Object List

| Object | Size | Capacity | Cost | Limit | Notes |
|---|---|---|---|---|---|
| Slot machine | 1×1 | 1 | 750 | Unlimited | Cheapest, weakest rating boost |
| Small table | 2×3 | 4 | 2,500 | Unlimited | Blackjack or Poker (type chosen on place) |
| Large table | 2×4 | 6 | 4,500 | Unlimited | Roulette or Craps (type chosen on place) |
| WC | 3×1 (wall) | — | 1,200 | Unlimited | Middle tile = door; must be placed against wall |
| Bar | 8×1 (wall) | — | 6,500 | **1** | 2 centre tiles = doors; must be placed against wall |

**Wall objects** snap to any interior wall edge. Their footprint projects inward from the wall.

**Table type** (Blackjack, Poker, Roulette, Craps) is cosmetic only in MVP. It affects the object's label and sprite but has no effect on capacity, rating, or revenue. Do not implement type-based logic.

**Demolition:** Any object can be demolished at any time for a **50% cash refund**. The bar's 1-unit limit resets on demolition, allowing it to be rebuilt elsewhere. Demolition is instant with no confirmation delay in MVP.

**WC** is a passive amenity. It contributes to Resort Rating only. No guest pathfinding or usage tracking is implemented in MVP. Treat it as a static rating modifier.

---

## 5. Hotel System Summary

Managed exclusively from the **Hotel Panel UI**. Not visible on the grid except for pre-placed reception and elevators.

### Room Capacity Upgrades
| Purchase | Rooms Added | Cost |
|---|---|---|
| Small expansion | +2 | 1,000 |
| Medium expansion | +4 | 1,800 |
| Large expansion | +8 | 3,200 |

Starting room count: **0** (player must buy their first rooms).

### Hotel Quality Levels
| Upgrade | Cost |
|---|---|
| Level 1 → 2 | 2,000 |
| Level 2 → 3 | 4,000 |

Quality level affects both occupancy rate and Resort Rating bonus.

### Occupancy Formula
```
Occupancy             = min(1.0, 0.35 + 0.10 × ResortRating + 0.08 × HotelQualityLevel)
BookedRooms           = floor(RoomCount × Occupancy)
HotelCasinoGuests/day = BookedRooms × 0.9   // ~90% of booked rooms visit the casino
```

---

## 6. Economy Summary

**Starting cash:** 7,500

**Income source:** Daily revenue from casino guests.

### Daily Guest Flow
```
CasinoCapacity        = Slots + 4×SmallTables + 6×LargeTables

BaseDemand            = 30
RatingMultiplier      = 0.6 + (ResortRating / 5)
CapacityMultiplier    = min(1.5, CasinoCapacity / 30)

WalkInGuests/day      = BaseDemand × RatingMultiplier × CapacityMultiplier
TotalGuests/day       = WalkInGuests + HotelCasinoGuests
```

**Daily revenue:** `TotalGuests × RevenuePerGuest`

**RevenuePerGuest = 20** (locked spec value; primary tuning lever post-playtest)

> Worked anchor example: 3 slots built, no hotel rooms → WalkInGuests ≈ 19, HotelGuests = 0 → ~380 cash/day. Goal 6 (earn 5,000 cumulative) reached in roughly 13 days at that rate.

**No expenses in MVP** (no staff wages, no maintenance). Pure income game in MVP.

---

## 7. Rating and Guest Flow Summary

### Resort Rating Formula
```
ResortRating =
  1.50 (base)
  + 0.02 × SlotCount
  + 0.18 × SmallTableCount
  + 0.25 × LargeTableCount
  + 0.20 × WCCount
  + 0.35 (if bar exists)
  + 0.03 × RoomCount
  + 0.25 × HotelQualityLevel
  − CrowdingPenalty
  clamped to [1.0, 5.0]
```

### Crowding Penalty (simple)
```
CrowdingPenalty(today) = max(0, (TotalGuests_yesterday / CasinoCapacity − 1.0) × 0.5)
```
Uses the previous tick's guest count to avoid a circular dependency with ResortRating. Requires one stored `lastDayGuests` variable. Penalty only activates when guests exceed capacity.

### Guest Flow Loop (per day tick)
1. Recalculate ResortRating
2. Calculate WalkInGuests and HotelGuests
3. Sum TotalGuests
4. Generate daily revenue
5. Check progression goals

---

## 8. Main Player-Visible Metrics

| Metric | Description |
|---|---|
| **Cash** | Current balance |
| **Resort Rating** | 1.0–5.0 star display |
| **Guests / Day** | Total daily visitors |
| **Casino Capacity** | Max simultaneous guests |
| **Hotel Rooms** | Owned room count |
| **Hotel Quality** | Level 1 / 2 / 3 |
| **Total Earned** | Cumulative income (used for goal #6) |

These 7 metrics cover all goal tracking and player feedback. All should be visible in a persistent HUD or dashboard panel.

---

## 9. First 10 Progression Goals

| # | Goal | Trigger Condition |
|---|---|---|
| 1 | Build 3 slot machines | SlotCount ≥ 3 |
| 2 | Reach 35 guests per day | TotalGuests/day ≥ 35 |
| 3 | Build first WC | WCCount ≥ 1 |
| 4 | Build first small table | SmallTableCount ≥ 1 |
| 5 | Reach Resort Rating 2.0 | ResortRating ≥ 2.0 |
| 6 | Earn total 5,000 cash | CumulativeIncome ≥ 5,000 (starts at 0; daily revenue only — starting cash excluded) |
| 7 | Increase hotel to 4 rooms | RoomCount ≥ 4 |
| 8 | Reach 60 guests per day | TotalGuests/day ≥ 60 |
| 9 | Upgrade hotel quality to level 2 | HotelQualityLevel ≥ 2 |
| 10 | Build the bar | BarExists = true |

Goals are linear and checked passively each day tick. Reward: cash bonus or UI unlock (exact reward amounts TBD during implementation).

---

## 10. Main Implementation and Balancing Risks

| Risk | Type | Notes |
|---|---|---|
| **Starting money too tight** | Balancing | 7,500 allows ~1 slot + WC + buffer. If first goal feels unreachable, raise starting cash or lower slot cost. |
| **Rating jumps too fast** | Balancing | With many slots, +0.02 per slot accumulates quickly. Cap slot contribution or apply diminishing returns post-MVP if needed. |
| **Crowding penalty too harsh early** | Balancing | Low capacity + decent guests = penalty before the player can respond. Consider applying penalty only above 1.5× capacity. |
| **Hotel rooms vs. floor income imbalance** | Balancing | Hotel guests are cheap to generate (buy rooms = more income). Monitor that floor building stays the more engaging path. |
| **Wall object placement UX** | Implementation | Snapping WC and bar to walls needs clear visual feedback. Must handle grid edges, door tile highlighting, and rotation. |
| **Bar 1-unit limit enforcement** | Implementation | Simple flag check, but UI must clearly communicate the limit before and after placement. |
| **Formula order dependency** | Implementation | Rating feeds guest count feeds revenue. Calculate in strict order each tick; avoid circular reads. |
| **Goal tracking for cumulative income** | Implementation | Requires a persistent `totalEarned` counter separate from current cash. Easy to miss if cash can also be spent. |
| **No negative income** | Balancing | Players cannot go bankrupt in MVP (no expenses). This is intentional for MVP but means no recovery tension — acceptable for scope. |
| **Expandability of object types** | Implementation | Build the placement system to be data-driven (object definitions as config structs) so new object types require no structural changes. |

---

*Spec version: MVP 1.1 — all critical review fixes applied. Scope locked.*
