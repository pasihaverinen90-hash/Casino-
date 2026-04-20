# Casino Resort Manager — MVP Data Model
**Language-agnostic. Examples shown in TypeScript syntax. Trivially portable to C# or GDScript.**

---

## Enums and Constants

Define these first. All other structures reference them.

```typescript
// Object types available to the player
enum ObjectType {
  SLOT_MACHINE  = "slot_machine",
  SMALL_TABLE   = "small_table",
  LARGE_TABLE   = "large_table",
  WC            = "wc",
  BAR           = "bar",
}

// Cosmetic subtype — stored on placed object, no mechanical effect
enum TableVariant {
  BLACKJACK = "blackjack",
  POKER     = "poker",
  ROULETTE  = "roulette",
  CRAPS     = "craps",
}

// Tile classification
enum TileType {
  FLOOR     = "floor",    // open, buildable
  WALL      = "wall",     // perimeter wall, valid for wall-object snapping
  LOBBY     = "lobby",    // non-buildable lobby strip
  BLOCKED   = "blocked",  // pre-placed fixed objects (reception, elevators)
}

// Hotel quality level (int 1–3, but typed for clarity)
// Use a plain int in implementation; this is for documentation only.
// HotelQualityLevel: 1 | 2 | 3

// Progression goal indices
enum GoalIndex {
  BUILD_3_SLOTS         = 0,
  REACH_35_GUESTS       = 1,
  BUILD_FIRST_WC        = 2,
  BUILD_FIRST_TABLE     = 3,
  REACH_RATING_2        = 4,
  EARN_5000_TOTAL       = 5,
  HOTEL_4_ROOMS         = 6,
  REACH_60_GUESTS       = 7,
  HOTEL_QUALITY_2       = 8,
  BUILD_BAR             = 9,
  COMPLETE              = 10,  // all goals done
}

// Grid constants
const GRID_COLS         = 36
const GRID_ROWS         = 24
const LOBBY_START_COL   = 15   // columns 15–20 inclusive (6 wide)
const LOBBY_END_COL     = 20

// Economy constants
const STARTING_CASH         = 7500
const REVENUE_PER_GUEST     = 20    // [TUNABLE]
const BASE_DEMAND           = 30    // [TUNABLE]
const DEMOLISH_REFUND_RATE  = 0.5
```

---

## 1. Global Game State

Top-level container. One instance exists for the entire game session. Everything else hangs off this.

```typescript
interface GameState {
  version:      string        // save format version, e.g. "1.1.0"
  dayNumber:    number        // current day, starts at 1
  map:          MapState
  hotel:        HotelState
  economy:      EconomyState
  progression:  ProgressionState
  statsHistory: DayStats[]    // one entry per completed day, index 0 = day 1
}
```

---

## 2. Map / Grid State

Holds the grid and all placed objects. The grid itself is a flat array indexed by `row * GRID_COLS + col`.

```typescript
interface MapState {
  cols:          number           // always GRID_COLS (36)
  rows:          number           // always GRID_ROWS (24)
  tiles:         TileState[]      // flat array, length = cols × rows
  placedObjects: PlacedObject[]   // all currently placed objects
}

// Helper: tile index from (col, row)
// index = row * GRID_COLS + col
```

---

## 3. Tile State

One entry per grid cell. Tiles do not store object data directly — placed objects own their tile list. Tiles only need to know if they are occupied and by what, for fast lookup during placement validation.

```typescript
interface TileState {
  col:              number
  row:              number
  tileType:         TileType
  occupiedByObjId:  string | null   // ID of the PlacedObject on this tile, null if free
}
```

**Notes:**
- `tileType` is set at map initialisation and never changes during gameplay.
- `occupiedByObjId` is updated whenever an object is placed or demolished.
- `LOBBY` and `BLOCKED` tiles always have `occupiedByObjId = null` (they are not free but are never assigned to a PlacedObject — placement validation simply rejects them).

---

## 4. Object Definitions

