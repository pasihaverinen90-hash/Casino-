# Casino Resort Manager — MVP Technical Architecture
**Solo developer + AI assistance. Simple, expandable, not overengineered.**

---

## Technology Choice

This document is **framework-agnostic** at the architecture level. The patterns apply equally to:
- **Web:** TypeScript + React (recommended for fastest prototyping with AI assistance)
- **Mobile:** React Native or Expo (if native mobile is required)
- **Game engine:** Godot 4 with GDScript (if grid/animation fidelity matters more than speed)

The rest of this document uses TypeScript naming conventions. GDScript equivalents are straightforward.

**Recommendation for solo dev + AI:** TypeScript + React running in browser. Fastest iteration, easiest AI code generation, no build pipeline complexity, runs on any device via browser. Grid rendering via Canvas2D or simple CSS grid for prototype.

---

## Core Architecture Principle

**Strict separation between three layers:**

```
┌─────────────────────────────────────────┐
│              UI Layer                   │  React components, panels, HUD
│         (reads state, fires events)     │
├─────────────────────────────────────────┤
│           Controller Layer              │  Event handlers, action dispatchers
│      (translates UI → game logic)       │
├─────────────────────────────────────────┤
│          Game Logic Layer               │  Pure functions, formulas, simulation
│     (no UI imports, no side effects)    │
└─────────────────────────────────────────┘
```

**Rule:** Game logic never imports UI. UI never runs formulas directly. The controller is the only layer that touches both.

This means every formula, simulation step, and validation rule can be tested without rendering anything.

---

## 1. Main Modules / Systems

Eight modules. Each is a folder containing related files. No module is responsible for more than one domain.

```
game/
├── core/           GameState container, initialisation, constants
├── simulation/     Daily tick, all formulas
├── placement/      Placement validation, footprint computation
├── economy/        Build/demolish actions, hotel purchases, cash management
├── progression/    Goal definitions, goal checking
├── stats/          DayStats recording, ChartHistory management
├── persistence/    Save, load, serialisation
└── ui/             All React components and rendering
```

---

## 2. Responsibility of Each Module

### `core/`
**Owns:** `GameState` type definition, initial state factory, all constants.
**Does not:** run simulation, render anything, read from storage.

```
core/
├── GameState.ts       // all interfaces and types
├── constants.ts       // GRID_COLS, HISTORY_MAX, REVENUE_PER_GUEST, etc.
├── initialState.ts    // createNewGame(): GameState
└── objectDefs.ts      // OBJECT_DEFINITIONS record, static data only
```

`initialState.ts` is the single place where a new game is constructed. Loading from save goes through `persistence/`, not here.

---

### `simulation/`
**Owns:** `runDailySimulation()`, all formulas used during a tick.
**Does not:** mutate `GameState` directly — returns a `SimulationResult` that the controller applies.

```
simulation/
├── SimulationTypes.ts    // SimulationInput, SimulationResult, DemandSplit
├── runDailySimulation.ts // main entry point
├── rating.ts             // computeResortRating(), crowding penalty
├── guests.ts             // walkInGuests, hotelGuests, totalGuests
├── revenue.ts            // dailyRevenue, per-object breakdown
├── demand.ts             // assignDemand() — distributes guests across objects
└── hotel.ts              // occupancy, bookedRooms
```

Each formula file exports one or two pure functions. No file in `simulation/` imports from `ui/` or `persistence/`.

**Testing:** Every file in `simulation/` is independently unit-testable. Pass numbers in, get numbers out.

---

### `placement/`
**Owns:** `validatePlacement()`, footprint computation, wall detection, door access checks.
**Does not:** modify the grid, charge cash, or render ghosts.

```
placement/
├── PlacementTypes.ts       // PlacementRequest, ValidationResult enum
├── validatePlacement.ts    // main entry point, ordered checks
├── footprint.ts            // computeFootprint(), getTile(), isInBounds(), isFreeFloor()
├── wallValidation.ts       // detectWallDirection(), isValidWallRun()
└── accessValidation.ts     // validateSlotAccess(), validateTableAccess(), validateDoorAccess()
```

