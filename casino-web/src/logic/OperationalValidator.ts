// OperationalValidator.ts
// Per-object operational checks. Distinct from PlacementValidator: an object
// can be legally placed yet later become non-functional if surrounding open
// floor gets filled in.
//
// P2.1 model:
//   • Slot: functional iff its chair tile is reachable from open floor
//           (i.e. at least one cardinal neighbour of the chair, excluding
//           the cabinet, is open floor or lobby). The interaction tile is
//           the chair tile itself.
//   • Tables: functional iff at least one open-floor seat exists on a
//             non-dealer side. Seats sit on the 3 player sides of the
//             footprint; the dealer side is determined by `facing`.
//   • Wall services (WC, BAR, CASHIER): functional iff every door tile's
//             inward neighbour is open walkable floor.
//
// "Open walkable floor" = unoccupied FLOOR or any LOBBY. Lobby tiles count
// so attractions placed near reception work without extra setup.
import * as GC from './GameConstants';
import { detectWallDir, getDoorTiles, getInward, isOpenFloor } from './PlacementValidator';

export function isFunctional(obj: GC.PlacedObj, tiles: GC.Tile[]): boolean {
  // For every object type, "functional" reduces to "has at least one usable
  // interaction tile". Keeping the rules in one place avoids drift between
  // the gating check and the guest-target picker.
  return getInteractionTiles(obj, tiles).length > 0;
}

export function computeFunctionalIds(placed: GC.PlacedObj[], tiles: GC.Tile[]): Set<string> {
  const out = new Set<string>();
  for (const obj of placed) {
    if (isFunctional(obj, tiles)) out.add(obj.id);
  }
  return out;
}

// Tiles where a guest stands while "using" the attraction.
//   • Slot: its in-footprint chair tile (returned only if reachable).
//   • Table: open-floor tiles on the 3 non-dealer cardinal sides.
//   • Wall service: the inward floor tile in front of each door.
// Returns tile coordinates (integer col/row). Empty when the object has no
// usable approach — the guest layer falls back to a different target.
export function getInteractionTiles(obj: GC.PlacedObj, tiles: GC.Tile[]): GC.Vec2[] {
  const def = GC.getDef(obj.type);
  const out: GC.Vec2[] = [];

  if (def.is_wall) {
    const wallDir = detectWallDir(obj.col, obj.row, obj.w, obj.h, tiles);
    if (!wallDir) return out;
    const doors = getDoorTiles(
      { type: obj.type, col: obj.col, row: obj.row, facing: obj.facing },
      obj.w, obj.h,
    );
    for (const d of doors) {
      const inward = getInward(d, wallDir);
      if (isOpenFloor(tiles, inward.x, inward.y)) out.push(inward);
    }
    return out;
  }

  if (obj.type === GC.ObjType.SLOT_MACHINE) {
    const { seat, machine } = GC.slotParts(obj.col, obj.row, obj.facing);
    const reachable = [
      { x: seat.x + 1, y: seat.y     },
      { x: seat.x - 1, y: seat.y     },
      { x: seat.x,     y: seat.y + 1 },
      { x: seat.x,     y: seat.y - 1 },
    ].some(n =>
      !(n.x === machine.x && n.y === machine.y)
      && isOpenFloor(tiles, n.x, n.y),
    );
    if (reachable) out.push(seat);
    return out;
  }

  // Tables — collect open-floor neighbours on the player sides only.
  const playerSides = GC.tablePlayerSides(obj.facing);
  const { col, row, w, h } = obj;
  for (const side of playerSides) {
    if (side === 'N') {
      for (let c = col; c < col + w; c++)
        if (isOpenFloor(tiles, c, row - 1)) out.push({ x: c, y: row - 1 });
    } else if (side === 'S') {
      for (let c = col; c < col + w; c++)
        if (isOpenFloor(tiles, c, row + h)) out.push({ x: c, y: row + h });
    } else if (side === 'W') {
      for (let r = row; r < row + h; r++)
        if (isOpenFloor(tiles, col - 1, r)) out.push({ x: col - 1, y: r });
    } else {
      for (let r = row; r < row + h; r++)
        if (isOpenFloor(tiles, col + w, r)) out.push({ x: col + w, y: r });
    }
  }
  return out;
}