Static, read-only data. Defined once, referenced by `ObjectType`. Not stored in save data — rebuild from constants at runtime.

```typescript
interface ObjectDefinition {
  type:         ObjectType
  label:        string        // display name
  cost:         number
  footprintW:   number        // tile width
  footprintH:   number        // tile height
  capacity:     number        // 0 for WC and Bar
  isWallObject: boolean
  maxCount:     number | null // null = unlimited; 1 for Bar
  ratingBonus:  number        // flat rating contribution per instance (or if it exists)
  ratingIsFlat: boolean       // true = bonus applies once (bar); false = multiplied by count
}

const OBJECT_DEFINITIONS: Record<ObjectType, ObjectDefinition> = {
  [ObjectType.SLOT_MACHINE]: {
    type: ObjectType.SLOT_MACHINE, label: "Slot Machine",
    cost: 750,   footprintW: 1, footprintH: 1, capacity: 1,
    isWallObject: false, maxCount: null,
    ratingBonus: 0.02, ratingIsFlat: false,
  },
  [ObjectType.SMALL_TABLE]: {
    type: ObjectType.SMALL_TABLE, label: "Small Table",
    cost: 2500,  footprintW: 2, footprintH: 3, capacity: 4,
    isWallObject: false, maxCount: null,
    ratingBonus: 0.18, ratingIsFlat: false,
  },
  [ObjectType.LARGE_TABLE]: {
    type: ObjectType.LARGE_TABLE, label: "Large Table",
    cost: 4500,  footprintW: 2, footprintH: 4, capacity: 6,
    isWallObject: false, maxCount: null,
    ratingBonus: 0.25, ratingIsFlat: false,
  },
  [ObjectType.WC]: {
    type: ObjectType.WC, label: "WC",
    cost: 1200,  footprintW: 3, footprintH: 1, capacity: 0,
    isWallObject: true, maxCount: null,
    ratingBonus: 0.20, ratingIsFlat: false,
  },
  [ObjectType.BAR]: {
    type: ObjectType.BAR, label: "Bar",
    cost: 6500,  footprintW: 8, footprintH: 1, capacity: 0,
    isWallObject: true, maxCount: 1,
    ratingBonus: 0.35, ratingIsFlat: true,
  },
}
```

---

## 5. Placed Object Data

One instance per object on the map. Stored in `MapState.placedObjects`.

```typescript
interface PlacedObject {
  id:           string        // unique ID, e.g. UUID or "obj_001"
  type:         ObjectType
  col:          number        // top-left tile column
  row:          number        // top-left tile row
  rotated:      boolean       // true = footprint W and H are swapped
  variant:      TableVariant | null  // null for non-table objects
  tiles:        TileCoord[]   // all tile coordinates this object occupies
                              // pre-computed at placement time
}

interface TileCoord {
  col: number
  row: number
}
```

**Notes:**
- `tiles` is computed once at placement and stored. Do not recompute every frame.
- For wall objects, `rotated` is determined automatically by which wall they snap to. No manual rotation input needed.
- `variant` is stored for display purposes only. No system reads it for logic.

---

## 6. Hotel State

Tracks all hotel panel data. No grid representation.

```typescript
interface HotelState {
  roomCount:         number   // total purchased rooms, starts at 0
  qualityLevel:      number   // 1, 2, or 3 — starts at 1
  qualityMaxLevel:   number   // always 3 in MVP

  // Derived — recalculated each tick, stored for display
  occupancyRate:     number   // 0.0–1.0
  bookedRooms:       number   // floor(roomCount × occupancyRate)
  hotelCasinoGuests: number   // round(bookedRooms × 0.9)
}

// Hotel room purchase options — static, not stored in save
interface RoomUpgradeOption {
  label:      string
  roomsAdded: number
  cost:       number
}

const ROOM_UPGRADE_OPTIONS: RoomUpgradeOption[] = [
  { label: "Small Expansion",  roomsAdded: 2, cost: 1000 },
  { label: "Medium Expansion", roomsAdded: 4, cost: 1800 },
  { label: "Large Expansion",  roomsAdded: 8, cost: 3200 },
]

// Hotel quality upgrade costs — static, not stored in save
const HOTEL_QUALITY_UPGRADE_COSTS: Record<number, number> = {
  1: 2000,   // level 1 → 2
  2: 4000,   // level 2 → 3
}
```

