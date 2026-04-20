# Casino Resort Manager — Core MVP Pseudocode
**Ready to translate directly into TypeScript, C#, or GDScript.**
**Matches all MVP 1.1 design documents.**

---

## Conventions

```
CONSTANTS are in ALL_CAPS
types are in PascalCase
variables and functions are in camelCase
// single-line comments explain intent
/* multi-line comments explain a block */
→ means "returns"
```

---

## 1. initializeGame()

Creates a brand new game state from scratch. Called only when no save file exists.

```
FUNCTION initializeGame() → GameState

  // ── Grid ─────────────────────────────────────────────────────────────────
  tiles = new Array(GRID_COLS * GRID_ROWS)

  FOR row = 0 TO GRID_ROWS - 1
    FOR col = 0 TO GRID_COLS - 1
      tile = new TileState
      tile.col            = col
      tile.row            = row
      tile.occupiedByObjId = null

      /* Assign tile types based on position */
      IF col == 0 OR col == GRID_COLS - 1 OR row == 0 OR row == GRID_ROWS - 1
        tile.tileType = WALL
      ELSE IF col >= LOBBY_START_COL AND col <= LOBBY_END_COL
        tile.tileType = LOBBY
      ELSE
        tile.tileType = FLOOR

      tiles[row * GRID_COLS + col] = tile

  // ── Pre-placed fixed objects ──────────────────────────────────────────────
  // Mark hotel reception, elevators, entrance tiles as BLOCKED
  markPreplacedObjects(tiles)      // sets tileType = BLOCKED for fixed footprints

  // ── Assemble state ────────────────────────────────────────────────────────
  state = new GameState

  state.version   = "1.1.0"
  state.dayNumber = 1

  state.map.cols          = GRID_COLS
  state.map.rows          = GRID_ROWS
  state.map.tiles         = tiles
  state.map.placedObjects = []

  state.hotel.roomCount         = 0
  state.hotel.qualityLevel      = 1
  state.hotel.occupancyRate     = 0.0
  state.hotel.bookedRooms       = 0
  state.hotel.hotelCasinoGuests = 0

  state.economy.cash              = STARTING_CASH   // 7500
  state.economy.cumulativeIncome  = 0
  state.economy.lastDayGuests     = 0
  state.economy.slotCount         = 0
  state.economy.smallTableCount   = 0
  state.economy.largeTableCount   = 0
  state.economy.wcCount           = 0
  state.economy.barExists         = false
  state.economy.casinoCapacity    = 0
  state.economy.resortRating      = 1.75  // base 1.5 + quality level 1 × 0.25
  state.economy.totalGuests       = 0
  state.economy.walkInGuests      = 0
  state.economy.dailyRevenue      = 0
  state.economy.prevCrowdingPenalty = 0.0

  state.progression.activeGoalIndex = 0
  state.progression.completedGoals  = [false × 10]

  state.stats.records = []
  state.stats.charts  = new ChartHistory   // all arrays empty

  RETURN state
```

---

## 2. validatePlacement()

Runs all placement checks in strict order. Returns the first failure found,
or VALID if all checks pass.

