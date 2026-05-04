// PlacementValidator.ts — split into:
//   • checkResources — economy/limit checks (no spatial knowledge)
//   • checkSpatial   — bounds/zone/collision/wall/door/floor-access
//   • validate       — composes the two for callsites that want both
//
// The split exists so future *operational* validation (e.g. "this attraction
// is currently inactive because no open floor borders it") lives outside
// placement validation: it should not block placement, just operation.
import * as GC from './GameConstants';

export interface PlaceReq {
  type    : GC.ObjType;
  col     : number;
  row     : number;
  rotated : boolean;
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
  const w   = req.rotated ? def.fh : def.fw;
  const h   = req.rotated ? def.fw : def.fh;

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
  } else if (def.accessSides === 1) {
    if (countFreeNeighbours(tiles, req.col, req.row, w, h) === 0)
      return GC.ValResult.FAIL_NO_ACCESS;
  } else if (def.accessSides === 2) {
    if (countAccessibleSides(tiles, req.col, req.row, w, h) < 2)
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
    return { col, row, tile_type: GC.TileType.WALL, obj_id: 'blocked' };
  return tiles[row * GC.GRID_COLS + col];
}

// Open walkable floor: an unoccupied FLOOR tile, or any LOBBY tile. Lobby
// tiles count because they are the casino's reception/walk-in surface.
export function isOpenFloor(tiles: GC.Tile[], col: number, row: number): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  const t = tiles[row * GC.GRID_COLS + col];
  if (t.tile_type === GC.TileType.LOBBY) return true;
  return t.tile_type === GC.TileType.FLOOR && t.obj_id === '';
}

export function detectWallDir(col: number, row: number, w: number, h: number, tiles: GC.Tile[]): string {
  if (row > 0             && isValidWallRun(tiles, col, row - 1,  w, true))  return 'top';
  if (row + h < GC.GRID_ROWS && isValidWallRun(tiles, col, row + h,  w, true))  return 'bottom';
  if (col > 0             && isValidWallRun(tiles, col - 1, row,  h, false)) return 'left';
  if (col + w < GC.GRID_COLS && isValidWallRun(tiles, col + w, row,  h, false)) return 'right';
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

// Count footprint-adjacent open floor tiles. Used by 1-access objects
// (slots) — works for any footprint, not just 1×1.
function countFreeNeighbours(
  tiles: GC.Tile[], col: number, row: number, w: number, h: number,
): number {
  let n = 0;
  for (let c = col; c < col + w; c++) {
    if (isOpenFloor(tiles, c, row - 1)) n++;
    if (isOpenFloor(tiles, c, row + h)) n++;
  }
  for (let r = row; r < row + h; r++) {
    if (isOpenFloor(tiles, col - 1, r)) n++;
    if (isOpenFloor(tiles, col + w, r)) n++;
  }
  return n;
}

// Count distinct sides of the footprint that have at least one open
// floor tile against them. Used by 2-access objects (tables).
function countAccessibleSides(
  tiles: GC.Tile[],
  col: number, row: number, w: number, h: number,
): number {
  let sides = 0;
  const checkH = (r: number) => { for (let c = col; c < col + w; c++) if (isOpenFloor(tiles, c, r)) { sides++; return; } };
  const checkV = (c: number) => { for (let r = row; r < row + h; r++) if (isOpenFloor(tiles, c, r)) { sides++; return; } };
  checkH(row - 1); checkH(row + h);
  checkV(col - 1); checkV(col + w);
  return sides;
}