---

## 7. Economy State

Tracks all financial data for the current session.

```typescript
interface EconomyState {
  cash:              number   // current spendable cash, never below 0
  cumulativeIncome:  number   // total earned from daily revenue only, starts at 0

  // Derived — recalculated each tick, stored for display
  casinoCapacity:    number   // slotCount + 4×smallTables + 6×largeTables
  resortRating:      number   // 1.0–5.0, one decimal precision for display
  walkInGuests:      number
  totalGuests:       number
  lastDayGuests:     number   // stored at end of tick for next tick's crowding penalty
  dailyRevenue:      number   // totalGuests × REVENUE_PER_GUEST (last completed day)

  // Convenience counts — derived from placedObjects, cached here for formula use
  slotCount:         number
  smallTableCount:   number
  largeTableCount:   number
  wcCount:           number
  barExists:         boolean
}
```

**Notes:**
- `slotCount`, `smallTableCount`, etc. are caches. Recompute them whenever `placedObjects` changes. Do not compute them inside the tick loop.
- `dailyRevenue` reflects the most recently completed day. Display this in the HUD.

---

## 8. Progression State

Tracks goal completion and active goal index.

```typescript
interface ProgressionState {
  activeGoalIndex:    number        // 0–9; GoalIndex.COMPLETE (10) = all done
  completedGoals:     boolean[]     // length 10, index matches GoalIndex
}

// Goal definitions — static, not stored in save
interface GoalDefinition {
  index:       GoalIndex
  label:       string
  description: string
  checkFn:     string   // pseudo-code description of condition (not executable)
}

const GOAL_DEFINITIONS: GoalDefinition[] = [
  { index: 0, label: "First Machines",    description: "Build 3 slot machines",         checkFn: "slotCount >= 3" },
  { index: 1, label: "First Crowd",       description: "Reach 35 guests per day",        checkFn: "totalGuests >= 35" },
  { index: 2, label: "Basic Amenity",     description: "Build your first WC",            checkFn: "wcCount >= 1" },
  { index: 3, label: "Real Gaming",       description: "Build your first small table",   checkFn: "smallTableCount >= 1" },
  { index: 4, label: "Rising Star",       description: "Reach Resort Rating 2.0",        checkFn: "resortRating >= 2.0" },
  { index: 5, label: "First Profit",      description: "Earn 5,000 total",               checkFn: "cumulativeIncome >= 5000" },
  { index: 6, label: "Hotel Open",        description: "Expand hotel to 4 rooms",        checkFn: "roomCount >= 4" },
  { index: 7, label: "Busy Floor",        description: "Reach 60 guests per day",        checkFn: "totalGuests >= 60" },
  { index: 8, label: "Quality Service",   description: "Upgrade hotel to quality 2",     checkFn: "hotelQualityLevel >= 2" },
  { index: 9, label: "Grand Bar",         description: "Build the bar",                  checkFn: "barExists == true" },
]
```

---

## 9. Daily Statistics History

One `DayStats` entry is appended at the end of every day tick. Used for in-game stats display and charts.

```typescript
interface DayStats {
  day:               number   // day number this entry represents
  totalGuests:       number
  walkInGuests:      number
  hotelGuests:       number
  dailyRevenue:      number
  cumulativeIncome:  number
  cash:              number   // cash balance at end of day
  resortRating:      number
  casinoCapacity:    number
  bookedRooms:       number
  crowdingPenalty:   number   // penalty value applied this day
}
```

**Notes:**
- Append after step 5 of the tick order (after revenue is applied, before goal check).
- In MVP, retain the last **30 entries** maximum. Trim oldest when the array exceeds 30.

---

