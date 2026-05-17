// drawHelpers.ts — small shared utilities for V2 object recipes.
//
// All helpers are pure painting / geometry. No gameState access, no
// side-effects beyond the Graphics object passed in.
import Phaser from 'phaser';
import * as Proj from '../ProjectionV2';
import { SHADOW, WOOD_MID, WOOD_DARK } from '../PaletteV2';

// Shift a quad by (dx, dy). Recipes typically get a tile/footprint quad
// in scene-local coords and need to add the camera baseX/baseY.
export function offsetQuad(
  quad: readonly Proj.Vec2[],
  dx: number, dy: number,
): Proj.Vec2[] {
  return quad.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

// Lift every vertex of a quad upward by heightInTiles. Used by FLOOR-
// OBJECT recipes only (slot cabinets, table rims, keno display, etc.).
// Calls liftObjectPoint so heightInTiles is genuinely tile units and
// the lift is decoupled from WALL_HEIGHT_TILES.
//
// Wall-service recipes should NOT use liftQuad — they paint via
// wallShared (section.wallPx / drawFacadeRect) which routes through
// wallVerticalOffset(ts) instead.
export function liftQuad(
  quad: readonly Proj.Vec2[],
  heightInTiles: number, ts: number,
): Proj.Vec2[] {
  return quad.map(p => Proj.liftObjectPoint(p, heightInTiles, ts));
}

// Fill a closed polygon defined by `quad` with the given colour / alpha.
export function fillQuad(
  g: Phaser.GameObjects.Graphics,
  quad: Proj.Vec2[],
  color: number, alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints(quad, true);
}

// Linear interpolation between two points. t=0 → a, t=1 → b.
export function lerpVec(a: Proj.Vec2, b: Proj.Vec2, t: number): Proj.Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Inset a face parallelogram inward by separate fractions on each side.
// face order: [bottomLeft, bottomRight, topRight, topLeft] — clockwise.
// Returns a smaller parallelogram with the same winding so it can be
// filled directly. Used for slot screens, table felt borders, etc.
export function insetFace(
  face: readonly Proj.Vec2[],
  insetBottom: number,
  insetTop: number,
  insetSide: number,
): Proj.Vec2[] {
  const bl = face[0], br = face[1], tr = face[2], tl = face[3];
  // Pull bottom corners up toward the top corners.
  const bb_l = lerpVec(bl, tl, insetBottom);
  const bb_r = lerpVec(br, tr, insetBottom);
  // Pull top corners down toward the bottom corners.
  const tt_l = lerpVec(tl, bl, insetTop);
  const tt_r = lerpVec(tr, br, insetTop);
  // Side insets.
  const fbl = lerpVec(bb_l, bb_r, insetSide);
  const fbr = lerpVec(bb_r, bb_l, insetSide);
  const ftl = lerpVec(tt_l, tt_r, insetSide);
  const ftr = lerpVec(tt_r, tt_l, insetSide);
  return [fbl, fbr, ftr, ftl];
}

// Soft floor shadow under an arbitrary footprint quad. Alpha multiplies
// the caller's alpha so dim objects also dim their shadow.
export function drawSoftShadow(
  g: Phaser.GameObjects.Graphics,
  footprint: Proj.Vec2[],
  alpha: number,
): void {
  fillQuad(g, footprint, SHADOW, alpha * 0.35);
}

// Small stool glyph centered on a tile. Reads at every supported zoom
// level (radius scales with ts, floors at 2 px). Body is mid wood with
// a darker rim and a tiny highlight pip — same vocabulary as the slot
// chair so all guest seating glyphs feel like one set.
export function drawStoolAtTileCenter(
  g: Phaser.GameObjects.Graphics,
  col: number, row: number,
  baseX: number, baseY: number, ts: number,
  alpha: number,
): void {
  const c  = Proj.tileCenter(col, row, ts);
  const cx = c.x + baseX;
  const cy = c.y + baseY;
  const r  = Math.max(2, ts * 0.20);

  // Subtle shadow under the stool — sits on the carpet, doesn't float.
  g.fillStyle(SHADOW, alpha * 0.3);
  g.fillEllipse(cx, cy + r * 0.45, r * 1.6, r * 0.7);
  // Body.
  g.fillStyle(WOOD_MID, alpha);
  g.fillCircle(cx, cy, r);
  // Rim.
  g.lineStyle(1, WOOD_DARK, alpha * 0.85);
  g.strokeCircle(cx, cy, r);
  // Top-left catch-light.
  g.fillStyle(0xffffff, alpha * 0.18);
  g.fillCircle(cx - r * 0.3, cy - r * 0.3, Math.max(1, r * 0.4));
}