```
FUNCTION validatePlacement(request, mapState, economyState, cash) → ValidationResult
  /*
    request: { objectType, col, row, rotated, variant }
  */

  def = OBJECT_DEFINITIONS[request.objectType]

  // Resolve actual footprint dimensions after rotation
  IF request.rotated
    w = def.footprintH
    h = def.footprintW
  ELSE
    w = def.footprintW
    h = def.footprintH

  // ── Check 1: Instance limit ───────────────────────────────────────────────
  IF def.maxCount != null
    IF request.objectType == BAR AND economyState.barExists
      RETURN FAIL_LIMIT

  // ── Check 2: Affordability ────────────────────────────────────────────────
  IF cash < def.cost
    RETURN FAIL_AFFORD

  // ── Check 3: Bounds ───────────────────────────────────────────────────────
  IF request.col < 0 OR request.row < 0
    RETURN FAIL_OUT_OF_BOUNDS
  IF request.col + w > GRID_COLS OR request.row + h > GRID_ROWS
    RETURN FAIL_OUT_OF_BOUNDS

  // ── Compute footprint once — reused in checks 4 and 5 ────────────────────
  footprint = computeFootprint(request.col, request.row, w, h)

  // ── Check 4: Zone ─────────────────────────────────────────────────────────
  FOR EACH coord IN footprint
    tile = getTile(mapState, coord.col, coord.row)
    IF tile.tileType != FLOOR
      RETURN FAIL_WRONG_ZONE

  // ── Check 5: Collision ────────────────────────────────────────────────────
  FOR EACH coord IN footprint
    tile = getTile(mapState, coord.col, coord.row)
    IF tile.occupiedByObjId != null
      RETURN FAIL_COLLISION

  // ── Check 6 & 7: Wall objects only ───────────────────────────────────────
  IF def.isWallObject
    wallDir = detectWallDirection(request, mapState, w, h)
    IF wallDir == null
      RETURN FAIL_WALL_INVALID

    FOR EACH doorCoord IN getDoorTiles(request, w, h)
      inward = getInwardNeighbour(doorCoord, wallDir)
      IF inward == null OR NOT isFreeFloor(mapState, inward)
        RETURN FAIL_DOOR_BLOCKED

  // ── Check 8: Floor object access ─────────────────────────────────────────
  IF NOT def.isWallObject
    IF request.objectType == SLOT_MACHINE
      freeNeighbours = countFreeCardinalNeighbours(mapState, request.col, request.row)
      IF freeNeighbours == 0
        RETURN FAIL_NO_ACCESS

    IF request.objectType == SMALL_TABLE OR request.objectType == LARGE_TABLE
      accessibleSides = countAccessibleSides(mapState, request.col, request.row, w, h)
      IF accessibleSides < 2
        RETURN FAIL_NO_ACCESS

  RETURN VALID


// ── Helpers ───────────────────────────────────────────────────────────────

FUNCTION computeFootprint(col, row, w, h) → TileCoord[]
  tiles = []
  FOR r = row TO row + h - 1
    FOR c = col TO col + w - 1
      tiles.append({ col: c, row: r })
  RETURN tiles

FUNCTION getTile(mapState, col, row) → TileState
  RETURN mapState.tiles[row * GRID_COLS + col]

FUNCTION isFreeFloor(mapState, coord) → bool
  IF coord.col < 0 OR coord.col >= GRID_COLS RETURN false
  IF coord.row < 0 OR coord.row >= GRID_ROWS RETURN false
  tile = getTile(mapState, coord.col, coord.row)
  RETURN tile.tileType == FLOOR AND tile.occupiedByObjId == null

FUNCTION countFreeCardinalNeighbours(mapState, col, row) → int
  count = 0
  FOR EACH (dc, dr) IN [(-1,0),(1,0),(0,-1),(0,1)]
    IF isFreeFloor(mapState, { col: col+dc, row: row+dr })
      count++
  RETURN count

FUNCTION countAccessibleSides(mapState, col, row, w, h) → int
  sides = 0
  // Top
  FOR c = col TO col + w - 1
    IF isFreeFloor(mapState, { col: c, row: row - 1 })
      sides++; BREAK
  // Bottom
  FOR c = col TO col + w - 1
    IF isFreeFloor(mapState, { col: c, row: row + h })
      sides++; BREAK
  // Left
  FOR r = row TO row + h - 1
    IF isFreeFloor(mapState, { col: col - 1, row: r })
      sides++; BREAK
  // Right
  FOR r = row TO row + h - 1
    IF isFreeFloor(mapState, { col: col + w, row: r })
      sides++; BREAK
  RETURN sides
```

---

## 3. placeObject()

Executes a validated placement. Mutates map state, deducts cash, updates cached counts.
Call validatePlacement() before this — this function trusts the request is valid.

