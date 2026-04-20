# Casino Resort Manager — Economy Model
**Matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1.**

---

## Architecture: Two-Layer Revenue

The economy uses two layers that work together without conflicting:

- **Layer 1 — Aggregate revenue.** `totalGuests × revenuePerGuest` is the authoritative daily income figure. It is simple, testable, and drives the economy.
- **Layer 2 — Per-object revenue rates.** Each object type has a revenue-per-guest rate. These rates determine how `revenuePerGuest` is derived, and serve as the breakdown the UI shows the player ("Slots earned 240 today"). They are not independent calculations — they must sum to `revenuePerGuest` when weighted by the expected demand split.

The player sees per-object revenue breakdowns. The simulation uses the aggregate total. Both are consistent by construction.

---

## Object Revenue Rates

Each rate is the cash earned per guest assigned to that object type for one day.

| Object | Revenue Per Assigned Guest | Rationale |
|---|---|---|
| Slot machine | 12 | High volume, low margin. Cheap to build, many guests. |
| Small table | 22 | Moderate volume, moderate margin. Better ROI than slots. |
| Large table | 30 | Lower volume, high margin. Best revenue per guest. |
| Bar | 8 | Supplementary. Not a capacity object — earns on a small fixed guest draw. |
| Hotel room | — | Hotel revenue is calculated separately (see Section 5). |

### Why these rates produce ~20 per guest overall

At a typical mid-early game state (mix of slots and small tables), the demand-weighted average across assigned guests lands near 20. This anchors `revenuePerGuest = 20` as the aggregate constant.

Example weighted average with 5 slots + 2 small tables:
```
Slot capacity:  5     → weight 5/13  = 0.385
Table capacity: 8     → weight 8/13  = 0.615
Weighted rate = (0.385 × 12) + (0.615 × 22) = 4.62 + 13.53 = 18.15
```
Close to 20. As large tables replace small tables, the average rises. This is intentional — better investments produce slightly higher effective revenue per guest, rewarding progression without requiring a formula change.

---

## 1. Slot Machine Revenue Formula

```
slotGuests        = demandSplit.slotsGuests
slotRevenue       = slotGuests × 12
```

**Example:** 5 slots, 20 guests assigned to slots → `20 × 12 = 240`

**Notes:**
- Slot guests are assigned proportionally to slot capacity share (see Section 7).
- Revenue per guest is the lowest of all objects — slots are a volume play.
- A fully-slotted early floor generates modest but steady income.

---

## 2. Small Table Revenue Formula

```
smallTableGuests  = demandSplit.tableGuests × smallTableCapShare
smallTableRevenue = smallTableGuests × 22
```

Where:
```
smallTableCapShare = (4 × smallTableCount) / tableCapacity
tableCapacity      = (4 × smallTableCount) + (6 × largeTableCount)
```

**Example:** 2 small tables (cap 8), 0 large tables. Table guests = 12.
```
smallTableCapShare = 8/8 = 1.0
smallTableRevenue  = 12 × 22 = 264
```

**Notes:**
- If `tableCapacity = 0`, small table revenue is 0.
- When large tables exist alongside small tables, the share splits proportionally by capacity weight.

---

## 3. Large Table Revenue Formula

```
largeTableGuests  = demandSplit.tableGuests × largeTableCapShare
largeTableRevenue = largeTableGuests × 30
```

Where:
```
largeTableCapShare = (6 × largeTableCount) / tableCapacity
```

**Example:** 1 large table (cap 6), 1 small table (cap 4). Total table cap = 10. Table guests = 15.
```
largeTableCapShare = 6/10 = 0.60
largeTableGuests   = round(15 × 0.60) = 9
largeTableRevenue  = 9 × 30 = 270
```

**Notes:**
- Large tables earn the most per guest. This is the primary incentive to upgrade from slots.
- The step from small to large table (+8 cost, +8 capacity, +8 revenue/guest) is intentionally a meaningful decision.

---

## 4. Bar Revenue Formula

The bar is not a capacity object. It does not receive an allocated share of `totalGuests`. Instead it draws a small fixed fraction of guests as a supplementary revenue source.

