// OperationalValidator.ts
// Per-object operational checks. Distinct from PlacementValidator: an object
// can be legally placed yet currently non-functional because no path connects
// guests to it.
//
// Rules (no pathfinding — only direct 4-neighbour adjacency):
//   • PATH tiles are infrastructure: always functional.
//   • Floor attractions (slot, small/large table) are functional iff any tile
//     in their footprint has a 4-neighbour that is PATH or LOBBY.
//   • Wall services (WC, BAR, CASHIER) are functional iff every door tile's
//     inward neighbour is PATH or LOBBY. (Wall objects' "front" is the door
//     side, so guests must stand on a path/lobby tile to use them.)
//
// LOBBY tiles count as path-equivalent so attractions placed adjacent to the
// reception area work without the player laying a path tile under their nose.
import * as GC from './GameConstants';
import { detectWallDir, getDoorTiles, getInward } from './PlacementValidator';

// Build a Set of grid indices that count as "path" for adjacency: every
// LOBBY tile, plus every tile occupied by a PATH-typed placed object.
function buildPathIndexSet(placed: GC.PlacedObj[], tiles: GC.Tile[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].tile_type === GC.TileType.LOBBY) out.add(i);
  }
  for (const obj of placed) {
    if (obj.type !== GC.ObjType.PATH) continue;
    for (const t of obj.tiles) out.add(t.y * GC.GRID_COLS + t.x);
  }
  return out;
}

function inSet(set: Set<number>, col: number, row: number): boolean {
  if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return false;
  return set.has(row * GC.GRID_COLS + col);
}

function anyNeighbourInSet(set: Set<number>, col: number, row: number): boolean {
  return inSet(set, col - 1, row)
      || inSet(set, col + 1, row)
      || inSet(set, col,     row - 1)
      || inSet(set, col,     row + 1);
}

export function isFunctional(obj: GC.PlacedObj, tiles: GC.Tile[], pathSet: Set<number>): boolean {
  if (obj.type === GC.ObjType.PATH) return true;
  const def = GC.getDef(obj.type);

  if (def.is_wall) {
    const wallDir = detectWallDir(obj.col, obj.row, obj.w, obj.h, tiles);
    if (!wallDir) return false; // no adjacent wall — shouldn't happen for placed objs
    const doors = getDoorTiles(
      { type: obj.type, col: obj.col, row: obj.row, rotated: obj.rotated },
      obj.w, obj.h,
    );
    if (doors.length === 0) return false;
    for (const d of doors) {
      const inward = getInward(d, wallDir);
      if (!inSet(pathSet, inward.x, inward.y)) return false;
    }
    return true;
  }

  // Floor object: any neighbour of any footprint tile.
  for (const t of obj.tiles) {
    if (anyNeighbourInSet(pathSet, t.x, t.y)) return true;
  }
  return false;
}

export function computeFunctionalIds(placed: GC.PlacedObj[], tiles: GC.Tile[]): Set<string> {
  const pathSet = buildPathIndexSet(placed, tiles);
  const out = new Set<string>();
  for (const obj of placed) {
    if (isFunctional(obj, tiles, pathSet)) out.add(obj.id);
  }
  return out;
}