```
FUNCTION placeObject(state, request) → PlacedObject

  def = OBJECT_DEFINITIONS[request.objectType]

  IF request.rotated
    w = def.footprintH
    h = def.footprintW
  ELSE
    w = def.footprintW
    h = def.footprintH

  // ── Build the placed object record ────────────────────────────────────────
  obj = new PlacedObject
  obj.id      = generateUniqueId()
  obj.type    = request.objectType
  obj.col     = request.col
  obj.row     = request.row
  obj.rotated = request.rotated
  obj.variant = request.variant
  obj.tiles   = computeFootprint(request.col, request.row, w, h)

  // ── Mark tiles as occupied ────────────────────────────────────────────────
  FOR EACH coord IN obj.tiles
    getTile(state.map, coord.col, coord.row).occupiedByObjId = obj.id

  // ── Add to placed objects list ────────────────────────────────────────────
  state.map.placedObjects.append(obj)

  // ── Deduct cost ───────────────────────────────────────────────────────────
  state.economy.cash -= def.cost

  // ── Update cached counts ──────────────────────────────────────────────────
  updateObjectCounts(state)

  RETURN obj


FUNCTION demolishObject(state, objectId) → int   // returns refund amount
  obj = findObjectById(state.map.placedObjects, objectId)
  IF obj == null RETURN 0

  def      = OBJECT_DEFINITIONS[obj.type]
  refund   = floor(def.cost * DEMOLISH_REFUND_RATE)   // 50%, rounded down

  // ── Free tiles ────────────────────────────────────────────────────────────
  FOR EACH coord IN obj.tiles
    getTile(state.map, coord.col, coord.row).occupiedByObjId = null

  // ── Remove from list ──────────────────────────────────────────────────────
  state.map.placedObjects.remove(obj)

  // ── Add refund ────────────────────────────────────────────────────────────
  state.economy.cash += refund

  // ── Update cached counts ──────────────────────────────────────────────────
  updateObjectCounts(state)

  RETURN refund


FUNCTION updateObjectCounts(state)
  /* Recount from placedObjects — called after any placement or demolition */
  state.economy.slotCount       = 0
  state.economy.smallTableCount = 0
  state.economy.largeTableCount = 0
  state.economy.wcCount         = 0
  state.economy.barExists       = false

  FOR EACH obj IN state.map.placedObjects
    IF obj.type == SLOT_MACHINE   state.economy.slotCount++
    IF obj.type == SMALL_TABLE    state.economy.smallTableCount++
    IF obj.type == LARGE_TABLE    state.economy.largeTableCount++
    IF obj.type == WC             state.economy.wcCount++
    IF obj.type == BAR            state.economy.barExists = true

  state.economy.casinoCapacity = calculateCasinoCapacity(state.economy)
```

---

## 4. calculateCasinoCapacity()

```
FUNCTION calculateCasinoCapacity(economy) → int

  RETURN economy.slotCount
       + (4 * economy.smallTableCount)
       + (6 * economy.largeTableCount)

  // WC and Bar contribute 0
```

---

## 5. calculateResortRating()

```
FUNCTION calculateResortRating(economy, hotel, lastDayGuests, prevCrowdingPenalty) → float

  casinoCapacity = calculateCasinoCapacity(economy)

  // ── Crowding penalty (smoothed EMA) ──────────────────────────────────────
  rawPenalty = 0.0
  IF casinoCapacity > 0 AND lastDayGuests > 0
    ratio      = lastDayGuests / casinoCapacity
    rawPenalty = max(0.0, (ratio - 1.0) * 0.5)

  crowdingPenalty = (CROWDING_SMOOTH * rawPenalty)
                  + ((1.0 - CROWDING_SMOOTH) * prevCrowdingPenalty)
  // CROWDING_SMOOTH = 0.4

  // ── Static contributions ──────────────────────────────────────────────────
  rawRating = RATING_BASE                             // 1.50
            + (0.02 * economy.slotCount)
            + (0.18 * economy.smallTableCount)
            + (0.25 * economy.largeTableCount)
            + (0.20 * economy.wcCount)
            + (economy.barExists ? 0.35 : 0.0)
            + (0.03 * hotel.roomCount)
            + (0.25 * hotel.qualityLevel)
            - crowdingPenalty

  resortRating = clamp(rawRating, 1.0, 5.0)

  RETURN { resortRating, crowdingPenalty }
  // caller stores both: economy.resortRating and economy.prevCrowdingPenalty
```

---

## 6. calculateHotelOccupancy()

```
FUNCTION calculateHotelOccupancy(hotel, resortRating) → { occupancyRate, bookedRooms, hotelCasinoGuests }

  IF hotel.roomCount == 0
    RETURN { occupancyRate: 0.0, bookedRooms: 0, hotelCasinoGuests: 0 }

  occupancyRate = min(1.0,
      0.35
    + (0.10 * resortRating)
    + (0.08 * hotel.qualityLevel)
  )

  bookedRooms       = floor(hotel.roomCount * occupancyRate)
  hotelCasinoGuests = round(bookedRooms * 0.9)

  RETURN { occupancyRate, bookedRooms, hotelCasinoGuests }
```

