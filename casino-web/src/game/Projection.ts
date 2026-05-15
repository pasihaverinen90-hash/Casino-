// Projection.ts — pure-math projection helper for the optional oblique
// (parallelogram) render prototype.
//
// Top-down logic (placement, routing, save, simulation) is the source of
// truth and always operates in grid (col, row) space. This module only
// converts grid coordinates to and from screen pixels when the
// USE_OBLIQUE_PROTOTYPE flag below is true.
//
// The projection is a simple 2D affine shear — NOT a true isometric
// projection. Each tile keeps its grid width on screen but is sheared
// right by SHEAR_X * ts per row and squashed vertically by Y_SCALE. The
// resulting parallelogram floor suggests depth without requiring
// diamond-tile math or per-axis projection inside the engine.
//
// All visual constants live in this file so adjusting the tilt only
// requires editing one place.

// Toggle the prototype. With false, GridScene and GuestSprites fall
// back to their existing top-down code paths — the stable V1 baseline.
//
// DISABLED. This shear-oblique experiment is retired. It produced
// alignment drift (seat markers, wall services, placement ghost) because
// it tried to bend a top-down renderer toward a 2.5D look. The real
// 2.5D renderer is being built fresh under casino-web/src/v2/ using
// shallow dimetric projection with a separate vertical axis. Keep this
// flag false until the V1 renderer is retired and this file is deleted.
export const USE_OBLIQUE_PROTOTYPE = false;

// Horizontal shear per row, in tile widths. 0.5 = each successive row
// shifts right by half a tile.
export const OBLIQUE_SHEAR_X = 0.5;

// Vertical compression. 1.0 = no compression; values < 1 imply tilt.
// 0.7 reads as a moderate angle without making rows hard to count.
export const OBLIQUE_Y_SCALE = 0.7;

// Convert a grid coordinate (may be fractional) to screen-relative
// pixels. Result is in scene-local space — callers add their own
// (baseX, baseY) origin offset.
export function worldToScreen(
  col: number, row: number, ts: number,
): { x: number; y: number } {
  return {
    x: col * ts + row * OBLIQUE_SHEAR_X * ts,
    y: row * ts * OBLIQUE_Y_SCALE,
  };
}

// Inverse of worldToScreen. Caller subtracts the origin offset before
// calling so (sx, sy) is in scene-local space.
export function screenToWorld(
  sx: number, sy: number, ts: number,
): { colFloat: number; rowFloat: number } {
  const rowFloat = sy / (ts * OBLIQUE_Y_SCALE);
  const colFloat = (sx - rowFloat * OBLIQUE_SHEAR_X * ts) / ts;
  return { colFloat, rowFloat };
}

// Centre of a single grid tile, projected to scene-local pixels. Equal
// to worldToScreen(col + 0.5, row + 0.5, ts). Use this — never
// (tileTopLeft.x + ts/2, tileTopLeft.y + ts/2) — when placing anything
// at a tile centre in oblique mode: the shear makes the top-left + ts/2
// trick land off-tile (P2.1 fix).
export function tileCenter(
  col: number, row: number, ts: number,
): { x: number; y: number } {
  return worldToScreen(col + 0.5, row + 0.5, ts);
}

// Centre of an arbitrary footprint at (col, row, w, h), projected to
// scene-local pixels. Equal to worldToScreen(col + w/2, row + h/2, ts).
// Use this for wall-service label anchors and any other "middle of the
// footprint" placement in oblique mode.
export function footprintCenter(
  col: number, row: number, w: number, h: number, ts: number,
): { x: number; y: number } {
  return worldToScreen(col + w / 2, row + h / 2, ts);
}

// Four corners of a unit tile at (col, row) in clockwise order starting
// from the top-left. Used to fill / stroke parallelogram tile shapes.
export function tileQuad(
  col: number, row: number, ts: number,
): Array<{ x: number; y: number }> {
  return [
    worldToScreen(col,     row,     ts),
    worldToScreen(col + 1, row,     ts),
    worldToScreen(col + 1, row + 1, ts),
    worldToScreen(col,     row + 1, ts),
  ];
}

// Four corners of an arbitrary-sized footprint at (col, row, w, h).
// Used for placement ghost and demolish overlay shapes.
export function footprintQuad(
  col: number, row: number, w: number, h: number, ts: number,
): Array<{ x: number; y: number }> {
  return [
    worldToScreen(col,     row,     ts),
    worldToScreen(col + w, row,     ts),
    worldToScreen(col + w, row + h, ts),
    worldToScreen(col,     row + h, ts),
  ];
}

// Axis-aligned bounding box of the entire projected grid. Used for pan
// clamping when the oblique prototype is enabled.
export function projectedBounds(
  cols: number, rows: number, ts: number,
): {
  minX: number; minY: number;
  maxX: number; maxY: number;
  width: number; height: number;
} {
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
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
