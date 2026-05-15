// WallRendererV2.ts — paints the two visible casino walls (NORTH + WEST).
//
// Pure painter. Receives a Graphics object, camera offset, and tile size;
// reads no gameState (the wall geometry is fixed by GRID_COLS/GRID_ROWS).
// All projection math goes through ProjectionV2; all colours come from
// PaletteV2. All vertical extents come from wallVerticalOffset(ts) — never
// from a literal multiplier on ts (the wall-height constant lives in one
// place, ProjectionV2.WALL_HEIGHT_TILES).
//
// Geometry:
//   • Floor tiles are (col, row) parallelograms in world space, projected
//     to screen via ProjectionV2.
//   • Wall tiles ring the floor: row=0 / row=GRID_ROWS-1 / col=0 /
//     col=GRID_COLS-1 carry TileType.WALL.
//   • The two VISIBLE walls (NORTH at the back, WEST at the left) are
//     rendered here as tall vertical strips standing at the INSIDE edge
//     of the wall tiles — i.e. at world row=1 for NORTH and world col=1
//     for WEST. The "outside" wall tiles (row=0, col=0) are painted by
//     FloorRendererV2 as a flat dark fill and read as the wall's footing.
//   • SOUTH (row=GRID_ROWS-1) and EAST (col=GRID_COLS-1) walls are NOT
//     painted by this module — they remain as FloorRendererV2's flat
//     placeholder fill. The Presentation V2 rule limits wall services to
//     N/W only, so the south/east tiles are intentionally simple.
//   • A small brass column at the NW corner unifies the two walls.
//
// Wall composition (bottom → top, fractions of wallVerticalOffset(ts)):
//   • wainscoting band         — WOOD_MID            (~30%)
//   • thin separator trim line — WALL_TRIM           (1px at ts ≥ 18)
//   • upper panel              — WALL_PANEL          (remaining height)
//   • brass cap rail           — BRASS               (5% of wall height, ≥1px)
//   • brass highlight strip    — BRASS_HIGHLIGHT     (1px at ts ≥ 22)
//
// Per-tile vertical dividers are intentionally NOT drawn in Phase 3 — they
// risk reading as a fence at small zoom. Phase 5 (wall services) and
// Phase 11 (polish) can add them once the wall has actual facades to
// separate.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import {
  WALL_PANEL, WOOD_MID, WOOD_DARK,
  WALL_TRIM, BRASS, BRASS_HIGHLIGHT,
} from './PaletteV2';

// Detail thresholds — below these tile sizes the corresponding feature is
// dropped so the wall doesn't read as noisy or visually busy.
const SEPARATOR_TS = 18;   // wainscot/panel separator line
const HIGHLIGHT_TS = 22;   // brass cap highlight strip

// Indices into the inside-of-wall span. Wall tiles are at the grid
// border (row=0 / col=0 etc.); the visible wall STANDS at the inside
// edge (row=1 / col=1) and extends to the opposite inside edge.
const N_COL_START = 0;
const N_COL_END   = GC.GRID_COLS;   // exclusive in the loop below
const W_ROW_START = 0;
const W_ROW_END   = GC.GRID_ROWS;

interface Vec2 { x: number; y: number; }

export function drawWalls(
  g: Phaser.GameObjects.Graphics,
  baseX: number, baseY: number,
  ts: number,
): void {
  // Per-tile draw of each wall segment so Phase 5 can later replace
  // individual segments with wall-service facades without touching the
  // main wall-paint loop. Today every segment paints the same recipe.

  // NORTH wall — stands at world row = 1, spans full grid width.
  for (let col = N_COL_START; col < N_COL_END; col++) {
    const bl = Proj.worldToScreen(col,     1, ts);   // back-left
    const br = Proj.worldToScreen(col + 1, 1, ts);   // back-right
    _paintWallSegment(g, bl, br, baseX, baseY, ts);
  }

  // WEST wall — stands at world col = 1, spans full grid height.
  // BL is the front-most (larger row → more left + down on screen);
  // BR is the back-most (smaller row → more right + up on screen).
  for (let row = W_ROW_START; row < W_ROW_END; row++) {
    const bl = Proj.worldToScreen(1, row + 1, ts);
    const br = Proj.worldToScreen(1, row,     ts);
    _paintWallSegment(g, bl, br, baseX, baseY, ts);
  }

  // Corner column LAST so it visually merges the two walls into a
  // single vertical pillar at the NW inside corner.
  _paintCornerColumn(g, baseX, baseY, ts);
}