---

## 7. calculateGuestFlow()

```
FUNCTION calculateGuestFlow(economy, hotelCasinoGuests) → { walkInGuests, totalGuests }

  casinoCapacity = economy.casinoCapacity

  // No casino built → no walk-ins
  IF casinoCapacity == 0
    RETURN { walkInGuests: 0, totalGuests: hotelCasinoGuests }

  ratingMultiplier   = 0.6 + (economy.resortRating / 5.0)
  capacityMultiplier = min(1.5, casinoCapacity / 30.0)

  walkInGuests = round(BASE_DEMAND * ratingMultiplier * capacityMultiplier)
  // BASE_DEMAND = 30

  totalGuests = walkInGuests + hotelCasinoGuests

  RETURN { walkInGuests, totalGuests }
```

---

## 8. calculateDailyRevenue()

```
FUNCTION calculateDailyRevenue(economy, hotel, totalGuests, bookedRooms) → RevenueResult

  // ── Demand split ──────────────────────────────────────────────────────────
  slotCapacity  = economy.slotCount
  tableCapacity = (4 * economy.smallTableCount) + (6 * economy.largeTableCount)
  totalFloorCap = slotCapacity + tableCapacity

  IF totalFloorCap == 0
    slotsGuests      = 0
    smallTableGuests = 0
    largeTableGuests = 0
  ELSE
    slotsGuests  = round(totalGuests * (slotCapacity / totalFloorCap))
    tableGuests  = totalGuests - slotsGuests   // remainder avoids rounding drift

    IF tableCapacity == 0
      smallTableGuests = 0
      largeTableGuests = 0
    ELSE
      smallShare       = (4 * economy.smallTableCount) / tableCapacity
      smallTableGuests = round(tableGuests * smallShare)
      largeTableGuests = tableGuests - smallTableGuests

  // ── Bar draw (independent, not subtracted from floor) ────────────────────
  barGuests = economy.barExists ? round(totalGuests * 0.15) : 0

  // ── Revenue per source ────────────────────────────────────────────────────
  slotRevenue       = slotsGuests      * 12
  smallTableRevenue = smallTableGuests * 22
  largeTableRevenue = largeTableGuests * 30
  barRevenue        = barGuests        * 8
  hotelRoomRevenue  = bookedRooms      * 25

  totalRevenue = slotRevenue + smallTableRevenue + largeTableRevenue
               + barRevenue + hotelRoomRevenue

  RETURN {
    slotRevenue,
    smallTableRevenue,
    largeTableRevenue,
    barRevenue,
    hotelRoomRevenue,
    totalRevenue,
    slotsGuests,
    smallTableGuests,
    largeTableGuests,
    barGuests,
  }
```

---

## 9. runDailySimulation()

The main tick. Pure function — takes state in, returns result out. Does not mutate anything.

