// OperationalValidator.ts
// Per-object operational checks. Distinct from PlacementValidator: an object
// can be legally placed yet later become non-functional if surrounding open
// floor gets filled in.
//
// Rules (no pathfinding — only direct 4-neighbour adjacency):
//   • Floor attractions (slot, small/large table) are functional iff at
//     least one tile of open walkable floor borders their footprint. Tables
//     need at least two such sides; slots need just one neighbour.
//   • Wall services (WC, BAR, CASHIER) are functional iff every door
//     tile's inward neighbour is open walkable floor.
//
// "Open walkable floor" = an unoccupied FLOOR tile or any LOBBY tile.
// Lobby tiles count as walkable so attractions placed near reception work
// without any extra setup.
import * as GC from './GameConstants';
import { detectWallDir, getDoorTiles, getInward, isOpenFloor } from './PlacementValidator';

export function isFunctional(obj: GC.PlacedObj, tiles: GC.Tile[]): boolean {
  const def = GC.getDef(obj.type);

  if (def.is_wall) {
    const wallDir = detectWallDir(obj.col, obj.row, obj.w, obj.h, tiles);
    if (!wallDir) return false; // shouldn't happen for placed wall objs
    const doors = getDoorTiles(
      { type: obj.type, col: obj.col, row: obj.row, rotated: obj.rotated },
      obj.w, obj.h,
    );
    if (doors.length === 0) return false;
    for (const d of doors) {
      const inward = getInward(d, wallDir);
      if (!isOpenFloor(tiles, inward.x, inward.y)) return false;
    }
    return true;
  }

  // Floor object: count distinct footprint sides bordering open floor.
  const need = def.accessSides === 0 ? 1 : def.accessSides;
  return countAccessibleSides(obj, tiles) >= need;
}

function countAccessibleSides(obj: GC.PlacedObj, tiles: GC.Tile[]): number {
  let sides = 0;
  const { col, row, w, h } = obj;
  const checkH = (r: number) => { for (let c = col; c < col + w; c++) if (isOpenFloor(tiles, c, r)) { sides++; return; } };
  const checkV = (c: number) => { for (let r = row; r < row + h; r++) if (isOpenFloor(tiles, c, r)) { sides++; return; } };
  checkH(row - 1); checkH(row + h);
  checkV(col - 1); checkV(col + w);
  return sides;
}

export function computeFunctionalIds(placed: GC.PlacedObj[], tiles: GC.Tile[]): Set<string> {
  const out = new Set<string>();
  for (const obj of placed) {
    if (isFunctional(obj, tiles)) out.add(obj.id);
  }
  return out;
}
