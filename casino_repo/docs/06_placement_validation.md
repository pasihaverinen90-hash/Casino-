# Casino Resort Manager — Placement Validation Logic
**Matches ruleset MVP 1.1, data model MVP 1.1, and object definitions MVP 1.1.**

---

## Design Principles

- **No pathfinding.** Guests share tiles freely. Accessibility checks are proximity-based only.
- **No reachability graphs.** The casino floor is always fully connected — the lobby is the guaranteed entry point, and the open floor plan means isolation is not possible in MVP.
- **Accessibility = adjacency.** An object is considered accessible if at least one free walkable tile is adjacent to its access side(s). This is a single neighbour check, not a flood fill.
- **Validation is synchronous and cheap.** Every check runs at placement time against the current tile grid. No deferred or background computation.

---

## 1. Tile Occupancy Rules (Plain English)

1. A tile is **free** if its `tileType == FLOOR` and `occupiedByObjId == null`.
2. A tile is **blocked** if its `tileType` is `WALL`, `LOBBY`, or `BLOCKED`, or if `occupiedByObjId` is not null.
3. Every tile in an object's footprint must be free before placement is allowed.
4. A footprint is the full rectangular tile region the object occupies, computed from `(col, row, width, height, rotated)`.
5. Tiles outside the grid bounds are treated as blocked. A footprint that extends beyond the grid edge fails validation.

---

## 2. Wall Placement Rules (Plain English)

These rules apply only to wall objects: **WC** and **Bar**.

1. A wall object must be placed flush against a valid interior wall.
2. A **valid wall** is any `WALL` tile on the casino area perimeter — specifically the north, south, east, and west outer edges of the buildable floor area. Lobby-facing walls are **not valid** — wall objects cannot be placed against the lobby strip.
3. The player selects a wall tile as the anchor. The object footprint extends **inward** (away from the wall) by 1 tile.
4. The back tiles of the object (touching the wall) must all be adjacent to `WALL` tiles. They do not occupy the wall tile itself — the footprint sits on floor tiles immediately inward.
5. The entire footprint (all width × 1 floor tiles) must be free.
6. The wall run behind the object must be continuous — no gaps, doors, or blocked tiles interrupting the wall tiles behind the footprint.
7. Wall objects cannot be placed against the lobby strip walls (columns 15 or 20, any row).

---

## 3. Collision Rules (Plain English)

1. No two objects may share any tile.
2. A new object's footprint is computed first. If any tile in that footprint is occupied by an existing object, placement fails.
3. Fixed objects (lobby, reception, elevators, entrance) permanently occupy their tiles. They are treated identically to placed objects for collision purposes.
4. The footprint of the object being placed cannot straddle the boundary between the casino area and the lobby strip. All tiles must be entirely within one casino area (west or east).
5. Rotated footprints use swapped `(width, height)` dimensions. Rotation does not change the collision rules — all footprint tiles are still subject to the same checks.

---

## 4. Door Accessibility Rules (Plain English)

Applies to: **WC** and **Bar** (wall objects with defined door tiles).

1. A door tile is the inward-facing tile(s) on a wall object that guests use to enter.
   - WC: centre tile of the 3-wide footprint (index 1).
   - Bar: tiles at index 3 and index 4 of the 8-wide footprint.
2. Each door tile must have at least **one free adjacent floor tile** on its non-object side (the side facing the casino floor interior).
3. "Adjacent" means the 4 cardinal neighbours (up, down, left, right). Diagonal neighbours are not checked.
4. A door tile's inward neighbour is the tile one step further from the wall. This tile must be free (not occupied by another object, not lobby, not wall).
5. If a door tile's inward neighbour is blocked at placement time, placement fails.
6. **This check is only at placement time.** If a later object is placed in front of a door, it is not retroactively invalidated. The engineer does not need to re-validate existing objects when new objects are placed nearby.

---