```
FUNCTION runDailySimulation(state) → SimulationResult

  economy = state.economy
  hotel   = state.hotel

  // ── Step 1: Casino capacity ───────────────────────────────────────────────
  casinoCapacity = calculateCasinoCapacity(economy)

  // ── Steps 2 & 3: Crowding penalty + Resort rating ─────────────────────────
  { resortRating, crowdingPenalty } = calculateResortRating(
    economy,
    hotel,
    economy.lastDayGuests,
    economy.prevCrowdingPenalty
  )

  // ── Steps 4 & 5: Hotel occupancy + hotel casino guests ───────────────────
  { occupancyRate, bookedRooms, hotelCasinoGuests } =
    calculateHotelOccupancy(hotel, resortRating)

  // ── Steps 6 & 7: Walk-in + total guests ──────────────────────────────────
  // Temporarily update resortRating in a local copy for guest formula
  localEconomy              = copy(economy)
  localEconomy.resortRating = resortRating
  localEconomy.casinoCapacity = casinoCapacity

  { walkInGuests, totalGuests } = calculateGuestFlow(localEconomy, hotelCasinoGuests)

  // ── Steps 8 & 9: Revenue ──────────────────────────────────────────────────
  revenueResult = calculateDailyRevenue(economy, hotel, totalGuests, bookedRooms)

  // ── Step 10: Costs (no-op in MVP) ─────────────────────────────────────────
  dailyCosts = 0

  // ── Step 11: Net income ───────────────────────────────────────────────────
  netIncome = revenueResult.totalRevenue - dailyCosts

  // ── Step 12: Updated economy values ──────────────────────────────────────
  newCash            = economy.cash + netIncome
  newCumulativeIncome = economy.cumulativeIncome + netIncome

  // ── Step 13: Persist lastDayGuests for next tick ─────────────────────────
  newLastDayGuests = totalGuests

  // ── Step 14: Build DayStats snapshot ─────────────────────────────────────
  dayStats = new DayStats
  dayStats.day                = state.dayNumber
  dayStats.totalGuests        = totalGuests
  dayStats.walkInGuests       = walkInGuests
  dayStats.hotelGuests        = hotelCasinoGuests
  dayStats.dailyRevenue       = revenueResult.totalRevenue
  dayStats.dailyCosts         = dailyCosts
  dayStats.netIncome          = netIncome
  dayStats.cumulativeIncome   = newCumulativeIncome
  dayStats.cash               = newCash
  dayStats.slotRevenue        = revenueResult.slotRevenue
  dayStats.tableRevenue       = revenueResult.smallTableRevenue + revenueResult.largeTableRevenue
  dayStats.barRevenue         = revenueResult.barRevenue
  dayStats.hotelRoomRevenue   = revenueResult.hotelRoomRevenue
  dayStats.occupancyRate      = occupancyRate
  dayStats.bookedRooms        = bookedRooms
  dayStats.roomCount          = hotel.roomCount
  dayStats.casinoCapacity     = casinoCapacity
  dayStats.crowdingPenalty    = crowdingPenalty
  dayStats.resortRating       = resortRating

  // ── Return all computed values ────────────────────────────────────────────
  RETURN {
    casinoCapacity,
    resortRating,
    crowdingPenalty,
    occupancyRate,
    bookedRooms,
    hotelCasinoGuests,
    walkInGuests,
    totalGuests,
    revenueResult,
    dailyCosts,
    netIncome,
    newCash,
    newCumulativeIncome,
    newLastDayGuests,
    dayStats,
  }


// ── Caller: apply result to state ─────────────────────────────────────────
// This runs in the controller AFTER runDailySimulation() returns

FUNCTION applySimulationResult(state, result)

  // Economy
  state.economy.cash                = result.newCash
  state.economy.cumulativeIncome    = result.newCumulativeIncome
  state.economy.lastDayGuests       = result.newLastDayGuests
  state.economy.prevCrowdingPenalty = result.crowdingPenalty
  state.economy.resortRating        = result.resortRating
  state.economy.casinoCapacity      = result.casinoCapacity
  state.economy.totalGuests         = result.totalGuests
  state.economy.walkInGuests        = result.walkInGuests
  state.economy.dailyRevenue        = result.revenueResult.totalRevenue

  // Hotel
  state.hotel.occupancyRate     = result.occupancyRate
  state.hotel.bookedRooms       = result.bookedRooms
  state.hotel.hotelCasinoGuests = result.hotelCasinoGuests

  // Stats history
  appendDayStats(state.stats, result.dayStats)

  // Day counter
  state.dayNumber += 1
```

---

## 10. checkGoals()

Called after every build action and at the end of every day tick.
Only checks the currently active goal — sequential, one at a time.

```
FUNCTION checkGoals(state) → GoalResult
  /*
    GoalResult: { goalCompleted: bool, completedIndex: int, gameComplete: bool }
  */

  idx = state.progression.activeGoalIndex

  IF idx >= 10
    RETURN { goalCompleted: false, completedIndex: -1, gameComplete: false }

  met = isGoalMet(idx, state)

  IF NOT met
    RETURN { goalCompleted: false, completedIndex: -1, gameComplete: false }

  // ── Mark complete and apply reward ────────────────────────────────────────
  state.progression.completedGoals[idx] = true
  state.progression.activeGoalIndex     = idx + 1

  reward = GOAL_REWARDS[idx]
  state.economy.cash += reward

  gameComplete = (state.progression.activeGoalIndex >= 10)

  RETURN { goalCompleted: true, completedIndex: idx, gameComplete }


FUNCTION isGoalMet(idx, state) → bool

  economy     = state.economy
  hotel       = state.hotel
  progression = state.progression

  IF idx == 0  RETURN economy.slotCount         >= 3
  IF idx == 1  RETURN economy.totalGuests       >= 35
  IF idx == 2  RETURN economy.wcCount           >= 1
  IF idx == 3  RETURN economy.smallTableCount   >= 1
  IF idx == 4  RETURN economy.resortRating      >= 2.0
  IF idx == 5  RETURN economy.cumulativeIncome  >= 5000
  IF idx == 6  RETURN hotel.roomCount           >= 4
  IF idx == 7  RETURN economy.totalGuests       >= 60
  IF idx == 8  RETURN hotel.qualityLevel        >= 2
  IF idx == 9  RETURN economy.barExists         == true

  RETURN false


GOAL_REWARDS = [500, 800, 600, 1200, 1000, 1500, 1000, 2000, 1500, 3000]
```

