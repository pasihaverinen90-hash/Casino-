// ProjectionV2.ts — pure-math projection helpers for the Presentation V2
// renderer.
//
// Shallow dimetric: a +col grid step on screen is (+ts, +ts*SHEAR_Y_RATIO);
// a +row grid step is (-ts, +ts*SHEAR_Y_RATIO). The vertical axis used by
// walls and tall objects is intentionally separate from the floor projection
// — it is wallVerticalOffset(ts) screen-pixels per "tile of height", applied
// via liftPoint(). Keeping height off the floor axes is what lets a single
// recipe paint into the same projected footprint at any elevation without
// the alignment drift the V1 shear prototype produced.
//
// screenToWorld is the algebraic inverse of worldToScreen, so
// screenToWorld(worldToScreen(c, r, ts), ts) round-trips to (c, r) within
// float precision.
//
// No Phaser, no gameState, no DOM. Deterministic and side-effect-free.

// (col + row) → screen-y multiplier. ~22.4° pitch (atan(0.42)) — the
// "shallow Hoyle" angle. One place to tune the tilt for the whole renderer.
export const SHEAR_Y_RATIO     = 0.42;

// Wall extrusion in tile units. wallVerticalOffset(ts) = ts * this.
// Recipes call wallVerticalOffset() / liftPoint() instead of multiplying
// directly so a future tuning pass only touches this constant.
export const WALL_HEIGHT_TILES = 0.85;

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

// Per-tile vertical screen-pixel offset for "one tile of height". The
// canonical wall/object height multiplier — every recipe and the wall
// renderer must derive vertical extrusion from this, never from ts directly.
export function wallVerticalOffset(ts: number): number {
  return ts * WALL_HEIGHT_TILES;
}

// Lift a projected point upward by `heightInTiles` of wall height. Used by
// recipes that need a top-face anchor from a floor-level anchor without
// re-deriving the offset.
export function liftPoint(p: Vec2, heightInTiles: number, ts: number): Vec2 {
  return {
    x: p.x,
    y: p.y - heightInTiles * wallVerticalOffset(ts),
  };
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