## 5. Slot Accessibility Rule (Plain English)

Applies to: **Slot Machine**.

1. At least one of the 4 cardinal neighbours of the slot's single tile must be a free `FLOOR` tile (not occupied, not wall, not lobby, not blocked).
2. This ensures the slot cannot be completely surrounded by other objects with no approach tile.
3. Since the slot is 1×1, a single free neighbour is sufficient.

---

## 6. Table Accessibility Rule (Plain English)

Applies to: **Small Table** (2×3) and **Large Table** (2×4).

1. A table must have at least **2 free floor tiles** adjacent to its footprint perimeter. These tiles must be on at least **2 different sides** of the table.
2. "Perimeter adjacency" means tiles that are directly outside the footprint boundary (one step away from any edge tile), not diagonal.
3. The 2-side requirement prevents a table from being pushed into a corner with only one accessible face, which would look implausible.
4. Only free `FLOOR` tiles count. `WALL`, `LOBBY`, `BLOCKED`, and occupied tiles do not.
5. This check counts distinct free perimeter-adjacent tiles, then confirms they are not all on the same edge.

**Simplified implementation note:** Rather than computing all perimeter neighbours, check each of the 4 sides independently. A side is "accessible" if at least one tile adjacent to that side is free. Require that at least 2 of the 4 sides are accessible.

---

## 7. Bar Placement Rule (Plain English)

1. The bar footprint is 8 × 1 (or 1 × 8 if placed on a north/south wall).
2. All 8 tiles of the footprint must be free `FLOOR` tiles (standard collision check).
3. The wall behind the bar must have a continuous run of at least 8 `WALL` tiles aligned with the footprint.
4. Both door tiles (indices 3 and 4) must each have a free inward floor neighbour (standard door accessibility check).
5. `barExists` must be `false`. If `barExists == true`, the bar is not selectable in the build menu and placement is never attempted.
6. No additional rule is needed for the bar specifically — the above is a combination of standard checks applied to the bar's larger footprint.

---

## 8. WC Placement Rule (Plain English)

1. The WC footprint is 3 × 1 (or 1 × 3 if placed on a north/south wall).
2. All 3 tiles of the footprint must be free `FLOOR` tiles.
3. The wall behind the WC must have a continuous run of at least 3 `WALL` tiles aligned with the footprint.
4. The door tile (index 1, the centre tile) must have a free inward floor neighbour.
5. No instance limit. Multiple WCs are allowed.

---

## 9. One-Bar-Only Rule (Plain English)

1. `barExists` is a boolean in `EconomyState`, initialised to `false`.
2. When a bar is placed, set `barExists = true`.
3. When a bar is demolished, set `barExists = false`.
4. In the build menu, the bar entry is **disabled and unselectable** when `barExists == true`. The UI should show it greyed out with a label such as "Already built".
5. The validation function also checks this as a hard fail — even if somehow triggered, placement with `barExists == true` returns `FAIL`.

---

## 10. Validation Order

Run checks in this order. Return the first failure encountered. Do not run subsequent checks after a failure.

```
1. LIMIT CHECK       — object-specific instance limit (bar only in MVP)
2. AFFORDABILITY     — player has enough cash
3. BOUNDS CHECK      — footprint fits entirely within the grid
4. ZONE CHECK        — all footprint tiles are in a valid placement zone (not lobby, not blocked zone)
5. COLLISION CHECK   — all footprint tiles are free (unoccupied, tileType == FLOOR)
6. WALL CHECK        — wall objects only: anchor wall is valid, wall run is continuous
7. DOOR ACCESS CHECK — wall objects only: door tile(s) have a free inward neighbour
8. OBJECT ACCESS     — floor objects: slot has ≥1 free neighbour; tables have ≥2 accessible sides
```

If all checks pass → `VALID`. Placement proceeds.

---

## Pseudocode