---

## 11. saveGame()

Serialises only the data needed to reconstruct the full game state on load.
Derived values and static definitions are never saved.

```
FUNCTION saveGame(state) → void

  // ── Build minimal placed object records ───────────────────────────────────
  savedObjects = []
  FOR EACH obj IN state.map.placedObjects
    savedObjects.append({
      id:      obj.id,
      type:    obj.type,
      col:     obj.col,
      row:     obj.row,
      rotated: obj.rotated,
      variant: obj.variant,
    })

  // ── Assemble save payload ─────────────────────────────────────────────────
  saveData = {
    saveVersion:      "1.1.0",
    savedAt:          currentISOTimestamp(),
    dayNumber:        state.dayNumber,
    placedObjects:    savedObjects,
    roomCount:        state.hotel.roomCount,
    qualityLevel:     state.hotel.qualityLevel,
    cash:             state.economy.cash,
    cumulativeIncome: state.economy.cumulativeIncome,
    lastDayGuests:    state.economy.lastDayGuests,
    prevCrowdingPenalty: state.economy.prevCrowdingPenalty,
    activeGoalIndex:  state.progression.activeGoalIndex,
    completedGoals:   state.progression.completedGoals,
    stats: {
      records: state.stats.records,
      charts:  state.stats.charts,
    },
  }

  json = JSON.stringify(saveData)
  localStorage.setItem("casino_resort_save", json)
```

---

## 12. loadGame()

Deserialises a save and reconstructs the full game state, including all derived values.
If no save exists or save is corrupt, returns null (caller creates a new game).

```
FUNCTION loadGame() → GameState OR null

  raw = localStorage.getItem("casino_resort_save")
  IF raw == null
    RETURN null

  TRY
    saveData = JSON.parse(raw)
  CATCH
    RETURN null   // corrupt JSON — start fresh

  // ── Version check ─────────────────────────────────────────────────────────
  IF saveData.saveVersion != "1.1.0"
    saveData = migrate(saveData)   // migration.ts handles older versions

  // ── Rebuild grid from scratch ─────────────────────────────────────────────
  state = initializeGame()        // fresh grid with correct tile types
  state.dayNumber = saveData.dayNumber

  // Reset counts (initializeGame sets them to 0 already; explicit for clarity)
  state.map.placedObjects = []

  // ── Restore placed objects ────────────────────────────────────────────────
  FOR EACH saved IN saveData.placedObjects
    def = OBJECT_DEFINITIONS[saved.type]

    IF saved.rotated
      w = def.footprintH; h = def.footprintW
    ELSE
      w = def.footprintW; h = def.footprintH

    obj       = new PlacedObject
    obj.id      = saved.id
    obj.type    = saved.type
    obj.col     = saved.col
    obj.row     = saved.row
    obj.rotated = saved.rotated
    obj.variant = saved.variant
    obj.tiles   = computeFootprint(saved.col, saved.row, w, h)

    // Mark tiles occupied
    FOR EACH coord IN obj.tiles
      getTile(state.map, coord.col, coord.row).occupiedByObjId = obj.id

    state.map.placedObjects.append(obj)

  // ── Restore hotel ─────────────────────────────────────────────────────────
  state.hotel.roomCount    = saveData.roomCount
  state.hotel.qualityLevel = saveData.qualityLevel

  // ── Restore economy scalars ───────────────────────────────────────────────
  state.economy.cash                = saveData.cash
  state.economy.cumulativeIncome    = saveData.cumulativeIncome
  state.economy.lastDayGuests       = saveData.lastDayGuests
  state.economy.prevCrowdingPenalty = saveData.prevCrowdingPenalty

  // ── Rebuild cached counts from placed objects ─────────────────────────────
  updateObjectCounts(state)   // sets slotCount, barExists, casinoCapacity, etc.

  // ── Recompute derived values ──────────────────────────────────────────────
  { resortRating, crowdingPenalty } = calculateResortRating(
    state.economy,
    state.hotel,
    state.economy.lastDayGuests,
    state.economy.prevCrowdingPenalty
  )
  state.economy.resortRating = resortRating

  { occupancyRate, bookedRooms, hotelCasinoGuests } =
    calculateHotelOccupancy(state.hotel, resortRating)
  state.hotel.occupancyRate     = occupancyRate
  state.hotel.bookedRooms       = bookedRooms
  state.hotel.hotelCasinoGuests = hotelCasinoGuests

  // ── Restore progression ───────────────────────────────────────────────────
  state.progression.activeGoalIndex = saveData.activeGoalIndex
  state.progression.completedGoals  = saveData.completedGoals

  // ── Restore stats history ─────────────────────────────────────────────────
  state.stats.records = saveData.stats.records
  state.stats.charts  = saveData.stats.charts

  // ── Check if a goal was met before the save happened ─────────────────────
  // Handles edge case where save was written mid-tick before goal check ran
  checkGoals(state)

  RETURN state
```