```
barGuestDraw  = barExists ? round(totalGuests × 0.15) : 0
barRevenue    = barGuestDraw × 8
```

**Example:** Bar exists, totalGuests = 40.
```
barGuestDraw = round(40 × 0.15) = 6
barRevenue   = 6 × 8 = 48
```

**Notes:**
- Bar guests are additional to the capacity allocation — they are not subtracted from `slotsGuests` or `tableGuests`. The bar is treated as a parallel spend, not a competing activity.
- The bar draw (0.15) and rate (8) are both [TUNABLE].
- Bar revenue is small by design. Its value to the player comes from the +0.35 rating bonus, not direct income. At 40 guests, bar earns ~48/day against a 6,500 cost — payback is ~135 days from bar revenue alone, but the rating bonus drives far more income indirectly.

---

## 5. Hotel Revenue Formula

Hotel revenue is separate from casino floor revenue. It represents room charges paid by hotel guests, regardless of whether they visit the casino.

```
hotelRoomRevenue = bookedRooms × revenuePerRoom
revenuePerRoom   = 25
```

**Example:** 6 booked rooms → `6 × 25 = 150`

**Notes:**
- Hotel revenue and casino floor revenue are both added to daily income independently.
- `revenuePerRoom = 25` is [TUNABLE].
- Hotel rooms are a reliable passive income stream. At quality level 1 with 4 rooms and rating 2.0:
  - Occupancy = min(1.0, 0.35 + 0.20 + 0.08) = 0.63
  - Booked rooms = floor(4 × 0.63) = 2
  - Hotel revenue = 2 × 25 = 50/day
- Hotel income grows significantly with quality upgrades, which is the incentive for the level 2 upgrade (goal 9).

---

## 6. Daily Upkeep Formula

**No daily upkeep costs in MVP.** The cost slot exists in the simulation loop at step 10 and always returns 0.

The table below documents the intended post-MVP cost model so it can be added without redesigning the loop:

| Object | Planned Post-MVP Daily Cost |
|---|---|
| Slot machine | 5/day |
| Small table | 15/day |
| Large table | 25/day |
| Bar | 40/day |
| Hotel room (per room) | 8/day |

For MVP: `dailyCosts = 0`. Do not implement these values yet.

---

## 7. Demand Distribution Between Attractions

Total casino guests are distributed across object types for revenue calculation and display. Distribution is proportional to capacity, with the bar handled separately.

### Step 1 — Split casino floor guests by capacity weight

```
slotCapacity       = slotCount
tableCapacity      = (4 × smallTableCount) + (6 × largeTableCount)
totalFloorCapacity = slotCapacity + tableCapacity

slotShare          = slotCapacity  / totalFloorCapacity   (or 0 if totalFloorCapacity = 0)
tableShare         = tableCapacity / totalFloorCapacity   (or 0 if totalFloorCapacity = 0)

slotsGuests        = round(totalGuests × slotShare)
tableGuests        = totalGuests − slotsGuests            // remainder, avoids rounding drift
```

### Step 2 — Split table guests by table capacity weight

```
smallTableCapShare = (4 × smallTableCount) / tableCapacity
largeTableCapShare = (6 × largeTableCount) / tableCapacity

smallTableGuests   = round(tableGuests × smallTableCapShare)
largeTableGuests   = tableGuests − smallTableGuests       // remainder
```

### Step 3 — Bar draw (independent, not subtracted from floor)

```
barGuestDraw = barExists ? round(totalGuests × 0.15) : 0
```

### Step 4 — Assemble revenue

```
dailyRevenue =
    (slotsGuests      × 12)
  + (smallTableGuests × 22)
  + (largeTableGuests × 30)
  + (barGuestDraw     × 8)
  + (bookedRooms      × 25)
```

**Reconciliation with aggregate model:**
In the simulation loop, `dailyRevenue = totalGuests × 20` is still the primary formula. The per-object breakdown is computed in parallel for display only. On a given day the two values may differ by small rounding amounts. The aggregate formula is authoritative for income. The breakdown is for UI display only.