```typescript
// ─── Types ───────────────────────────────────────────────────────────────────

enum ValidationResult {
  VALID                = "VALID",
  FAIL_LIMIT           = "FAIL_LIMIT",           // instance cap reached
  FAIL_AFFORD          = "FAIL_AFFORD",           // not enough cash
  FAIL_OUT_OF_BOUNDS   = "FAIL_OUT_OF_BOUNDS",    // footprint exits the grid
  FAIL_WRONG_ZONE      = "FAIL_WRONG_ZONE",       // footprint includes lobby/blocked tiles
  FAIL_COLLISION       = "FAIL_COLLISION",        // footprint overlaps an existing object
  FAIL_WALL_INVALID    = "FAIL_WALL_INVALID",     // not against a valid wall, or wall run broken
  FAIL_DOOR_BLOCKED    = "FAIL_DOOR_BLOCKED",     // door tile has no free inward neighbour
  FAIL_NO_ACCESS       = "FAIL_NO_ACCESS",        // object has no accessible approach tile(s)
}

interface PlacementRequest {
  objectType: ObjectType
  col:        number        // top-left tile of the footprint
  row:        number
  rotated:    boolean       // if true, swap footprintW and footprintH
  variant:    TableVariant | null
}


// ─── Entry Point ─────────────────────────────────────────────────────────────

function validatePlacement(
  req:      PlacementRequest,
  map:      MapState,
  economy:  EconomyState,
  cash:     number
): ValidationResult {

  const def = OBJECT_DEFINITIONS[req.objectType]
  const w   = req.rotated ? def.footprintH : def.footprintW
  const h   = req.rotated ? def.footprintW : def.footprintH

  // 1. LIMIT CHECK
  if (def.maxCount !== null) {
    if (req.objectType === ObjectType.BAR && economy.barExists) {
      return ValidationResult.FAIL_LIMIT
    }
  }

  // 2. AFFORDABILITY
  if (cash < def.cost) {
    return ValidationResult.FAIL_AFFORD
  }

  // 3. BOUNDS CHECK
  if (req.col < 0 || req.row < 0 ||
      req.col + w > GRID_COLS ||
      req.row + h > GRID_ROWS) {
    return ValidationResult.FAIL_OUT_OF_BOUNDS
  }

  // Compute footprint tile list once — reused in later checks
  const footprint: TileCoord[] = computeFootprint(req.col, req.row, w, h)

  // 4. ZONE CHECK
  // All footprint tiles must be FLOOR type
  for (const tile of footprint) {
    const t = getTile(map, tile.col, tile.row)
    if (t.tileType !== TileType.FLOOR) {
      return ValidationResult.FAIL_WRONG_ZONE
    }
  }

  // 5. COLLISION CHECK
  // All footprint tiles must be unoccupied
  for (const tile of footprint) {
    const t = getTile(map, tile.col, tile.row)
    if (t.occupiedByObjId !== null) {
      return ValidationResult.FAIL_COLLISION
    }
  }

  // 6. WALL CHECK (wall objects only)
  if (def.isWallObject) {
    const wallResult = validateWallPlacement(req, map, w, h)
    if (wallResult !== ValidationResult.VALID) {
      return wallResult
    }
  }

  // 7. DOOR ACCESS CHECK (wall objects only)
  if (def.isWallObject) {
    const doorResult = validateDoorAccess(req, map, w, h)
    if (doorResult !== ValidationResult.VALID) {
      return doorResult
    }
  }

  // 8. OBJECT ACCESS CHECK (floor objects only)
  if (!def.isWallObject) {
    const accessResult = validateObjectAccess(req, map, w, h)
    if (accessResult !== ValidationResult.VALID) {
      return accessResult
    }
  }

  return ValidationResult.VALID
}


// ─── Step 6: Wall Validation ──────────────────────────────────────────────────

function validateWallPlacement(
  req: PlacementRequest,
  map: MapState,
  w:   number,
  h:   number
): ValidationResult {

  // Determine which wall the object is snapping to by checking
  // which edge of the footprint is adjacent to WALL tiles.
  // The footprint sits on FLOOR tiles; the wall is one step beyond.

  // Wall direction is encoded as which side of the footprint
  // faces the wall. Derive this from the footprint position:
  //   - Top wall:    row == 0 (footprint top row is row 0, wall is above the grid — invalid)
  //                  Actually: row > 0 and tile at (col, row-1) is WALL
  //   - Bottom wall: tile at (col, row+h) is WALL
  //   - Left wall:   tile at (col-1, row) is WALL
  //   - Right wall:  tile at (col+w, row) is WALL

  // For MVP the lobby strip walls (col 15 and col 20) are invalid.
  // Only true perimeter walls are valid.

  const wallDir = detectWallDirection(req, map, w, h)
  if (wallDir === null) {
    return ValidationResult.FAIL_WALL_INVALID    // no adjacent wall found
  }

  // Check that the wall run behind the object is continuous (no gaps)
  const wallRunValid = checkWallRun(req, map, w, h, wallDir)
  if (!wallRunValid) {
    return ValidationResult.FAIL_WALL_INVALID
  }

  return ValidationResult.VALID
}

function detectWallDirection(
  req: PlacementRequest,
  map: MapState,
  w:   number,
  h:   number
): "top" | "bottom" | "left" | "right" | null {

  // Check each cardinal side. Return the first valid wall direction found.
  // A direction is valid if:
  //   (a) the tiles one step beyond the footprint on that side are all WALL type
  //   (b) those WALL tiles are not lobby-strip walls

  // Top: tiles at row (req.row - 1), cols req.col to req.col + w - 1
  if (req.row > 0) {
    if (isValidWallRun(map, req.col, req.row - 1, w, "horizontal")) {
      return "top"
    }
  }

  // Bottom: tiles at row (req.row + h), cols req.col to req.col + w - 1
  if (req.row + h < GRID_ROWS) {
    if (isValidWallRun(map, req.col, req.row + h, w, "horizontal")) {
      return "bottom"
    }
  }

  // Left: tiles at col (req.col - 1), rows req.row to req.row + h - 1
  if (req.col > 0) {
    if (isValidWallRun(map, req.col - 1, req.row, h, "vertical")) {
      return "left"
    }
  }

  // Right: tiles at col (req.col + w), rows req.row to req.row + h - 1
  if (req.col + w < GRID_COLS) {
    if (isValidWallRun(map, req.col + w, req.row, h, "vertical")) {
      return "right"
    }
  }

  return null
}

function isValidWallRun(
  map:       MapState,
  startCol:  number,
  startRow:  number,
  length:    number,
  direction: "horizontal" | "vertical"
): boolean {
  // Check that all tiles in the run are WALL type and not lobby-strip walls.
  for (let i = 0; i < length; i++) {
    const col = direction === "horizontal" ? startCol + i : startCol
    const row = direction === "vertical"   ? startRow + i : startRow

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
      return false
    }

    const t = getTile(map, col, row)
    if (t.tileType !== TileType.WALL) {
      return false
    }

    // Reject lobby-strip walls: columns 15 and 20 (LOBBY_START_COL and LOBBY_END_COL)
    if (col === LOBBY_START_COL || col === LOBBY_END_COL) {
      return false
    }
  }
  return true
}

function checkWallRun(
  req:     PlacementRequest,
  map:     MapState,
  w:       number,
  h:       number,
  wallDir: "top" | "bottom" | "left" | "right"
): boolean {
  // Already validated in detectWallDirection via isValidWallRun.
  // This function exists as a clear named step. Return true — work is done above.
  return true
}


// ─── Step 7: Door Access Validation ──────────────────────────────────────────

function validateDoorAccess(
  req: PlacementRequest,
  map: MapState,
  w:   number,
  h:   number
): ValidationResult {

  const doorTiles = getDoorTiles(req, w, h)
  // getDoorTiles returns the inward-facing (casino-floor-side) door tile coordinates.
  // The door tile itself is part of the footprint. We check the tile one step
  // further inward from the door (away from the wall) for a free floor tile.

  const wallDir = detectWallDirection(req, map, w, h)  // already confirmed valid at this point

  for (const door of doorTiles) {
    const inwardNeighbour = getInwardNeighbour(door, wallDir)

    if (inwardNeighbour === null) {
      return ValidationResult.FAIL_DOOR_BLOCKED   // no inward tile (at grid edge — shouldn't happen)
    }

    const t = getTile(map, inwardNeighbour.col, inwardNeighbour.row)
    if (t.tileType !== TileType.FLOOR || t.occupiedByObjId !== null) {
      return ValidationResult.FAIL_DOOR_BLOCKED
    }
  }

  return ValidationResult.VALID
}

function getDoorTiles(
  req: PlacementRequest,
  w:   number,
  h:   number
): TileCoord[] {
  // Returns the footprint tile coordinates of the door tile(s).
  // Door position is defined per object type along the long axis.

  if (req.objectType === ObjectType.WC) {
    // WC: 3 wide. Door = index 1 (centre). Long axis = width (w=3).
    // If rotated (h=3), door is at centre row.
    const isHorizontal = w >= h
    if (isHorizontal) {
      return [{ col: req.col + 1, row: req.row }]
    } else {
      return [{ col: req.col, row: req.row + 1 }]
    }
  }

  if (req.objectType === ObjectType.BAR) {
    // Bar: 8 wide. Doors = indices 3 and 4 (two centre tiles).
    const isHorizontal = w >= h
    if (isHorizontal) {
      return [
        { col: req.col + 3, row: req.row },
        { col: req.col + 4, row: req.row },
      ]
    } else {
      return [
        { col: req.col, row: req.row + 3 },
        { col: req.col, row: req.row + 4 },
      ]
    }
  }

  return []  // no door tiles for non-wall objects
}

function getInwardNeighbour(
  door:    TileCoord,
  wallDir: "top" | "bottom" | "left" | "right" | null
): TileCoord | null {
  // "Inward" means away from the wall and further into the casino floor.
  if (wallDir === "top")    return { col: door.col,     row: door.row + 1 }
  if (wallDir === "bottom") return { col: door.col,     row: door.row - 1 }
  if (wallDir === "left")   return { col: door.col + 1, row: door.row     }
  if (wallDir === "right")  return { col: door.col - 1, row: door.row     }
  return null
}


// ─── Step 8: Object Access Validation ────────────────────────────────────────

function validateObjectAccess(
  req: PlacementRequest,
  map: MapState,
  w:   number,
  h:   number
): ValidationResult {

  if (req.objectType === ObjectType.SLOT_MACHINE) {
    return validateSlotAccess(req, map)
  }

  if (req.objectType === ObjectType.SMALL_TABLE ||
      req.objectType === ObjectType.LARGE_TABLE) {
    return validateTableAccess(req, map, w, h)
  }

  return ValidationResult.VALID  // no access check for other types
}

function validateSlotAccess(
  req: PlacementRequest,
  map: MapState
): ValidationResult {
  // Slot is 1×1. At least 1 of its 4 cardinal neighbours must be a free FLOOR tile.
  const neighbours: TileCoord[] = [
    { col: req.col,     row: req.row - 1 },
    { col: req.col,     row: req.row + 1 },
    { col: req.col - 1, row: req.row     },
    { col: req.col + 1, row: req.row     },
  ]

  for (const n of neighbours) {
    if (isInBounds(n) && isFreeFloor(map, n)) {
      return ValidationResult.VALID
    }
  }

  return ValidationResult.FAIL_NO_ACCESS
}

function validateTableAccess(
  req: PlacementRequest,
  map: MapState,
  w:   number,
  h:   number
): ValidationResult {
  // A table needs at least 2 of its 4 sides to have at least 1 free floor tile.
  // Check each side independently. Count accessible sides.

  let accessibleSides = 0

  // Top side: row req.row - 1, cols req.col to req.col + w - 1
  if (req.row > 0) {
    for (let c = req.col; c < req.col + w; c++) {
      if (isFreeFloor(map, { col: c, row: req.row - 1 })) {
        accessibleSides++
        break  // only need 1 free tile per side
      }
    }
  }

  // Bottom side: row req.row + h, cols req.col to req.col + w - 1
  if (req.row + h < GRID_ROWS) {
    for (let c = req.col; c < req.col + w; c++) {
      if (isFreeFloor(map, { col: c, row: req.row + h })) {
        accessibleSides++
        break
      }
    }
  }

  // Left side: col req.col - 1, rows req.row to req.row + h - 1
  if (req.col > 0) {
    for (let r = req.row; r < req.row + h; r++) {
      if (isFreeFloor(map, { col: req.col - 1, row: r })) {
        accessibleSides++
        break
      }
    }
  }

  // Right side: col req.col + w, rows req.row to req.row + h - 1
  if (req.col + w < GRID_COLS) {
    for (let r = req.row; r < req.row + h; r++) {
      if (isFreeFloor(map, { col: req.col + w, row: r })) {
        accessibleSides++
        break
      }
    }
  }

  if (accessibleSides >= 2) {
    return ValidationResult.VALID
  }

  return ValidationResult.FAIL_NO_ACCESS
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeFootprint(col: number, row: number, w: number, h: number): TileCoord[] {
  const tiles: TileCoord[] = []
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      tiles.push({ col: c, row: r })
    }
  }
  return tiles
}

function getTile(map: MapState, col: number, row: number): TileState {
  return map.tiles[row * GRID_COLS + col]
}

function isInBounds(t: TileCoord): boolean {
  return t.col >= 0 && t.col < GRID_COLS && t.row >= 0 && t.row < GRID_ROWS
}

function isFreeFloor(map: MapState, t: TileCoord): boolean {
  if (!isInBounds(t)) return false
  const tile = getTile(map, t.col, t.row)
  return tile.tileType === TileType.FLOOR && tile.occupiedByObjId === null
}
```

