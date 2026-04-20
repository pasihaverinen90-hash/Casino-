// PlacementValidator.ts — direct port of PlacementValidator.gd
import * as GC from './GameConstants';

export interface PlaceReq {
  type    : GC.ObjType;
  col     : number;
  row     : number;
  rotated : boolean;
}

export function validate(
  req     : PlaceReq,
  tiles   : GC.Tile[],
  placed  : GC.PlacedObj[],
  cash    : number,
  barExists: boolean,
): GC.ValResult {
  const def = GC.getDef(req.type);
  const w   = req.rotated ? def.fh : def.fw;
  const h   = req.rotated ? def.fw : def.fh;

  // 1. Instance limit
  if (def.max === 1 && barExists) return GC.ValResult.FAIL_LIMIT;

  // 2. Affordability
  if (cash < def.cost) return GC.ValResult.FAIL_AFFORD;

  // 3. Bounds
  if (req.col < 0 || req.row < 0 ||
      req.col + w > GC.GRID_COLS || req.row + h > GC.GRID_ROWS)
    return GC.ValResult.FAIL_OUT_OF_BOUNDS;

  const footprint = computeFootprint(req.col, req.row, w, h);

  // 4. Zone check
  for (const coord of footprint) {
    if (getTile(tiles, coord.x, coord.y).tile_type !== GC.TileType.FLOOR)
      return GC.ValResult.FAIL_WRONG_ZONE;
  }

  // 5. Collision
  for (const coord of footprint) {
    if (getTile(tiles, coord.x, coord.y).obj_id !== '')
      return GC.ValResult.FAIL_COLLISION;
  }

  // 6–7. Wall objects
  if (def.is_wall) {
    const wallDir = detectWallDir(req.col, req.row, w, h, tiles);
    if (!wallDir) return GC.ValResult.FAIL_WALL_INVALID;
    const doors = getDoorTiles(req, w, h);
    for (const door of doors) {
      const inward = getInward(door, wallDir);
      if (!isFreeFloor(tiles, inward.x, inward.y))
        return GC.ValResult.FAIL_DOOR_BLOCKED;
    }
  }

  // 8. Floor access
  if (!def.is_wall) {
    if (req.type === GC.ObjType.SLOT_MACHINE) {
      if (countFreeNeighbours(tiles, req.col, req.row) === 0)
        return GC.ValResult.FAIL_NO_ACCESS;
    } else if (
      req.type === GC.ObjType.SMALL_TABLE ||
      req.type === GC.ObjType.LARGE_TABLE
    ) {
      if (countAccessibleSides(tiles, req.col, req.row, w, h) < 2)
        return GC.ValResult.FAIL_NO_ACCESS;
    }
  }

  return GC.ValResult.VALID;
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

function detectWallDir(col: number, row: number, w: number, h: number, tiles: GC.Tile[]): string {
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

function getDoorTiles(req: PlaceReq, w: number, h: number): GC.Vec2[] {
  const { col, row, type } = req;
  const horiz = w >= h;
  switch (type) {
    case GC.ObjType.WC:
      return horiz ? [{ x: col + 1, y: row }] : [{ x: col, y: row + 1 }];
    case GC.ObjType.BAR:
      return horiz
        ? [{ x: col + 3, y: row }, { x: col + 4, y: row }]
        : [{ x: col, y: row + 3 }, { x: col, y: row + 4 }];
  }
  return [];
}

function getInward(door: GC.Vec2, wallDir: string): GC.Vec2 {
  switch (wallDir) {
    case 'top':    return { x: door.x,     y: door.y + 1 };
    case 'bottom': return { x: door.x,     y: door.y - 1 };
    case 'left':   return { x: door.x + 1, y: door.y     };
    case 'right':  return { x: door.x - 1, y: door.y     };
  }
  return door;
}

function countFreeNeighbours(tiles: GC.Tile[], col: number, row: number): number {
  const dirs: GC.Vec2[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];
  return dirs.filter(d => isFreeFloor(tiles, col + d.x, row + d.y)).length;
}

function countAccessibleSides(
  tiles: GC.Tile[], col: number, row: number, w: number, h: number,
): number {
  let sides = 0;
  const checkH = (r: number) => { for (let c = col; c < col + w; c++) if (isFreeFloor(tiles, c, r)) { sides++; return; } };
  const checkV = (c: number) => { for (let r = row; r < row + h; r++) if (isFreeFloor(tiles, c, r)) { sides++; return; } };
  checkH(row - 1); checkH(row + h);
  checkV(col - 1); checkV(col + w);
  return sides;
}
