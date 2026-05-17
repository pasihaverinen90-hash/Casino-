// ProjectionV2.ts — pure-math projection helpers for the Presentation V2
// renderer.
//
// Shallow dimetric: a +col grid step on screen is (+ts, +ts*SHEAR_Y_RATIO);
// a +row grid step is (-ts, +ts*SHEAR_Y_RATIO). The vertical axis is
// separate from the floor projection so wall/object recipes can paint
// at any elevation without alignment drift.
//
// Two height systems live here, intentionally decoupled (see Phase 5.3):
//   • Walls         — wallVerticalOffset(ts) / liftWallPoint
//   • Floor objects — objectVerticalOffset(ts, h) / liftObjectPoint
// The legacy liftPoint helper remains as a wall-based alias for
// backwards compatibility but is no longer called by V2 internals.
//
// screenToWorld is the algebraic inverse of worldToScreen, so
// screenToWorld(worldToScreen(c, r, ts), ts) round-trips to (c, r) within
// float precision.
//
// No Phaser, no gameState, no DOM. Deterministic and side-effect-free.

// (col + row) → screen-y multiplier. ~22.4° pitch (atan(0.42)) — the
// "shallow Hoyle" angle. One place to tune the tilt for the whole renderer.
export const SHEAR_Y_RATIO     = 0.42;

// Wall height — the architectural room wall. wallVerticalOffset(ts) =
// ts * this. Wall recipes and the wall renderer derive every vertical
// extent from wallVerticalOffset(ts) so a tuning pass only touches this
// one constant.
//
// 2.2 — Phase 5.2 bump from 1.6. Walls now read as tall casino-room
// surfaces (≈3.5–4.5 m at typical tile sizes) rather than knee-height
// rims, giving wall-service facades (WC, Bar, Sportsbook, etc.) room
// to occupy only the lower / middle portion while plain wall remains
// visible above them — the Hoyle Casino Empire shape.
//
// Slot / table heights are governed by their own per-recipe constants
// (SLOT_CABINET_HEIGHT_TILES, *_RIM_HEIGHT_TILES, etc.) and flow
// through liftObjectPoint — they do NOT scale with WALL_HEIGHT_TILES.
// Wall and floor-object vertical systems were decoupled in Phase 5.3.
export const WALL_HEIGHT_TILES = 2.2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface WorldCoord {
  colFloat: number;
  rowFloat: number;
}

export interface Bounds {
  minX  : number;
  minY  : number;
  maxX  : number;
  maxY  : number;
  width : number;
  height: number;
}

// Grid (col, row) — may be fractional — to scene-local screen pixels.
// Caller adds its own (baseX, baseY) origin offset.
export function worldToScreen(col: number, row: number, ts: number): Vec2 {
  return {
    x: (col - row) * ts,
    y: (col + row) * ts * SHEAR_Y_RATIO,
  };
}

// Algebraic inverse of worldToScreen. Caller subtracts its origin offset
// before calling so (sx, sy) is in scene-local space.
export function screenToWorld(sx: number, sy: number, ts: number): WorldCoord {
  const a = sx / ts;
  const b = sy / (ts * SHEAR_Y_RATIO);
  return {
    colFloat: (a + b) / 2,
    rowFloat: (b - a) / 2,
  };
}

// Centre of a single grid tile in scene-local pixels. Equal to
// worldToScreen(col + 0.5, row + 0.5, ts). Use this — never
// (tileQuad[0].x + ts/2, ...) — when placing anything at a tile centre.
export function tileCenter(col: number, row: number, ts: number): Vec2 {
  return worldToScreen(col + 0.5, row + 0.5, ts);
}

// Centre of an arbitrary footprint at (col, row, w, h). Use this for wall-
// service labels and any "middle of the footprint" anchor.
export function footprintCenter(
  col: number, row: number, w: number, h: number, ts: number,
): Vec2 {
  return worldToScreen(col + w / 2, row + h / 2, ts);
}

// Four corners of a unit tile at (col, row), clockwise from top-left:
//   [TL, TR, BR, BL]
// "Top" is the back edge (smaller (col+row)), "Bottom" is the front edge.
export function tileQuad(
  col: number, row: number, ts: number,
): [Vec2, Vec2, Vec2, Vec2] {
  return [
    worldToScreen(col,     row,     ts),
    worldToScreen(col + 1, row,     ts),
    worldToScreen(col + 1, row + 1, ts),
    worldToScreen(col,     row + 1, ts),
  ];
}

