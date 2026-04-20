# Casino Resort Manager — Statistics and Chart System
**Matches ruleset MVP 1.1, data model MVP 1.1, simulation loop MVP 1.1, UI design MVP 1.1.**

---

## Version Note: History Window Change

The data model (MVP 1.1) specified a 30-day history cap. This document upgrades that to **60 days** to support the 2-month rolling window requested here. Update the following constant wherever it appears:

```typescript
// data model MVP 1.1 said 30 — update to:
const HISTORY_MAX = 60
```

All `DayStats[]` and `ChartHistory` arrays are capped at 60 entries. The save format absorbs the change without a version bump — just a larger array. No other structural changes required.

---

## 1. Daily Stats Stored Per Day

One `DayStats` record is written at the end of every day tick. It is the single source of truth for all historical display. The chart arrays are derived from it.

### Updated DayStats structure

```typescript
interface DayStats {
  // Identity
  day:                number    // day number, starts at 1

  // Guests
  totalGuests:        number    // walk-in + hotel guests
  walkInGuests:       number
  hotelGuests:        number

  // Economy
  dailyRevenue:       number    // total income this day
  dailyCosts:         number    // always 0 in MVP; stored for post-MVP compatibility
  netIncome:          number    // dailyRevenue − dailyCosts
  cumulativeIncome:   number    // running total at end of this day
  cash:               number    // cash balance at end of this day

  // Revenue breakdown (for Stats › Today panel)
  slotRevenue:        number
  tableRevenue:       number
  barRevenue:         number
  hotelRoomRevenue:   number

  // Hotel
  occupancyRate:      number    // 0.0–1.0, e.g. 0.75
  bookedRooms:        number
  roomCount:          number    // snapshot of total rooms on this day

  // Casino floor
  casinoCapacity:     number
  crowdingPenalty:    number    // smoothed penalty value applied this day

  // Rating
  resortRating:       number    // final clamped value for this day
}
```

**What is not stored per-day:**
- `slotCount`, `smallTableCount`, etc. — these change via build events, not day ticks. If needed for display, read from current `EconomyState`.
- `hotelQualityLevel` — same reason.
- Any grid or placement data — that lives in `MapState`.

**Write timing:** Append at step 14 of the daily simulation loop, after economy is updated and before progression goals are checked.

---

## 2. History Storage: 60-Day Rolling Window

The system retains the most recent **60 day records** at all times. Day 61 evicts day 1, day 62 evicts day 2, and so on. The window always shows the last 60 days of play.

```typescript
// Both structures are capped at HISTORY_MAX = 60

// Full records — used for Stats › Today detail view
statsHistory: DayStats[]     // max length 60, index 0 = oldest retained day

// Parallel arrays — used for chart rendering (fast, no object iteration)
chartHistory: ChartHistory   // all arrays max length 60
```

### Why two structures

`DayStats[]` is rich but iterating it to extract one metric across 60 entries for a chart requires a map pass on every render. `ChartHistory` pre-extracts the chart-relevant fields as flat arrays. Chart rendering reads `chartHistory.guestsPerDay` directly — a single array reference, no transformation.

### Eviction rule

```typescript
function appendAndEvict<T>(arr: T[], value: T, max: number): void {
  arr.push(value)
  if (arr.length > max) {
    arr.shift()    // remove oldest
  }
}

// Called once per day, for every array simultaneously
function appendDayStats(stats: DayStats, history: StatsHistory): void {
  appendAndEvict(history.records, stats, HISTORY_MAX)

  const ch = history.charts
  appendAndEvict(ch.days,            stats.day,            HISTORY_MAX)
  appendAndEvict(ch.totalGuests,     stats.totalGuests,    HISTORY_MAX)
  appendAndEvict(ch.walkInGuests,    stats.walkInGuests,   HISTORY_MAX)
  appendAndEvict(ch.hotelGuests,     stats.hotelGuests,    HISTORY_MAX)
  appendAndEvict(ch.dailyRevenue,    stats.dailyRevenue,   HISTORY_MAX)
  appendAndEvict(ch.dailyCosts,      stats.dailyCosts,     HISTORY_MAX)
  appendAndEvict(ch.netIncome,       stats.netIncome,      HISTORY_MAX)
  appendAndEvict(ch.occupancyRate,   stats.occupancyRate,  HISTORY_MAX)
  appendAndEvict(ch.resortRating,    stats.resortRating,   HISTORY_MAX)
  appendAndEvict(ch.casinoCapacity,  stats.casinoCapacity, HISTORY_MAX)
}
```

All arrays are always the same length. Never append to one without appending to all.