If exact consistency between the breakdown and the aggregate is required, replace `totalGuests × 20` with the full per-object sum above as the authoritative formula. Either approach is valid — pick one and document the choice.

---

## 8. Recommended Starting Values

| Constant | Value | Tunable |
|---|---|---|
| `revenuePerGuest` (aggregate) | 20 | Yes — primary pacing lever |
| `revenuePerGuest_slot` | 12 | Yes |
| `revenuePerGuest_smallTable` | 22 | Yes |
| `revenuePerGuest_largeTable` | 30 | Yes |
| `revenuePerGuest_bar` | 8 | Yes |
| `barGuestDrawRate` | 0.15 | Yes |
| `revenuePerRoom` | 25 | Yes |
| `BASE_DEMAND` | 30 | Yes |
| Starting cash | 7,500 | No — spec-locked |
| `REVENUE_PER_GUEST` (fallback aggregate) | 20 | Yes |

---

## 9. Balancing Notes — Early Game Pacing

### Phase 1 — Day 1 to ~Day 10 (3 slots, no tables)

```
casinoCapacity     = 3
ratingMultiplier   = 0.6 + (1.81 / 5.0) = 0.962
capacityMultiplier = min(1.5, 3 / 30) = 0.1
walkInGuests       = round(30 × 0.962 × 0.1) = 3
totalGuests        = 3 (no hotel rooms yet)
dailyRevenue       = 3 × 20 = 60/day
```

At 60/day, recovering the cost of 3 slots (2,250) takes about **38 days**. This is intentionally slow. The player should feel that their first table purchase (2,500) is a significant commitment, not an instant decision.

**Recommended guard:** If day-1 income feels too punishing during playtesting, raise starting cash from 7,500 to 9,000. Do not raise `revenuePerGuest` — that affects all phases equally.

### Phase 2 — Day ~10 to ~30 (3 slots + 1 small table)

```
casinoCapacity     = 3 + 4 = 7
ratingMultiplier   = 0.6 + (1.99 / 5.0) = 0.998
capacityMultiplier = min(1.5, 7 / 30) = 0.233
walkInGuests       = round(30 × 0.998 × 0.233) = 7
totalGuests        = 7
dailyRevenue       = (4 × 22) + (3 × 12) = 88 + 36 = 124/day
```

Recovering the small table cost (2,500) at 124/day takes about **20 days**. This feels better — the investment starts paying off noticeably faster, rewarding the transition from slots to tables.

### Phase 3 — Mid game (~2 small tables + 3 slots + 1 WC)

```
casinoCapacity     = 3 + 8 = 11
resortRating       ≈ 1.5 + 0.06 + 0.36 + 0.20 + 0.25 = 2.37
ratingMultiplier   = 0.6 + (2.37 / 5.0) = 1.074
capacityMultiplier = min(1.5, 11 / 30) = 0.367
walkInGuests       = round(30 × 1.074 × 0.367) = 12
totalGuests        = 12 (+ hotel guests if rooms bought)
dailyRevenue       ≈ 12 × ~20 = ~240/day
```

At ~240/day, the player is clearly progressing. The large table (4,500) becomes an achievable 19-day payback. The economy has shifted from "survive" to "invest deliberately."

### Key Pacing Rules of Thumb

| Phase | Daily Revenue Target | Feel |
|---|---|---|
| 3 slots only | ~60/day | Slow but not stalled — every day adds up |
| First small table | ~120/day | Noticeable improvement — confirms the upgrade was right |
| 2 small tables + WC | ~240/day | Momentum building — large table becomes a real target |
| First large table | ~360/day | Mid-game plateau — hotel upgrade becomes attractive |
| Bar built (goal 10) | ~500+/day | Endgame feel — rating approaching 4.0 |

### What to tune first at playtesting