// ── Wall segment ──────────────────────────────────────────────────────────

// Paint the vertical inside face of a single wall tile. The segment is a
// parallelogram between two bottom corners (bl, br) and their lifted
// counterparts; horizontal bands within the parallelogram give the
// wainscoting / panel / brass-cap composition.
function _paintWallSegment(
  g: Phaser.GameObjects.Graphics,
  bl: Vec2, br: Vec2,
  baseX: number, baseY: number, ts: number,
): void {
  const wallPx       = Proj.wallVerticalOffset(ts);
  const detail       = ts >= 14;
  const capPx        = Math.max(1, Math.round(wallPx * 0.05));
  const separatorPx  = (detail && ts >= SEPARATOR_TS) ? 1 : 0;
  const highlightPx  = (detail && ts >= HIGHLIGHT_TS) ? 1 : 0;
  const wainscotPx   = Math.round(wallPx * 0.30);
  const panelPx      = wallPx - wainscotPx - capPx - separatorPx - highlightPx;

  const blS: Vec2 = { x: bl.x + baseX, y: bl.y + baseY };
  const brS: Vec2 = { x: br.x + baseX, y: br.y + baseY };

  let y = 0;

  // Wainscoting (lower band).
  _band(g, blS, brS, y, y + wainscotPx, WOOD_MID, 1);
  y += wainscotPx;

  // Thin trim line between wainscoting and upper panel.
  if (separatorPx > 0) {
    _band(g, blS, brS, y, y + separatorPx, WALL_TRIM, 1);
    y += separatorPx;
  }

  // Upper panel (the bulk of the wall).
  _band(g, blS, brS, y, y + panelPx, WALL_PANEL, 1);
  y += panelPx;

  // Brass cap rail at the top.
  _band(g, blS, brS, y, y + capPx, BRASS, 1);
  y += capPx;

  // Brass highlight just above the cap.
  if (highlightPx > 0) {
    _band(g, blS, brS, y, y + highlightPx, BRASS_HIGHLIGHT, 0.95);
  }
}

// Draw a horizontal band of the wall: a parallelogram between two heights
// above the floor edge (h1 = lower, h2 = upper). The bottom of the band
// rides the same shear as the floor; the top is its lifted counterpart.
function _band(
  g: Phaser.GameObjects.Graphics,
  bl: Vec2, br: Vec2,
  h1: number, h2: number,
  color: number, alpha: number,
): void {
  const quad: Vec2[] = [
    { x: bl.x, y: bl.y - h1 },   // lower-left
    { x: br.x, y: br.y - h1 },   // lower-right
    { x: br.x, y: br.y - h2 },   // upper-right
    { x: bl.x, y: bl.y - h2 },   // upper-left
  ];
  g.fillStyle(color, alpha);
  g.fillPoints(quad, true);
}

// ── Corner column ─────────────────────────────────────────────────────────

// A small brass-capped wood column at the inside NW corner where the
// north and west walls meet. Painted on top of the wall segments so it
// reads as a single pillar joining both walls.
function _paintCornerColumn(
  g: Phaser.GameObjects.Graphics,
  baseX: number, baseY: number, ts: number,
): void {
  const corner = Proj.worldToScreen(1, 1, ts);
  const cx     = corner.x + baseX;
  const cy     = corner.y + baseY;
  const wallPx = Proj.wallVerticalOffset(ts);
  const w      = Math.max(2, Math.round(ts * 0.15));
  const capPx  = Math.max(2, Math.round(wallPx * 0.06));
  const halfW  = w / 2;

  // Wood column body.
  g.fillStyle(WOOD_DARK, 1);
  g.fillRect(cx - halfW, cy - wallPx, w, wallPx);

  // Brass capital at the top (slightly wider than the column body).
  g.fillStyle(BRASS, 1);
  g.fillRect(cx - halfW - 1, cy - wallPx, w + 2, capPx);

  // Brass base at the floor.
  g.fillStyle(BRASS, 1);
  g.fillRect(cx - halfW - 1, cy - capPx, w + 2, capPx);
}
