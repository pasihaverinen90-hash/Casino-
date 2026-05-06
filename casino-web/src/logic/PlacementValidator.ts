// PlacementValidator.ts — split into:
//   • checkResources — economy/limit checks (no spatial knowledge)
//   • checkSpatial   — bounds/zone/collision/wall/door/floor-access
//   • validate       — composes the two for callsites that want both
//
// The split exists so future *operational* validation (e.g. "this attraction
// is currently inactive because no open floor borders it") lives outside
// placement validation: it should not block placement, just operation.
//
// P2.1: floor attractions now own dedicated usage geometry. Slots have a
// 1×2 footprint where one cell is the chair (walkable for guests) and one
// is the cabinet (solid). Tables require a full 1-tile walkable buffer ring
// on every side. Both rules live in checkSpatial below.
import * as GC from './GameConstants';

export interface PlaceReq {
  type   : GC.ObjType;
  col    : number;
  row    : number;
  facing : GC.Orientation;
}

// Pure economy/limit checks. Callers that only need to gate UI buttons
// (e.g. "is this affordable right now?") can use this directly.
export function checkResources(
  type      : GC.ObjType,
  cash      : number,
  barExists : boolean,
): GC.ValResult {
  const def = GC.getDef(type);
  if (def.max === 1 && barExists) return GC.ValResult.FAIL_LIMIT;
  if (cash < def.cost)            return GC.ValResult.FAIL_AFFORD;
  return GC.ValResult.VALID;
}

// Pure spatial validity — does not consult cash or instance counts.
// Walkable = FLOOR with no occupant, or LOBBY. There is no buildable
// path tile any more; open floor itself acts as the access surface.
export function checkSpatial(
  req   : PlaceReq,
  tiles : GC.Tile[],
): GC.ValResult {
  const def = GC.getDef(req.type);
  const { w, h } = GC.dimsFor(req.type, req.facing);

  if (req.col < 0 || req.row < 0 ||
      req.col + w > GC.GRID_COLS || req.row + h > GC.GRID_ROWS)
    return GC.ValResult.FAIL_OUT_OF_BOUNDS;

  const footprint = computeFootprint(req.col, req.row, w, h);

  for (const coord of footprint) {
    if (getTile(tiles, coord.x, coord.y).tile_type !== GC.TileType.FLOOR)
      return GC.ValResult.FAIL_WRONG_ZONE;
  }
  for (const coord of footprint) {
    if (getTile(tiles, coord.x, coord.y).obj_id !== '')
      return GC.ValResult.FAIL_COLLISION;
  }

  if (def.is_wall) {
    const wallDir = detectWallDir(req.col, req.row, w, h, tiles);
    if (!wallDir) return GC.ValResult.FAIL_WALL_INVALID;
    const doors = getDoorTiles(req, w, h);
    for (const door of doors) {
      const inward = getInward(door, wallDir);
      if (!isOpenFloor(tiles, inward.x, inward.y))
        return GC.ValResult.FAIL_DOOR_BLOCKED;
    }
  } else if (req.type === GC.ObjType.SLOT_MACHINE) {
    if (!seatReachable(tiles, req.col, req.row, req.facing))
      return GC.ValResult.FAIL_NO_ACCESS;
  } else if (req.type === GC.ObjType.SMALL_TABLE
          || req.type === GC.ObjType.LARGE_TABLE) {
    if (!hasFullBufferRing(tiles, req.col, req.row, w, h))
      return GC.ValResult.FAIL_NO_ACCESS;
  }

  return GC.ValResult.VALID;
}

export function validate(
  req      : PlaceReq,
  tiles    : GC.Tile[],
  cash     : number,
  barExists: boolean,
): GC.ValResult {
  const r = checkResources(req.type, cash, barExists);
  if (r !== GC.ValResult.VALID) return r;
  return checkSpatial(req, tiles);
}

export function computeFootprint(col: number, row: number, w: number, h: number): GC.Vec2[] {
  const result: GC.Vec2[] = [];
  for (let r = row; r < row + h; r++)
    for (let c = col; c < col + w; c++)
      result.push({ x: c, y: r });
  return result;
}

export function getTile(tiles: GC.Tile[], col: number, row: number): GC.Tile {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS)
    return { col, row, tile_type: GC.TileType.WALL, obj_id: 'blocked', is_seat: false };
  return tiles[row * GC.GRID_COLS + col];
}

// Open walkable floor: an unoccupied FLOOR tile, or any LOBBY tile. Lobby
// tiles count because they are the casino's reception/walk-in surface.
// NOTE: a slot's chair tile (is_seat) is walkable for guests but is not
// "open" — another object can't share it, and table buffer rings must be
// genuinely empty floor. Use isWalkable() for guest-movement checks.
export function isOpenFloor(tiles: GC.Tile[], col: number, row: number): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  const t = tiles[row * GC.GRID_COLS + col];
  if (t.tile_type === GC.TileType.LOBBY) return true;
  return t.tile_type === GC.TileType.FLOOR && t.obj_id === '';
}