## 10. Chart / History Storage

Lightweight parallel arrays for fast chart rendering. Updated at the end of each day tick. Kept separate from `DayStats` to avoid iterating the full history array for every chart draw.

```typescript
interface ChartHistory {
  days:             number[]   // day numbers, e.g. [1, 2, 3, ...]
  guestsPerDay:     number[]   // totalGuests per day
  revenuePerDay:    number[]   // dailyRevenue per day
  ratingPerDay:     number[]   // resortRating per day
  capacityPerDay:   number[]   // casinoCapacity per day
  maxEntries:       number     // always 30 in MVP
}
```

**Notes:**
- All arrays are the same length. Always append to all simultaneously.
- If `days.length >= maxEntries`, shift the oldest entry off all arrays before appending.
- Charts in MVP: guests/day line, revenue/day line, rating/day line. The capacity line is optional but cheap to store.

---

## Suggested Save Data Structure

Minimal save payload. Static definitions (ObjectDefinitions, GoalDefinitions, constants) are never saved — they are rebuilt from code at load time.

```typescript
interface SaveData {
  // Meta
  saveVersion:  string    // "1.1.0" — used to detect outdated saves
  savedAt:      string    // ISO 8601 timestamp

  // Game progress
  dayNumber:    number

  // Map — only placed objects are saved; tiles are rebuilt from objects on load
  placedObjects: SavedPlacedObject[]

  // Hotel
  roomCount:       number
  qualityLevel:    number

  // Economy
  cash:             number
  cumulativeIncome: number
  lastDayGuests:    number   // needed to compute first crowding penalty after load

  // Progression
  activeGoalIndex:  number
  completedGoals:   boolean[]

  // History (last 30 days)
  statsHistory:     DayStats[]
  chartHistory:     ChartHistory
}

// Stripped-down placed object for save — no derived fields
interface SavedPlacedObject {
  id:       string
  type:     ObjectType
  col:      number
  row:      number
  rotated:  boolean
  variant:  TableVariant | null
}
```

### Load Sequence

On loading a save, execute in this order:

```
1. Parse SaveData JSON
2. Rebuild TileState grid from GRID_COLS × GRID_ROWS (all tiles start unoccupied)
3. For each SavedPlacedObject:
     a. Look up ObjectDefinition by type
     b. Compute tile footprint from (col, row, rotated, footprintW, footprintH)
     c. Reconstruct full PlacedObject including tiles[]
     d. Mark those tiles as occupied in TileState
4. Recompute EconomyState cache fields (slotCount, barExists, etc.) from placedObjects
5. Recompute casinoCapacity, resortRating, and all derived Hotel fields
6. Restore lastDayGuests from save (for crowding penalty on next tick)
7. Restore ChartHistory and DayStats[]
8. Game is ready — do not run a tick until the player advances the day
```

### Save Triggers

| Event | Save |
|---|---|
| Player places an object | Yes |
| Player demolishes an object | Yes |
| Player buys hotel upgrade | Yes |
| End of day tick completes | Yes |
| Player opens a menu | No |

Auto-save to a single save slot. No manual save UI required in MVP.

---

## Full Structure Map

```
GameState
├── version
├── dayNumber
├── MapState
│   ├── cols, rows
│   ├── TileState[]          (flat grid)
│   └── PlacedObject[]       (all placed objects)
├── HotelState
│   ├── roomCount, qualityLevel
│   └── derived: occupancyRate, bookedRooms, hotelCasinoGuests
├── EconomyState
│   ├── cash, cumulativeIncome, lastDayGuests
│   ├── cached counts: slotCount, smallTableCount, etc.
│   └── derived: casinoCapacity, resortRating, guests, revenue
├── ProgressionState
│   ├── activeGoalIndex
│   └── completedGoals[]
├── DayStats[]               (history, max 30)
└── ChartHistory             (parallel arrays, max 30)
```

---

*Data model version: MVP 1.1 — matches ruleset MVP 1.1. Update saveVersion string on any breaking schema change.*