`validatePlacement()` returns a `ValidationResult` enum value. The controller reads the result and decides what to do. The placement module never decides — it only evaluates.

---

### `economy/`
**Owns:** build actions, demolish actions, hotel purchase actions, cash mutation helpers.
**Does not:** run the daily simulation, validate placement (it calls `placement/` for that).

```
economy/
├── buildActions.ts     // placeObject(), demolishObject()
├── hotelActions.ts     // buyRooms(), upgradeQuality()
└── cashHelpers.ts      // canAfford(), deductCash(), addCash()
```

Each action function takes `GameState` and action parameters, validates preconditions, mutates state, and returns a result describing what changed. The controller applies the result to the live state.

Example signature:
```typescript
// Returns null if placement invalid or unaffordable
function placeObject(
  state:   GameState,
  request: PlacementRequest
): PlaceObjectResult | null
```

---

### `progression/`
**Owns:** goal definitions, `isGoalMet()`, `checkAndAdvanceGoal()`.
**Does not:** apply rewards (that is the controller's job), render goal UI.

```
progression/
├── goalDefinitions.ts    // GOAL_DEFINITIONS array, GOAL_REWARDS array
├── goalChecks.ts         // isGoalMet(), buildGoalCheckState()
└── progressionActions.ts // checkAndAdvanceGoal() — returns GoalAdvanceResult
```

`checkAndAdvanceGoal()` returns a result describing whether a goal was completed and which index. The controller fires the reward and any UI event.

---

### `stats/`
**Owns:** building `DayStats` from `SimulationResult`, appending to history, trimming to 60 entries.
**Does not:** render charts, format display values.

```
stats/
├── statsTypes.ts       // DayStats, ChartHistory, StatsHistory interfaces
├── recordDay.ts        // buildDayStats(), appendDayStats()
└── chartHelpers.ts     // buildPolylinePoints(), getYMax(), getXAxisLabels()
```

`chartHelpers.ts` is the only rendering-adjacent file in the game logic layer. It produces SVG coordinate strings from raw number arrays — still a pure function with no DOM access.

---

### `persistence/`
**Owns:** `saveGame()`, `loadGame()`, serialisation, save version checking.
**Does not:** know about the UI, trigger auto-saves (the controller decides when to save).

```
persistence/
├── SaveTypes.ts      // SaveData interface, SavedPlacedObject
├── saveGame.ts       // serialise GameState → SaveData → JSON string
├── loadGame.ts       // JSON string → SaveData → reconstruct full GameState
└── migration.ts      // handle older save versions (empty for MVP 1.0)
```

Storage backend is a single `localStorage` key for web prototype. Swap to file I/O or cloud sync post-MVP by changing only this module.

---

### `ui/`
**Owns:** all React components, layout, rendering, user input handling.
**Does not:** run formulas, mutate game state directly, read from storage.

```
ui/
├── App.tsx                  // root component, state container, controller glue
├── GameController.ts        // event handlers that bridge UI → game logic
├── screens/
│   ├── GameScreen.tsx        // main layout: HUD + grid + ticker + action bar
│   └── StatsScreen.tsx       // full-screen stats overlay
├── hud/
│   ├── TopHUD.tsx
│   └── GoalTicker.tsx
├── grid/
│   ├── CasinoGrid.tsx        // renders the tile grid
│   ├── PlacedObjectLayer.tsx // renders placed objects on the grid
│   └── GhostLayer.tsx        // renders the placement ghost
├── panels/
│   ├── BuildPanel.tsx
│   ├── HotelPanel.tsx
│   └── GoalsPanel.tsx
├── charts/
│   ├── ChartCard.tsx         // one reusable chart card component
│   └── Polyline.tsx          // SVG polyline wrapper
├── shared/
│   ├── Button.tsx
│   ├── Panel.tsx             // slide-up panel container
│   └── formatters.ts         // formatCash(), formatRating(), formatOccupancy()
└── hooks/
    ├── useGameState.ts       // exposes game state + action dispatchers to components
    └── usePlacementMode.ts   // manages ghost position, validation state, confirm/cancel
```

`GameController.ts` is the critical seam. It imports from `economy/`, `simulation/`, `progression/`, `stats/`, and `persistence/`. It is the only file in `ui/` that imports game logic. All other UI files import from `GameController.ts` or `useGameState.ts` only.

---

## 3. Update Flow Between Modules

Two flows. Every user action goes through one of them.

### Flow A — Build / Demolish / Hotel Purchase

```
User taps in UI
    │
    ▼
GameController.handleBuildAction(request)
    │
    ├─ placement/validatePlacement(request, state)  → ValidationResult
    │       if FAIL → return error to UI, stop
    │
    ├─ economy/placeObject(state, request)          → PlaceObjectResult
    │       deduct cash, add to placedObjects, update tile grid
    │       update cached counts (slotCount, barExists, etc.)
    │
    ├─ progression/checkAndAdvanceGoal(state)       → GoalAdvanceResult?
    │       if goal met → apply reward cash, fire onGoalComplete
    │
    ├─ persistence/saveGame(state)                  → write to storage
    │
    └─ setState(newState)                           → React re-render
```

### Flow B — Advance Day

```
User taps "Day ▶"
    │
    ▼
GameController.handleAdvanceDay()
    │
    ├─ simulation/runDailySimulation(input)         → SimulationResult
    │       (pure function — no state mutation)
    │
    ├─ Apply SimulationResult to state
    │       economy: cash, cumulativeIncome, lastDayGuests, derived fields
    │       hotel: occupancyRate, bookedRooms, hotelCasinoGuests
    │
    ├─ stats/recordDay(state, result)               → DayStats
    │       append to statsHistory + chartHistory, trim to 60
    │
    ├─ progression/checkAndAdvanceGoal(state)       → GoalAdvanceResult?
    │       if goal met → apply reward, fire onGoalComplete
    │       if game complete → fire onGameComplete
    │
    ├─ state.dayNumber += 1
    │
    ├─ persistence/saveGame(state)                  → write to storage
    │
    └─ setState(newState)                           → React re-render
```

No other flows exist in MVP. Every user action is either A or B.

---

## 4. Save / Load Strategy

### Storage

Single `localStorage` key: `"casino_resort_save"`.

```typescript
const SAVE_KEY = "casino_resort_save"

function saveGame(state: GameState): void {
  const data: SaveData = serialise(state)
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  const data: SaveData = JSON.parse(raw)
  return deserialise(data)    // rebuilds full GameState from minimal save
}
```

### When to save

The controller calls `saveGame()` at the end of every Flow A and Flow B. No debounce, no manual save button. The write is small (~5–10 KB) and synchronous in MVP — no async needed.

### On app start

```typescript
function initGame(): GameState {
  const loaded = loadGame()
  if (loaded) return loaded
  return createNewGame()    // core/initialState.ts
}
```

### What is saved vs rebuilt

| Data | Strategy |
|---|---|
| `placedObjects[]` (stripped) | Saved |
| `roomCount`, `qualityLevel` | Saved |
| `cash`, `cumulativeIncome`, `lastDayGuests` | Saved |
| `activeGoalIndex`, `completedGoals[]` | Saved |
| `statsHistory`, `chartHistory` | Saved |
| `dayNumber` | Saved |
| Tile grid (all 864 tiles) | **Rebuilt** from `placedObjects` on load |
| Cached counts (`slotCount`, `barExists`, etc.) | **Rebuilt** from `placedObjects` on load |
| Derived hotel values (`occupancyRate`, etc.) | **Rebuilt** by running formulas once after load |
| Object definitions, goal definitions, constants | **Never saved** — hardcoded |

### Save size estimate

- 60 × DayStats records: ~60 fields × 60 days × ~8 bytes = ~29 KB worst case
- PlacedObjects: ~20 objects × ~100 bytes each = ~2 KB
- Everything else: ~1 KB
- **Total: well under 50 KB.** No compression needed.

### Migration

`migration.ts` is empty in MVP 1.0. Add version-check logic here when the save format changes. Pattern:

```typescript
function migrate(data: any): SaveData {
  if (data.saveVersion === "1.0.0") return migrateTo110(data)
  if (data.saveVersion === "1.1.0") return data
  throw new Error(`Unknown save version: ${data.saveVersion}`)
}
```

---

## 5. Where Formulas Should Live

One rule: **formulas live in `simulation/` or `placement/`, never anywhere else.**

| Formula | File |
|---|---|
| `computeResortRating()` | `simulation/rating.ts` |
| `crowdingPenalty()` | `simulation/rating.ts` |
| `walkInGuests()` | `simulation/guests.ts` |
| `hotelOccupancy()`, `bookedRooms()` | `simulation/hotel.ts` |
| `dailyRevenue()`, per-object rates | `simulation/revenue.ts` |
| `assignDemand()` | `simulation/demand.ts` |
| `casinoCapacity` (formula) | `simulation/guests.ts` or `core/constants.ts` |
| `validatePlacement()` and sub-checks | `placement/validatePlacement.ts` + sub-files |
| Demolish refund amount | `economy/buildActions.ts` — reads `DEMOLISH_REFUND_RATE` from `core/constants.ts` |
| Goal conditions | `progression/goalChecks.ts` |
| Chart polyline coordinates | `stats/chartHelpers.ts` |

**Display formatting** (`"4,820"`, `"2.3 ★"`, `"75%"`) lives in `ui/shared/formatters.ts`. These are not formulas — they are presentation transforms.

**Constants** live in `core/constants.ts`. Formulas import constants; constants never import formulas.

---

## 6. Separating Game Logic from UI

The separation is enforced by a simple import rule:

```
game logic files    → NEVER import from ui/
ui files            → MAY import from game logic
GameController.ts   → imports from both; is the only bridge
```

In practice this means:

- `simulation/rating.ts` knows nothing about React, DOM, or components.
- `ui/panels/HotelPanel.tsx` knows nothing about occupancy formulas — it only calls `controller.buyRooms(option)` and reads display values from state.
- `GameController.ts` handles the translation: it calls `economy/hotelActions.buyRooms()`, applies the result, triggers a save, and calls `setState()`.

### State management

For a solo dev + AI prototype, **React `useState` or `useReducer` at the App level is sufficient.** No Redux, no Zustand, no external state library.

```typescript
// App.tsx
const [gameState, setGameState] = useState<GameState>(initGame)

// Pass setGameState into GameController
// Pass gameState (read-only) into all components via props or context
```

Use React Context to avoid prop-drilling `gameState` into deeply nested components:

```typescript
const GameStateContext = createContext<GameState | null>(null)
const GameControllerContext = createContext<GameController | null>(null)
```

Components read from `GameStateContext`. User actions call methods on `GameControllerContext`. Neither context contains formulas.

---

## 7. Recommended Folder / File Structure

```
src/
│
├── core/
│   ├── GameState.ts
│   ├── constants.ts
│   ├── initialState.ts
│   └── objectDefs.ts
│
├── simulation/
│   ├── SimulationTypes.ts
│   ├── runDailySimulation.ts
│   ├── rating.ts
│   ├── guests.ts
│   ├── revenue.ts
│   ├── demand.ts
│   └── hotel.ts
│
├── placement/
│   ├── PlacementTypes.ts
│   ├── validatePlacement.ts
│   ├── footprint.ts
│   ├── wallValidation.ts
│   └── accessValidation.ts
│
├── economy/
│   ├── buildActions.ts
│   ├── hotelActions.ts
│   └── cashHelpers.ts
│
├── progression/
│   ├── goalDefinitions.ts
│   ├── goalChecks.ts
│   └── progressionActions.ts
│
├── stats/
│   ├── statsTypes.ts
│   ├── recordDay.ts
│   └── chartHelpers.ts
│
├── persistence/
│   ├── SaveTypes.ts
│   ├── saveGame.ts
│   ├── loadGame.ts
│   └── migration.ts
│
└── ui/
    ├── App.tsx
    ├── GameController.ts
    ├── screens/
    │   ├── GameScreen.tsx
    │   └── StatsScreen.tsx
    ├── hud/
    │   ├── TopHUD.tsx
    │   └── GoalTicker.tsx
    ├── grid/
    │   ├── CasinoGrid.tsx
    │   ├── PlacedObjectLayer.tsx
    │   └── GhostLayer.tsx
    ├── panels/
    │   ├── BuildPanel.tsx
    │   ├── HotelPanel.tsx
    │   └── GoalsPanel.tsx
    ├── charts/
    │   ├── ChartCard.tsx
    │   └── Polyline.tsx
    ├── shared/
    │   ├── Button.tsx
    │   ├── Panel.tsx
    │   └── formatters.ts
    └── hooks/
        ├── useGameState.ts
        └── usePlacementMode.ts
```

**Total files: ~45.** Each file has one clear job. No file is longer than ~150 lines in a well-structured MVP. All game logic files are testable with zero UI setup.

---

## Build Order for Solo Dev

Implement in this order. Each phase is independently runnable and testable.

```
Phase 1 — Core types and simulation (no UI)
  core/GameState.ts + constants.ts + initialState.ts + objectDefs.ts
  simulation/ — all files
  progression/goalChecks.ts
  → Test: run runDailySimulation() in Node, verify numbers

Phase 2 — Grid and placement (no UI)
  placement/ — all files
  → Test: call validatePlacement() with mock MapState, verify ValidationResult values

Phase 3 — Actions and persistence
  economy/ — all files
  persistence/ — all files
  stats/ — all files
  → Test: place objects, run days, save, reload, verify state identity

Phase 4 — UI skeleton
  ui/App.tsx + GameController.ts
  ui/screens/GameScreen.tsx (empty grid)
  ui/hud/TopHUD.tsx
  ui/hud/GoalTicker.tsx
  ui/shared/Button.tsx + Panel.tsx
  → Milestone: see the grid, HUD updates when day advances

Phase 5 — Build and placement UI
  ui/grid/ — all files
  ui/panels/BuildPanel.tsx
  ui/hooks/usePlacementMode.ts
  → Milestone: place a slot machine on the grid

Phase 6 — Hotel, goals, stats
  ui/panels/HotelPanel.tsx + GoalsPanel.tsx
  ui/screens/StatsScreen.tsx
  ui/charts/ — all files
  → Milestone: full loop playable end to end

Phase 7 — Polish (post-first-playtest)
  Animations, transitions, sound hooks
  End-state screen
  Edge case handling and error states
```

---

## What Not to Build in MVP

| Temptation | Why to skip |
|---|---|
| Redux / complex state management | `useState` + controller is sufficient for one screen |
| Backend / server / database | `localStorage` covers the full MVP save requirement |
| WebSockets or real-time sync | Single-player, no multiplayer in MVP |
| Asset pipeline / sprite atlas | CSS backgrounds or emoji placeholders work fine for a prototype |
| Unit test framework setup | Test formulas manually in the browser console first; add Jest post-MVP |
| CI/CD pipeline | Local dev + direct deploy (Vercel/Netlify drag-and-drop) for MVP |
| TypeScript strict mode initially | Enable it after Phase 3 when types are stable |

---

*Architecture version: MVP 1.1 — matches all MVP 1.1 design documents.*