// Walkable for guests: open floor, lobby, or a slot's chair tile (which
// is occupied by the slot but the guest is meant to stand on it).
export function isWalkable(tiles: GC.Tile[], col: number, row: number): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  const t = tiles[row * GC.GRID_COLS + col];
  if (t.tile_type === GC.TileType.LOBBY) return true;
  if (t.tile_type !== GC.TileType.FLOOR) return false;
  return t.obj_id === '' || t.is_seat;
}

// Find which side of the footprint borders a valid wall run.
//
// A wall service must lie *flat* against the wall along its long axis: a
// 3×1 WC has to face a horizontal wall over its full 3-tile length, not
// teeter on its 1-tile short edge against a vertical wall. We enforce that
// here by skipping any candidate side whose run length is shorter than the
// object's longer dimension. 1×1 (cashier) keeps all four sides eligible
// since long==short.
export function detectWallDir(col: number, row: number, w: number, h: number, tiles: GC.Tile[]): string {
  const longSide = Math.max(w, h);
  if (w >= longSide && row > 0
      && isValidWallRun(tiles, col, row - 1, w, true))  return 'top';
  if (w >= longSide && row + h < GC.GRID_ROWS
      && isValidWallRun(tiles, col, row + h, w, true))  return 'bottom';
  if (h >= longSide && col > 0
      && isValidWallRun(tiles, col - 1, row, h, false)) return 'left';
  if (h >= longSide && col + w < GC.GRID_COLS
      && isValidWallRun(tiles, col + w, row, h, false)) return 'right';
  return '';
}

function isValidWallRun(
  tiles: GC.Tile[], sc: number, sr: number, length: number, horiz: boolean,
): boolean {
  for (let i = 0; i < length; i++) {
    const c = horiz ? sc + i : sc;
    const r = horiz ? sr     : sr + i;
    if (c < 0 || c >= GC.GRID_COLS || r < 0 || r >= GC.GRID_ROWS) return false;
    const t = tiles[r * GC.GRID_COLS + c];
    if (t.tile_type !== GC.TileType.WALL) return false;
    if (c === GC.LOBBY_START_COL || c === GC.LOBBY_END_COL) return false;
  }
  return true;
}

export function getDoorTiles(req: PlaceReq, w: number, h: number): GC.Vec2[] {
  const { col, row, type } = req;
  const horiz = w >= h;
  switch (type) {
    case GC.ObjType.WC:
      return horiz ? [{ x: col + 1, y: row }] : [{ x: col, y: row + 1 }];
    case GC.ObjType.BAR:
      return horiz
        ? [{ x: col + 3, y: row }, { x: col + 4, y: row }]
        : [{ x: col, y: row + 3 }, { x: col, y: row + 4 }];
    case GC.ObjType.CASHIER:
      // 1×1 — the only footprint tile is also the door tile.
      return [{ x: col, y: row }];
  }
  return [];
}

export function getInward(door: GC.Vec2, wallDir: string): GC.Vec2 {
  switch (wallDir) {
    case 'top':    return { x: door.x,     y: door.y + 1 };
    case 'bottom': return { x: door.x,     y: door.y - 1 };
    case 'left':   return { x: door.x + 1, y: door.y     };
    case 'right':  return { x: door.x - 1, y: door.y     };
  }
  return door;
}

// Slot placement reachability: the chair tile must have at least one
// cardinal neighbour (excluding the cabinet) that is open floor, so a
// guest can walk in from outside the slot's footprint.
function seatReachable(
  tiles: GC.Tile[], col: number, row: number, facing: GC.Orientation,
): boolean {
  const { seat, machine } = GC.slotParts(col, row, facing);
  const cands: GC.Vec2[] = [
    { x: seat.x + 1, y: seat.y     },
    { x: seat.x - 1, y: seat.y     },
    { x: seat.x,     y: seat.y + 1 },
    { x: seat.x,     y: seat.y - 1 },
  ];
  for (const c of cands) {
    if (c.x === machine.x && c.y === machine.y) continue;
    if (isOpenFloor(tiles, c.x, c.y)) return true;
  }
  return false;
}

// Table placement requires the entire cardinal-adjacent ring around the
// footprint to be open floor, so the dealer-side path stays clear and
// every player side has room to host seats.
function hasFullBufferRing(
  tiles: GC.Tile[],
  col: number, row: number, w: number, h: number,
): boolean {
  for (let c = col; c < col + w; c++) {
    if (!isOpenFloor(tiles, c, row - 1)) return false;
    if (!isOpenFloor(tiles, c, row + h)) return false;
  }
  for (let r = row; r < row + h; r++) {
    if (!isOpenFloor(tiles, col - 1, r)) return false;
    if (!isOpenFloor(tiles, col + w, r)) return false;
  }
  return true;
}