---

## Utility Functions (used across multiple systems)

```
FUNCTION clamp(value, min, max) → number
  RETURN max(min, min(max, value))

FUNCTION generateUniqueId() → string
  // Simple UUID v4 or incremental counter — either works for MVP
  RETURN "obj_" + globalIdCounter++

FUNCTION appendDayStats(statsHistory, dayStats)
  statsHistory.records.append(dayStats)
  IF statsHistory.records.length > HISTORY_MAX
    statsHistory.records.removeFirst()

  ch = statsHistory.charts
  ch.days.append(dayStats.day)
  ch.totalGuests.append(dayStats.totalGuests)
  ch.walkInGuests.append(dayStats.walkInGuests)
  ch.hotelGuests.append(dayStats.hotelGuests)
  ch.dailyRevenue.append(dayStats.dailyRevenue)
  ch.dailyCosts.append(dayStats.dailyCosts)
  ch.netIncome.append(dayStats.netIncome)
  ch.occupancyRate.append(dayStats.occupancyRate)
  ch.resortRating.append(dayStats.resortRating)
  ch.casinoCapacity.append(dayStats.casinoCapacity)

  IF ch.days.length > HISTORY_MAX
    ch.days.removeFirst()
    ch.totalGuests.removeFirst()
    ch.walkInGuests.removeFirst()
    ch.hotelGuests.removeFirst()
    ch.dailyRevenue.removeFirst()
    ch.dailyCosts.removeFirst()
    ch.netIncome.removeFirst()
    ch.occupancyRate.removeFirst()
    ch.resortRating.removeFirst()
    ch.casinoCapacity.removeFirst()
```

---

## Constants Reference

All tunable values in one place. Change here, takes effect everywhere.

```
GRID_COLS            = 36
GRID_ROWS            = 24
LOBBY_START_COL      = 15
LOBBY_END_COL        = 20

STARTING_CASH        = 7500
HISTORY_MAX          = 60

RATING_BASE          = 1.50
RATING_CLAMP_MIN     = 1.0
RATING_CLAMP_MAX     = 5.0
CROWDING_SMOOTH      = 0.4       // [TUNABLE] — 1.0 = no smoothing
BASE_DEMAND          = 30        // [TUNABLE]

REVENUE_SLOT         = 12        // [TUNABLE]
REVENUE_SMALL_TABLE  = 22        // [TUNABLE]
REVENUE_LARGE_TABLE  = 30        // [TUNABLE]
REVENUE_BAR          = 8         // [TUNABLE]
REVENUE_PER_ROOM     = 25        // [TUNABLE]
BAR_GUEST_DRAW_RATE  = 0.15      // [TUNABLE]

DEMOLISH_REFUND_RATE = 0.5

GOAL_REWARDS = [500, 800, 600, 1200, 1000, 1500, 1000, 2000, 1500, 3000]
```

---

*Pseudocode version: MVP 1.1 — matches all MVP 1.1 design documents.*