---

## Validation Result → UI Feedback Mapping

The validation function returns a typed result. The UI layer maps each result to a player-facing message.

| Result | UI Message |
|---|---|
| `VALID` | *(placement proceeds, no message)* |
| `FAIL_LIMIT` | "Only one bar can be built." |
| `FAIL_AFFORD` | "Not enough cash." |
| `FAIL_OUT_OF_BOUNDS` | "Cannot place outside the casino floor." |
| `FAIL_WRONG_ZONE` | "Cannot place here." |
| `FAIL_COLLISION` | "Something is already here." |
| `FAIL_WALL_INVALID` | "Must be placed against a wall." |
| `FAIL_DOOR_BLOCKED` | "The entrance must not be blocked." |
| `FAIL_NO_ACCESS` | "Needs at least one open approach." |

Messages are shown as brief toast notifications. Do not show a message for `VALID`.

---

## Ghost Tile Preview Behaviour

During placement (before the player confirms), the object is shown as a "ghost" on the grid. Run `validatePlacement()` on every tile the ghost occupies as the player drags. Do not wait for the player to tap confirm.

- **Green tint** on ghost = `VALID`
- **Red tint** on ghost = any `FAIL_*` result
- The confirm button is **disabled** when the result is any `FAIL_*`

This gives real-time feedback without requiring a separate preview validation path. The same function is used for preview and for final placement confirmation.

---

*Placement validation version: MVP 1.1 — matches ruleset MVP 1.1, data model MVP 1.1, object definitions MVP 1.1.*