---

## 3. Updated ChartHistory Structure

Extends the data model MVP 1.1 version with the additional metrics requested.

```typescript
interface ChartHistory {
  // X-axis
  days:            number[]    // day numbers for x-axis labels

  // Guest metrics
  totalGuests:     number[]
  walkInGuests:    number[]
  hotelGuests:     number[]

  // Economy metrics
  dailyRevenue:    number[]
  dailyCosts:      number[]    // always 0 in MVP; stored for post-MVP
  netIncome:       number[]

  // Hotel
  occupancyRate:   number[]    // stored as 0.0–1.0; display as percentage

  // Rating
  resortRating:    number[]

  // Capacity
  casinoCapacity:  number[]
}
```

---

## 4. Charted Metrics

Five charts are defined for MVP. Each has a type, unit, and display priority.

| # | Metric | Source field | Unit | Chart type | Priority |
|---|---|---|---|---|---|
| 1 | Guests per day | `totalGuests` | guests | Line | P1 — always shown |
| 2 | Revenue per day | `dailyRevenue` | cash | Line | P1 — always shown |
| 3 | Resort Rating | `resortRating` | stars | Line | P1 — always shown |
| 4 | Hotel occupancy | `occupancyRate` | % | Line | P2 — shown if rooms > 0 |
| 5 | Costs per day | `dailyCosts` | cash | Line | P3 — shown but always flat 0 in MVP |

**P1 charts** are always rendered in the History tab, regardless of game state.

**P2 charts** render only when the player has purchased hotel rooms. Before rooms exist, occupancy is always 0 and a flat line adds no value.

**P3 charts** are rendered but will be a flat zero line in MVP. Keep them — they communicate to the player that costs will exist eventually, and they are free to store and render.

**Not charted in MVP:**
- Per-object revenue breakdown (slots vs tables vs bar) — too granular for a chart; shown as a table in Stats › Today instead.
- Cumulative income — redundant with the cash metric in the HUD; post-MVP addition.
- Walk-in vs hotel guest split — interesting but not necessary for MVP; both are already in `DayStats` if needed later.

---

## 5. Handling Fewer Than 60 Days of Data

In the early game, the chart arrays have fewer than 60 entries. The chart must handle this gracefully without special cases.

### Rule: render what exists

The chart x-axis spans only the days that have data. If there are 7 days of data, the chart shows 7 points. The x-axis labels show the first and last available day numbers.

```typescript
// Chart render input — always pass the full array, whatever its current length
function renderChart(values: number[], days: number[]): void {
  const count = values.length   // 1 to 60

  if (count === 0) {
    renderEmptyState()          // "No data yet — advance your first day"
    return
  }

  if (count === 1) {
    renderSinglePoint(values[0], days[0])   // a dot, no line
    return
  }

  // Normal line render for 2+ points
  renderLine(values, days)
}
```

### Early-game empty state

On day 1 before the first tick has run, the history arrays are empty. Show a placeholder:

```
┌─────────────────────────────────────────────────┐
│  Guests / Day                                   │
│                                                 │
│            No data yet.                         │
│       Advance your first day to                 │
│            start tracking.                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

After day 1 completes, one point exists. Show it as a dot with the value labelled above it. From day 2 onward, draw lines normally.

### X-axis label strategy

Only show two x-axis labels: the **first** and **last** day in the current window. No intermediate labels in MVP.

```typescript
function getXAxisLabels(days: number[]): { left: string; right: string } {
  if (days.length === 0) return { left: "", right: "" }
  return {
    left:  `Day ${days[0]}`,
    right: `Day ${days[days.length - 1]}`,
  }
}
```

This works cleanly for 1 to 60 days without any layout calculation.

### Y-axis range

Auto-scale the y-axis per chart to `[0, max(values) × 1.2]`. The 1.2 multiplier provides 20% headroom above the highest point so the line doesn't clip the top edge. If `max(values) === 0`, set y-max to 1 (prevents a zero-range axis).

```typescript
function getYMax(values: number[]): number {
  const max = Math.max(...values, 0)
  return max === 0 ? 1 : max * 1.2
}
```

No y-axis labels in MVP (too cramped on mobile). Add them post-MVP.

---

## 6. Chart Screen UX

### Layout — Stats › History tab

Five charts stacked vertically in a scrollable container. Each chart is a fixed-height card.

```
┌───────────────────────────────────────────────┐
│  STATS          [Today ▸]  [◂ History]  [✕]  │
├───────────────────────────────────────────────┤
│  (scrollable area)                            │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Guests / Day                           │  │
│  │  ↑ 12       ╱‾‾╲___╱‾‾‾‾‾‾‾            │  │  ← 120px tall
│  │  Day 1                       Day 14    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Revenue / Day                          │  │
│  │  ↑ 171            ╱‾‾‾‾‾‾‾             │  │
│  │  Day 1                       Day 14    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Resort Rating                          │  │
│  │  ↑ 2.3     ───────────────╱‾           │  │
│  │  Day 1                       Day 14    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Hotel Occupancy                        │  │
│  │  ↑ 75%           ────────╱              │  │
│  │  Day 1                       Day 14    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │  Costs / Day                            │  │
│  │  ↑ 0    ─────────────────────────       │  │
│  │  Day 1                       Day 14    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