1. **If early game feels too slow:** Raise starting cash (+1,000 to +2,000). Do not touch `revenuePerGuest`.
2. **If slot payback feels too long:** Lower slot cost from 750 → 600. The build cost change has no formula impact.
3. **If tables feel underpowered vs slots:** Raise `revenuePerGuest_smallTable` from 22 → 25. Re-check weighted average against aggregate constant.
4. **If hotel income feels irrelevant:** Raise `revenuePerRoom` from 25 → 35. Watch that hotel + casino income doesn't make floor building feel optional.
5. **If progression feels too fast:** Lower `BASE_DEMAND` from 30 → 24. This is the cleanest global pacing lever.

---

## Worked Example — A Complete Day

**Setup:** Day 14. Player has built: 3 slots, 1 small table, 1 WC. Hotel: 2 rooms, quality level 1. Last day guests: 9.

### Step 1 — Casino Capacity
```
casinoCapacity = 3 + (4 × 1) + 0 = 7
```

### Step 2 — Crowding Penalty
```
crowdingPenalty = max(0, (9 / 7 − 1.0) × 0.5)
               = max(0, (1.286 − 1.0) × 0.5)
               = max(0, 0.143)
               = 0.143
```

### Step 3 — Resort Rating
```
rawRating = 1.50 + (0.02×3) + (0.18×1) + 0 + (0.20×1) + 0 + (0.03×2) + (0.25×1) − 0.143
          = 1.50 + 0.06 + 0.18 + 0.20 + 0.06 + 0.25 − 0.143
          = 2.107
resortRating = clamp(2.107, 1.0, 5.0) = 2.107  → displays as 2.1
```

### Step 4 — Hotel Occupancy
```
occupancyRate = min(1.0, 0.35 + (0.10 × 2.107) + (0.08 × 1))
              = min(1.0, 0.35 + 0.211 + 0.08)
              = min(1.0, 0.641) = 0.641
bookedRooms   = floor(2 × 0.641) = floor(1.282) = 1
```

### Step 5 — Hotel Casino Guests
```
hotelGuests = round(1 × 0.9) = 1
```

### Step 6 — Walk-in Guests
```
ratingMultiplier   = 0.6 + (2.107 / 5.0) = 0.6 + 0.421 = 1.021
capacityMultiplier = min(1.5, 7 / 30)    = min(1.5, 0.233) = 0.233
walkInGuests       = round(30 × 1.021 × 0.233)
                   = round(30 × 0.238) = round(7.14) = 7
```

### Step 7 — Total Guests
```
totalGuests = 7 + 1 = 8
```

### Step 8 — Demand Distribution
```
slotCapacity       = 3
tableCapacity      = 4
totalFloorCapacity = 7

slotShare          = 3/7 = 0.429
slotsGuests        = round(8 × 0.429) = round(3.43) = 3
tableGuests        = 8 − 3 = 5            // remainder, all small table guests

smallTableCapShare = 4/4 = 1.0            // only small tables exist
smallTableGuests   = 5
largeTableGuests   = 0

barGuestDraw       = 0                    // no bar built
```

### Step 9 — Revenue
```
slotRevenue        = 3  × 12 = 36
smallTableRevenue  = 5  × 22 = 110
largeTableRevenue  = 0  × 30 = 0
barRevenue         = 0  ×  8 = 0
hotelRoomRevenue   = 1  × 25 = 25

dailyRevenue       = 36 + 110 + 0 + 0 + 25 = 171
```

### Step 10–12 — Economy Update
```
dailyCosts         = 0
netIncome          = 171
cash               = previousCash + 171
cumulativeIncome  += 171
```

### Step 13 — Store for next tick
```
lastDayGuests = 8
```

### Summary for Day 14

| Metric | Value |
|---|---|
| Resort Rating | 2.1 |
| Casino Capacity | 7 |
| Walk-in Guests | 7 |
| Hotel Guests | 1 |
| Total Guests | 8 |
| Slot Revenue | 36 |
| Table Revenue | 110 |
| Hotel Revenue | 25 |
| **Total Revenue** | **171** |
| Daily Costs | 0 |
| **Net Income** | **171** |

The player can see they are earning real money, but the pace clearly communicates that a second table (2,500 cost = ~15 more days at this rate) will make a meaningful difference. The upgrade path is legible from the numbers alone.

---

*Economy model version: MVP 1.1 — matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1.*
