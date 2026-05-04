// PlacementValidator.ts — split into:
//   • checkResources — economy/limit checks (no spatial knowledge)
//   • checkSpatial   — bounds/zone/collision/wall/door/floor-access
//   • validate       — composes the two for callsites that want both
//
// The split exists so future *operational* validation (e.g. "this attraction
// is currently inactive because no path is adjacent") lives outside placement
// validation: it should not block placement, just operation.
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
// `placed` is consulted only to identify PATH tiles, which count as
// walkable for access/door-inward checks (collision still rejects them).
export function checkSpatial(
  req    : PlaceReq,
  tiles  : GC.Tile[],
  placed : GC.PlacedObj[],
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

  const pathIds = pathIdSet(placed);

  if (def.is_wall) {
    const wallDir = detectWallDir(req.col, req.row, w, h, tiles);
    if (!wallDir) return GC.ValResult.FAIL_WALL_INVALID;
    const doors = getDoorTiles(req, w, h);
    for (const door of doors) {
      const inward = getInward(door, wallDir);
      if (!isWalkable(tiles, pathIds, inward.x, inward.y))
        return GC.ValResult.FAIL_DOOR_BLOCKED;
    }
  } else if (def.accessSides === 1) {
    if (countFreeNeighbours(tiles, pathIds, req.col, req.row) === 0)
      return GC.ValResult.FAIL_NO_ACCESS;
  } else if (def.accessSides === 2) {
    if (countAccessibleSides(tiles, pathIds, req.col, req.row, w, h) < 2)
      return GC.ValResult.FAIL_NO_ACCESS;
  }

  return GC.ValResult.VALID;
}

export function validate(
  req      : PlaceReq,
  tiles    : GC.Tile[],
  placed   : GC.PlacedObj[],
  cash     : number,
  barExists: boolean,
): GC.ValResult {
  const r = checkResources(req.type, cash, barExists);
  if (r !== GC.ValResult.VALID) return r;
  return checkSpatial(req, tiles, placed);
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

export function isFreeFloor(tiles: GC.Tile[], col: number, row: number): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  const t = tiles[row * GC.GRID_COLS + col];
  return t.tile_type === GC.TileType.FLOOR && t.obj_id === '';
}

// Like isFreeFloor, but also accepts FLOOR tiles whose only occupant is a
// PATH tile. Used by access checks (slot/table reach) and door-inward
// checks (wall services), since guests can walk over paths.
function pathIdSet(placed: GC.PlacedObj[]): Set<string> {
  const out = new Set<string>();
  for (const o of placed) if (o.type === GC.ObjType.PATH) out.add(o.id);
  return out;
}

function isWalkable(
  tiles: GC.Tile[], pathIds: Set<string>, col: number, row: number,
): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  const t = tiles[row * GC.GRID_COLS + col];
  if (t.tile_type !== GC.TileType.FLOOR) return false;
  if (t.obj_id === '') return true;
  return pathIds.has(t.obj_id);
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

function countFreeNeighbours(
  tiles: GC.Tile[], pathIds: Set<string>, col: number, row: number,
): number {
  const dirs: GC.Vec2[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];
  return dirs.filter(d => isWalkable(tiles, pathIds, col + d.x, row + d.y)).length;
}

function countAccessibleSides(
  tiles: GC.Tile[], pathIds: Set<string>,
  col: number, row: number, w: number, h: number,
): number {
  let sides = 0;
  const checkH = (r: number) => { for (let c = col; c < col + w; c++) if (isWalkable(tiles, pathIds, c, r)) { sides++; return; } };
  const checkV = (c: number) => { for (let r = row; r < row + h; r++) if (isWalkable(tiles, pathIds, c, r)) { sides++; return; } };
  checkH(row - 1); checkH(row + h);
  checkV(col - 1); checkV(col + w);
  return sides;
}
