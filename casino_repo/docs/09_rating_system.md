# Casino Resort Manager — Resort Rating System
**Matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1.**

---

## Design Intent

Resort Rating is the single most important number the player sees. It must:
- Rise visibly when the player builds something good
- Fall noticeably — but not catastrophically — when the floor is overcrowded
- Stay stable between days when the player makes no changes
- Never produce a surprise the player cannot explain from their current floor state

To achieve this, the rating is built entirely from **static contributions** (things the player built) plus one **dynamic penalty** (crowding, using yesterday's data). Static inputs never change between ticks unless the player builds or demolishes something. The penalty uses a one-day lag to avoid circular dependency and to smooth out noise.

---

## 1. Final Formula

```
rawRating =
    1.50                              // base — always present
  + (0.02 × slotCount)               // casino floor: slots
  + (0.18 × smallTableCount)         // casino floor: small tables
  + (0.25 × largeTableCount)         // casino floor: large tables
  + (0.20 × wcCount)                 // services: WC
  + (barExists ? 0.35 : 0.00)        // services: bar (flat, once)
  + (0.03 × roomCount)               // hotel: room count
  + (0.25 × hotelQualityLevel)       // hotel: quality level (1–3)
  − crowdingPenalty                  // dynamic penalty (see Section 2)

resortRating = clamp(rawRating, 1.0, 5.0)
```

### What each group contributes

**Base (1.50)**
The resort always starts at 1.5. Even an empty floor with no upgrades has a baseline score because the hotel, lobby, and reception exist.

**Casino floor (slots + tables)**
Slots contribute little individually but accumulate. Tables contribute significantly per unit. Large tables are the highest single-object rating gain. This group rewards building out the floor.

**Services (WC + bar)**
WC is a strong-per-cost amenity — +0.20 for 1,200 is the best rating-per-cash ratio in the game. The bar is a one-time flat bonus worth 0.35, making it the single largest jump available from one build action.

**Hotel (rooms + quality)**
Room count has a gentle slope (+0.03 each) to reward gradual expansion without making room-buying dominant. Quality level has a meaningful step (+0.25 per level) as a reward for the larger quality upgrade investment.

**Crowding penalty**
The only dynamic term. Described fully in Section 2.

### Maximum achievable rating (theoretical)

At the clamp ceiling of 5.0, the player never needs to know the formula ceiling — the display just shows 5.0. For reference, reaching 5.0 requires substantial floor investment, a full hotel with high quality, and managed crowding.

---

## 2. Crowding Penalty Logic

### What it is

When more guests arrive than the casino can comfortably hold, the experience quality drops. This is reflected as a negative adjustment to the next day's rating.

### Formula

```
// Computed at the start of each tick, before rating is calculated
// Uses lastDayGuests to avoid circular dependency

if casinoCapacity == 0:
    crowdingPenalty = 0.0
else:
    ratio           = lastDayGuests / casinoCapacity
    crowdingPenalty = max(0.0, (ratio − 1.0) × 0.5)
```

### How it behaves

| Situation | Ratio | Penalty |
|---|---|---|
| Guests < capacity | < 1.0 | 0.00 — no penalty |
| Guests = capacity | 1.0 | 0.00 — exactly at limit, no penalty |
| Guests = 1.5× capacity | 1.5 | 0.25 |
| Guests = 2× capacity | 2.0 | 0.50 |
| Guests = 3× capacity | 3.0 | 1.00 |

The penalty scales linearly above capacity. At double capacity, the rating drops by 0.5 stars — painful but not catastrophic. At triple capacity it would drop a full star, which only happens if the player actively neglects building floor capacity for many days.

### Why it uses yesterday's guests

If the penalty used today's guests, the rating formula would be circular: rating affects guest count, guest count affects penalty, penalty affects rating. Using `lastDayGuests` breaks this cleanly. It also has a natural gameplay meaning: word gets around — today's rating reflects how yesterday's guests experienced the resort.

### Edge cases

- **Day 1:** `lastDayGuests = 0`, so `crowdingPenalty = 0` always. The player gets a free first day.
- **Capacity = 0:** Skip the formula entirely. No division, no penalty. A player who has built nothing gets no crowding penalty because there were no guests to crowd.
- **After demolition:** If the player demolishes floor objects and capacity drops, the penalty may increase the next day. This is intentional — removing capacity that was being used has consequences.

---

## 3. How Hotel Quality Affects Rating

Hotel quality contributes through two distinct additive terms:

```
hotelQualityContribution = 0.25 × hotelQualityLevel
```

| Quality Level | Contribution |
|---|---|
| Level 1 (start) | +0.25 |
| Level 2 | +0.50 |
| Level 3 | +0.75 |

Because `hotelQualityLevel` starts at 1, the hotel always contributes at least +0.25 to rating from day one. The player never starts at exactly the base of 1.50 — their initial rating is at minimum 1.75 (base + quality 1).

The upgrade from level 1 → 2 adds +0.25 to rating. From level 2 → 3 adds another +0.25. These are meaningful bumps but not dramatic jumps — they reward the investment without making the casino floor feel irrelevant.

Room count adds a separate gentle slope alongside quality:
```
roomCountContribution = 0.03 × roomCount
```
At 10 rooms this is +0.30. At 20 rooms, +0.60. Room count is the slow, steady hotel growth track. Quality is the step-change upgrade track.

---

## 4. How Services Affect Rating

Services are passive rating modifiers. They have no guest interaction or pathfinding in MVP.

### WC
```
wcContribution = 0.20 × wcCount
```
- Each WC adds +0.20.
- No cap on WC count in MVP.
- First WC: strongest single cheapest boost available early game (+0.20 for 1,200 cash).
- Second and third WCs have diminishing strategic value — the rating gain is real but the player should be building tables instead. The formula does not enforce diminishing returns, but natural spending pressure does.

### Bar
```
barContribution = barExists ? 0.35 : 0.00
```
- Flat bonus, applied once.
- Only one bar can exist (enforced by placement rules).
- The bar's +0.35 is the largest single build-action rating jump in the game. It is placed at goal 10 deliberately — the player earns it as a capstone action.
- There is no "bar quality" or "bar upgrade" in MVP.

### Services vs casino floor — design intent

| Object | Cost | Rating Gain | Gain per 1,000 cash |
|---|---|---|---|
| Slot | 750 | +0.02 | 0.027 |
| WC | 1,200 | +0.20 | 0.167 |
| Small table | 2,500 | +0.18 | 0.072 |
| Large table | 4,500 | +0.25 | 0.056 |
| Bar | 6,500 | +0.35 | 0.054 |

WC is the clear early-game rating efficiency winner. The player should feel rewarded for noticing this. Tables dominate mid-game because they also drive capacity and revenue — not just rating.

---

## 5. Clamping and Display

### Clamping
```
resortRating = clamp(rawRating, 1.0, 5.0)
```
- The rating never displays below 1.0 or above 5.0.
- Internally, `rawRating` can go above 5.0 — the clamp absorbs it silently.
- There is no visual or audio signal when the player hits the 5.0 ceiling in MVP. It just stops rising.

### Display rounding
```
displayRating = round(resortRating, 1 decimal place)
```
- Always show exactly one decimal place: `2.1`, `3.7`, `5.0`.
- Never show `2.10` or `2` — always exactly one decimal.
- The star display (if using visual stars) maps as: 0–1.0 → empty, 1.0–2.0 → 1 star, etc. Use a continuous fill proportion for the fractional part.

### Star display mapping
```
fullStars     = floor(resortRating)                    // 0–5
partialFill   = resortRating − fullStars               // 0.0–1.0, fill fraction of next star
emptyStars    = 5 − fullStars − (partialFill > 0 ? 1 : 0)
```

---

## 6. Keeping Rating Stable Day-to-Day

Without intervention, the rating would be completely stable between days (because it is sum of static terms plus a penalty). The only source of day-to-day variation is the crowding penalty, which can fluctuate if guest counts vary around the capacity threshold.

### Smoothing the crowding penalty

Apply a simple **exponential moving average** to the crowding penalty so it does not snap between 0 and a large value in a single day:

```
CROWDING_SMOOTH = 0.4    // weight given to new value; 1.0 = no smoothing [TUNABLE]

rawPenalty      = max(0.0, (lastDayGuests / casinoCapacity − 1.0) × 0.5)
crowdingPenalty = (CROWDING_SMOOTH × rawPenalty) + ((1 − CROWDING_SMOOTH) × prevCrowdingPenalty)
```

Store `prevCrowdingPenalty` in `EconomyState`. Initialise to 0.

**Effect:**

| Scenario | Without smoothing | With smoothing (0.4) |
|---|---|---|
| Penalty jumps from 0 → 0.5 | Full −0.5 immediately | −0.20 day 1, −0.32 day 2, −0.39 day 3 |
| Penalty drops from 0.5 → 0 | Full 0 immediately | 0.30 day 1, 0.18 day 2, 0.11 day 3 |

With smoothing, a single overcrowded day does not crater the rating. The effect fades over 3–4 days after the player adds more capacity. This feels more natural and less punishing.

**If smoothing adds too much complexity for MVP:** Skip it. The raw penalty is acceptable. Add smoothing only if playtesting reveals jarring day-to-day swings.

### Summary of stability rules

1. Rating only changes if the player builds/demolishes something, or if the crowding penalty changes.
2. Crowding penalty only changes if `lastDayGuests` or `casinoCapacity` changes.
3. If the player makes no changes and guest count stabilises, the rating is completely static.
4. The smoothed penalty means a new overcrowding event takes a few days to fully show, and a fixed overcrowding event takes a few days to fully recover. Both are intentional.

---

## Pseudocode

```typescript
// Persistent state additions for this system
interface RatingState {
  prevCrowdingPenalty: number   // initialise to 0.0
}

const CROWDING_SMOOTH = 0.4    // [TUNABLE] — set to 1.0 to disable smoothing

function computeResortRating(
  s:                 SimulationInput,
  lastDayGuests:     number,
  casinoCapacity:    number,
  prevCrowdingPenalty: number
): { resortRating: number; crowdingPenalty: number } {

  // ── Crowding penalty ──────────────────────────────────────────────────────
  let rawPenalty = 0.0

  if (casinoCapacity > 0) {
    const ratio = lastDayGuests / casinoCapacity
    rawPenalty  = Math.max(0.0, (ratio - 1.0) * 0.5)
  }

  // Apply smoothing
  const crowdingPenalty =
    (CROWDING_SMOOTH * rawPenalty) +
    ((1 - CROWDING_SMOOTH) * prevCrowdingPenalty)

  // ── Static contributions ──────────────────────────────────────────────────
  const rawRating =
    1.50 +
    (0.02 * s.slotCount) +
    (0.18 * s.smallTableCount) +
    (0.25 * s.largeTableCount) +
    (0.20 * s.wcCount) +
    (s.barExists ? 0.35 : 0.0) +
    (0.03 * s.roomCount) +
    (0.25 * s.hotelQualityLevel) -
    crowdingPenalty

  // ── Clamp ─────────────────────────────────────────────────────────────────
  const resortRating = clamp(rawRating, 1.0, 5.0)

  return { resortRating, crowdingPenalty }
}

// Display helpers
function formatRatingDisplay(resortRating: number): string {
  return resortRating.toFixed(1)    // always "X.X"
}

function computeStarDisplay(resortRating: number): StarDisplay {
  const fullStars   = Math.floor(resortRating)
  const partialFill = resortRating - fullStars   // 0.0–1.0
  const emptyStars  = 5 - fullStars - (partialFill > 0 ? 1 : 0)
  return { fullStars, partialFill, emptyStars }
}

interface StarDisplay {
  fullStars:    number   // fully filled star count
  partialFill:  number   // fill fraction (0.0–1.0) of the next star
  emptyStars:   number   // empty star count
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
```

---

## 3 Example Scenarios

---

### Scenario A — Day 1, Empty Floor

**State:** No objects built. Hotel quality 1, 0 rooms.
`lastDayGuests = 0`, `casinoCapacity = 0`, `prevCrowdingPenalty = 0`.

```
rawPenalty      = 0.0   (capacity = 0, skip)
crowdingPenalty = 0.0

rawRating = 1.50
          + 0   (no slots)
          + 0   (no tables)
          + 0   (no WC)
          + 0   (no bar)
          + 0   (no rooms)
          + 0.25 × 1   (quality level 1)
          − 0
          = 1.75

resortRating = clamp(1.75, 1.0, 5.0) = 1.75 → displays as "1.8"
```

**Takeaway:** The player starts at 1.8 stars on day 1 with nothing built. The hotel quality baseline gives them a foundation. The first visible goal (rating 2.0) is within reach after a few early builds.

---

### Scenario B — Mid Game, Overcrowding

**State:** 3 slots, 2 small tables, 1 WC. Hotel quality 1, 4 rooms.
`lastDayGuests = 22`, `casinoCapacity = 3 + 8 = 11`, `prevCrowdingPenalty = 0.0`.

```
rawPenalty      = max(0, (22/11 − 1.0) × 0.5)
               = max(0, (2.0 − 1.0) × 0.5)
               = max(0, 0.5) = 0.5

crowdingPenalty = (0.4 × 0.5) + (0.6 × 0.0) = 0.20   (smoothed — first overcrowded day)

rawRating = 1.50
          + (0.02 × 3)    = 0.06
          + (0.18 × 2)    = 0.36
          + (0.25 × 0)    = 0.00
          + (0.20 × 1)    = 0.20
          + 0.00           (no bar)
          + (0.03 × 4)    = 0.12
          + (0.25 × 1)    = 0.25
          − 0.20          (crowding)
          = 2.29

resortRating = 2.29 → displays as "2.3"
```

**Next day,** if guests stay at 22 and nothing changes:
```
prevCrowdingPenalty = 0.20
rawPenalty          = 0.5 (same overcrowding)
crowdingPenalty     = (0.4 × 0.5) + (0.6 × 0.20) = 0.20 + 0.12 = 0.32

rawRating           = 2.49 − 0.32 = 2.17 → displays as "2.2"
```

The rating is visibly declining. The player now has a clear signal to build more capacity. Adding one more small table (capacity +4) would bring `casinoCapacity` to 15, reducing the penalty from 0.5 to `max(0, (22/15 − 1) × 0.5) = max(0, 0.233) = 0.12`.

**Takeaway:** Overcrowding is visible and escalating but not instant. The player has a day or two to respond before it materially damages their rating.

---

### Scenario C — Late Game, Stable High Rating

**State:** 5 slots, 3 small tables, 2 large tables, 1 WC, 1 bar. Hotel quality 2, 10 rooms.
`lastDayGuests = 28`, `casinoCapacity = 5 + 12 + 12 = 29`, `prevCrowdingPenalty = 0.0`.

```
rawPenalty      = max(0, (28/29 − 1.0) × 0.5) = max(0, −0.017) = 0.0
crowdingPenalty = 0.0   (guests slightly under capacity — no penalty)

rawRating = 1.50
          + (0.02 × 5)    = 0.10
          + (0.18 × 3)    = 0.54
          + (0.25 × 2)    = 0.50
          + (0.20 × 1)    = 0.20
          + 0.35           (bar)
          + (0.03 × 10)   = 0.30
          + (0.25 × 2)    = 0.50
          − 0.00
          = 3.99

resortRating = clamp(3.99, 1.0, 5.0) = 3.99 → displays as "4.0"
```

**Takeaway:** At 4.0 stars the player is running a well-developed resort with no overcrowding. The rating is completely stable day-to-day because capacity exceeds guest count and no penalty is active. Reaching 4.0 required substantial investment across all systems — casino floor, services, and hotel — which is the intended mid-to-late game state.

---

*Resort Rating system version: MVP 1.1 — matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1, economy model MVP 1.1.*