### Chart card anatomy

Each chart card contains:

```
┌─────────────────────────────────────────────────┐
│  [Title]              [Current value + unit]    │  ← 20px header
│  ┌─────────────────────────────────────────┐    │
│  │                                         │    │  ← 100px chart area
│  │          (line render)                  │    │
│  └─────────────────────────────────────────┘    │
│  [Day X]                           [Day Y]      │  ← 16px footer
└─────────────────────────────────────────────────┘
Total card height: ~160px with padding
```

- **Title:** metric name, left-aligned, small caps or subdued style.
- **Current value:** the most recent value in the array, right-aligned, larger text. This is the "today" figure — most relevant for the player.
- **Chart area:** line only, no grid lines, no data point dots in MVP.
- **Footer:** left = first day label, right = last day label.

### Line rendering approach

For MVP, use the simplest possible SVG polyline. No library required.

```typescript
function buildPolylinePoints(
  values: number[],
  chartW: number,    // chart area width in px
  chartH: number,    // chart area height in px
  yMax:   number
): string {
  if (values.length < 2) return ""

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * chartW
    const y = chartH - (v / yMax) * chartH    // invert: 0 at bottom
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(" ")
}

// Usage in SVG:
// <polyline points={buildPolylinePoints(...)} fill="none" stroke="#4CAF50" strokeWidth="2" />
```

This is ~15 lines of logic. No charting library dependency. Easy to replace with a richer library post-MVP.

### Interaction model

**No tap interactions on charts in MVP.** Charts are read-only. No tooltips, no scrubbing, no highlighted points.

The current value shown in the card header gives the player the number they most care about without requiring any interaction.

Post-MVP: tap-to-scrub (drag finger along line, tooltip shows value for that day).

### Occupancy display

`occupancyRate` is stored as `0.0–1.0`. Display it as a percentage in both the chart header and any text labels.

```typescript
function formatOccupancy(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
```

The chart y-axis for occupancy runs from 0 to 1.0 internally but the header shows the percentage format.

### Costs chart note

The costs chart will be a flat horizontal line at 0 for the entire MVP. Do not hide it or add a special case. A flat zero line communicates two things:
1. The player is not being charged anything (reassuring).
2. A costs line exists and will mean something later (priming).

---

## Stats Structure Consolidation

Updated top-level stats state to replace what was in the data model:

```typescript
interface StatsHistory {
  records:  DayStats[]      // full records, max 60 entries
  charts:   ChartHistory    // parallel arrays, max 60 entries each
}

// Added to GameState:
interface GameState {
  version:      string
  dayNumber:    number
  map:          MapState
  hotel:        HotelState
  economy:      EconomyState
  progression:  ProgressionState
  stats:        StatsHistory    // replaces statsHistory + chartHistory from data model
}
```

### Save data update

The save structure from the data model stores both `statsHistory` and `chartHistory` as separate top-level fields. Consolidate them under one key:

```typescript
interface SaveData {
  // ... all other fields unchanged ...
  stats: {
    records: DayStats[]
    charts:  ChartHistory
  }
}
```

---

## Quick Reference — Stats System

| Property | Value |
|---|---|
| History window | 60 days rolling |
| Records stored | Full `DayStats` per day |
| Chart arrays | 9 parallel arrays in `ChartHistory` |
| Charts rendered | 5 (guests, revenue, rating, occupancy, costs) |
| Chart type | SVG polyline, no library |
| Interaction | None in MVP (read-only) |
| Empty state | Placeholder text until first tick |
| 1-day state | Single dot, value labelled |
| 2+ days | Line chart, scales to available data |
| Y-axis | Auto-scaled, no labels in MVP |
| X-axis | First and last day label only |

---

*Statistics system version: MVP 1.1b — extends data model MVP 1.1 with 60-day window and expanded DayStats fields. All other documents remain at MVP 1.1.*