// Four corners of an arbitrary-sized footprint, same clockwise convention.
export function footprintQuad(
  col: number, row: number, w: number, h: number, ts: number,
): [Vec2, Vec2, Vec2, Vec2] {
  return [
    worldToScreen(col,     row,     ts),
    worldToScreen(col + w, row,     ts),
    worldToScreen(col + w, row + h, ts),
    worldToScreen(col,     row + h, ts),
  ];
}

// Back-to-front sort key. Lower = painted first (farther back). Adding
// (w + h) * 0.5 places larger objects' draw position at their footprint
// centre rather than back corner, which is what makes guests at row R+1
// sort cleanly after a 2x2 object at row R.
export function depthKey(col: number, row: number, w: number, h: number): number {
  return (col + row) + (w + h) * 0.5;
}

// ── Height systems ───────────────────────────────────────────────────────
//
// Two independent vertical axes:
//
//   1. WALLS  — wallVerticalOffset(ts) = ts * WALL_HEIGHT_TILES.
//      Used by WallRendererV2, wallShared (getWallSection top lift),
//      and every wall-service recipe (via section.wallPx / facade
//      helpers). The full wall span is ALWAYS this value; recipes
//      that want only part of the wall use a FACADE_FRACTION.
//
//   2. FLOOR OBJECTS — objectVerticalOffset(ts, h) = ts * h.
//      Used by slot, small/large table, keno, high-stakes via
//      drawHelpers.liftQuad → liftObjectPoint. Per-recipe height
//      constants (SLOT_CABINET_HEIGHT_TILES, *_RIM_HEIGHT_TILES,
//      KENO_DISPLAY_HEIGHT_TILES, etc.) name "tiles" and now
//      multiply by ts directly — they no longer ride the wall
//      height. Tuning WALL_HEIGHT_TILES leaves floor objects alone.
//
// Wall and object lifts are deliberately separate so a future wall
// retune cannot accidentally scale slot cabinets / table rims, and
// vice versa.

// Wall-only vertical offset. One "wall height" worth of screen pixels.
export function wallVerticalOffset(ts: number): number {
  return ts * WALL_HEIGHT_TILES;
}

// Floor-object vertical offset. heightInTiles is exactly that — tile
// units. ts * h. No coupling to wall height.
export function objectVerticalOffset(ts: number, heightInTiles: number): number {
  return ts * heightInTiles;
}

// Lift a projected point by a floor-object height (tile units). The
// canonical primitive for slot cabinets, table rims, keno displays, etc.
export function liftObjectPoint(p: Vec2, heightInTiles: number, ts: number): Vec2 {
  return {
    x: p.x,
    y: p.y - objectVerticalOffset(ts, heightInTiles),
  };
}

// Lift a projected point by a fraction of wall height. Used by
// wall-service recipes that want a wall-relative anchor (e.g. "60 % up
// the wall"). For absolute wall heights use 1.0.
export function liftWallPoint(p: Vec2, heightInWallUnits: number, ts: number): Vec2 {
  return {
    x: p.x,
    y: p.y - heightInWallUnits * wallVerticalOffset(ts),
  };
}

// LEGACY — Phase 0..5 helper that multiplied heightInTiles by
// wallVerticalOffset(ts). This coupling caused floor objects to scale
// with wall height. Kept here so external callers (tests, scratch
// code) don't break, but new code should prefer liftObjectPoint
// (for floor objects) or liftWallPoint (for wall-relative anchors).
//
// All V2 internal callers were migrated off liftPoint in Phase 5.3 —
// drawHelpers.liftQuad, tableShared, and highStakes now use
// liftObjectPoint.
export function liftPoint(p: Vec2, heightInWallUnits: number, ts: number): Vec2 {
  return liftWallPoint(p, heightInWallUnits, ts);
}

// Axis-aligned bounding box of the entire projected grid, including
// WALL_HEIGHT_TILES of headroom above the back edge so the visible N/W
// walls fit inside the bounds. Used for pan/zoom clamping.
export function projectedBounds(cols: number, rows: number, ts: number): Bounds {
  // Floor corners
  const corners = [
    worldToScreen(0,    0,    ts),
    worldToScreen(cols, 0,    ts),
    worldToScreen(cols, rows, ts),
    worldToScreen(0,    rows, ts),
  ];
  let minX =  Infinity, minY =  Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  // Back walls extend above the back corners by one tile of wall height.
  minY -= wallVerticalOffset(ts);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
