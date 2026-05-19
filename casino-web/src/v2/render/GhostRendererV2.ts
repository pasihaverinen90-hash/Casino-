// GhostRendererV2.ts — placement preview overlay.
//
// Pure painter. Reads the current PlacementGhostV2 from
// InputControllerV2 and renders:
//   1. The actual object recipe at low alpha (so the player sees the
//      shape they're about to place, not just an empty rectangle).
//   2. A green or red footprint quad tint + outline so the validation
//      verdict is unmistakable.
//   3. Interaction-tile markers (slot chair / table seats) where cheap.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import { drawObject } from './ObjectRendererV2';
import { GHOST_OK, GHOST_BAD } from './PaletteV2';
import type { PlacementGhostV2 } from '../scene/InputControllerV2';

export function drawGhost(
  g: Phaser.GameObjects.Graphics,
  ghost: PlacementGhostV2 | null,
  tiles: readonly GC.Tile[],
  baseX: number, baseY: number, ts: number,
): void {
  if (!ghost || !ghost.active) return;

  const { col, row, w, h, type, facing, variant, ok } = ghost;

  // Build a synthetic PlacedObj for the recipe. tiles + seats are
  // recipe-consumed (some recipes iterate obj.seats) so we precompute
  // them just like GameState does for a real placement.
  const fp    = _footprint(col, row, w, h);
  const seats = GC.isTableLike(type)
    ? GC.tableSeatTiles(col, row, type, facing)
    : [];
  const fakeObj: GC.PlacedObj = {
    id: '__v2_ghost__', type, col, row, facing, variant,
    tiles: fp, seats, w, h,
  };

  // 1. Object preview at low alpha. Reuse the production recipe so
  //    the ghost can never visually drift from the placed result.
  drawObject({
    g, obj: fakeObj, tiles,
    baseX, baseY, ts,
    alpha: 0.6,
    isFunctional: true,
  });

  // 2. Footprint quad tint + outline. Green when valid, red when not.
  const tint = ok ? GHOST_OK : GHOST_BAD;
  const quad = _offsetQuad(
    Proj.footprintQuad(col, row, w, h, ts), baseX, baseY,
  );
  g.fillStyle(tint, 0.28);
  g.fillPoints(quad, true);
  g.lineStyle(2, tint, 1);
  g.strokePoints(quad, true);
  // Reset line style so any later strokes don't inherit ghost colour.
  g.lineStyle(0, 0, 0);

  // 3. Interaction-tile markers — slot chair / table seats / door tiles.
  _drawInteractionMarkers(g, type, col, row, facing, baseX, baseY, ts, ok);
}

// Slot chair / table seat / wall-service door-inward rings so the
// player sees which tiles guests will use.
function _drawInteractionMarkers(
  g: Phaser.GameObjects.Graphics,
  type: GC.ObjType,
  col: number, row: number,
  facing: GC.Orientation,
  baseX: number, baseY: number, ts: number,
  ok: boolean,
): void {
  const ringColor = ok ? 0xffffff : 0xffbbbb;
  const ringAlpha = 0.85;

  if (type === GC.ObjType.SLOT_MACHINE) {
    const { seat } = GC.slotParts(col, row, facing);
    const c = Proj.tileCenter(seat.x, seat.y, ts);
    g.lineStyle(2, ringColor, ringAlpha);
    g.strokeCircle(c.x + baseX, c.y + baseY, Math.max(2, ts * 0.18));
    return;
  }
  if (GC.isTableLike(type)) {
    const seats = GC.tableSeatTiles(col, row, type, facing);
    g.lineStyle(2, ringColor, ringAlpha);
    for (const s of seats) {
      const c = Proj.tileCenter(s.x, s.y, ts);
      g.strokeCircle(c.x + baseX, c.y + baseY, Math.max(2, ts * 0.15));
    }
    return;
  }
  // Wall services — small ring on each door-inward tile, mostly
  // informational at this stage. Only paint when the placement is
  // valid (we know the wall side and door cells are correct).
  const def = GC.getDef(type);
  if (def.is_wall && ok) {
    const doors = _wallServiceDoorInwardTiles(type, col, row, facing);
    g.lineStyle(2, ringColor, ringAlpha);
    for (const d of doors) {
      const c = Proj.tileCenter(d.x, d.y, ts);
      g.strokeCircle(c.x + baseX, c.y + baseY, Math.max(2, ts * 0.12));
    }
  }
}

// Inline computation of door-inward tiles. PlacementValidator owns the
// canonical version (getDoorTiles + getInward) but those expect a wall
// direction; for the ghost overlay we mirror the same axis test
// (horizontal footprint → door on south edge of footprint).
function _wallServiceDoorInwardTiles(
  type: GC.ObjType, col: number, row: number, facing: GC.Orientation,
): GC.Vec2[] {
  const { w, h } = GC.dimsFor(type, facing);
  const horiz = w >= h;
  const out: GC.Vec2[] = [];
  // N wall (horizontal footprint): door is on the south edge (row + h).
  // W wall (vertical footprint):  door is on the east  edge (col + w).
  if (horiz) {
    if (type === GC.ObjType.WC)           out.push({ x: col + 1, y: row + h });
    else if (type === GC.ObjType.BAR)     out.push({ x: col + 3, y: row + h }, { x: col + 4, y: row + h });
    else if (type === GC.ObjType.BUFFET
          || type === GC.ObjType.SPORTSBOOK) {
      out.push({ x: col + 1, y: row + h }, { x: col + 2, y: row + h });
    } else {
      out.push({ x: col, y: row + h });
    }
  } else {
    if (type === GC.ObjType.WC)           out.push({ x: col + w, y: row + 1 });
    else if (type === GC.ObjType.BAR)     out.push({ x: col + w, y: row + 3 }, { x: col + w, y: row + 4 });
    else if (type === GC.ObjType.BUFFET
          || type === GC.ObjType.SPORTSBOOK) {
      out.push({ x: col + w, y: row + 1 }, { x: col + w, y: row + 2 });
    } else {
      out.push({ x: col + w, y: row });
    }
  }
  return out;
}

function _footprint(col: number, row: number, w: number, h: number): GC.Vec2[] {
  const out: GC.Vec2[] = [];
  for (let r = row; r < row + h; r++)
    for (let c = col; c < col + w; c++)
      out.push({ x: c, y: r });
  return out;
}

function _offsetQuad(quad: readonly Proj.Vec2[], dx: number, dy: number): Proj.Vec2[] {
  return quad.map(p => ({ x: p.x + dx, y: p.y + dy }));
}
