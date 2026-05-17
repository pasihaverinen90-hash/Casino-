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
//   • wainscoting band         — WOOD_MID            (~28%)
//   • thin separator trim line — WALL_TRIM           (1px at ts ≥ 18)
//   • upper panel              — WALL_PANEL          (remaining height)
//   • brass cap rail           — BRASS               (4% of wall height, ≥1px)
//   • brass highlight strip    — BRASS_HIGHLIGHT     (1px at ts ≥ 22)
//
// Per-tile vertical dividers are intentionally NOT drawn in Phase 3 — they
// risk reading as a fence at small zoom. Phase 5 (wall services) and
// Phase 11 (polish) can add them once the wall has actual facades to
// separate.
//
// Phase 3.1 — corner refinement: the wood-column + brass-overhang corner
// pillar drew too much attention (the wider brass capital sat above the
// adjacent walls' brass cap rails, producing a small "T" artifact at the
// top). It's now a subtle vertical shadow seam where the two walls meet:
// 1px of SHADOW from floor to wall top, with no overhanging brass. The
// walls' own brass cap rails naturally form an L at the corner top, which
// is enough to read as a junction without a competing pillar.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import {
  WALL_PANEL, WOOD_MID,
  WALL_TRIM, BRASS, BRASS_HIGHLIGHT,
  SHADOW,
} from './PaletteV2';

// Detail thresholds — below these tile sizes the corresponding feature is
// dropped so the wall doesn't read as noisy or visually busy.
const SEPARATOR_TS = 18;   // wainscot/panel separator line
const HIGHLIGHT_TS = 22;   // brass cap highlight strip

// Range of wall segments to paint along each visible wall.
//
// Phase 3.2 — fixes the NW corner "spike" that was visible in the
// screenshot. Each wall stood at the inside edge (world row=1 for N,
// world col=1 for W), but the loop covered every wall tile from col=0
// (or row=0) to GRID_COLS-1 (or GRID_ROWS-1). The col=0 segment of the
// north wall extended LEFT-AND-UP of the NW corner; the row=0 segment
// of the west wall extended RIGHT-AND-UP. Both extensions had brass cap
// rails that crossed above the corner and read as a small spike.
//
// Cutting the ranges to [1, GRID_COLS-2] / [1, GRID_ROWS-2] terminates
// each wall exactly at the inside corner (worldToScreen(1, 1)) — no
// extension past it. The walls' brass cap rails now meet at the corner
// instead of crossing above it.
const N_COL_START = 1;
const N_COL_END   = GC.GRID_COLS - 1;   // exclusive in the loop below
const W_ROW_START = 1;
const W_ROW_END   = GC.GRID_ROWS - 1;

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

  // Corner seam LAST so it sits on top of both walls. Phase 3.1 — a
  // subtle vertical shadow line replaces the prior wood-column pillar so
  // the corner reads as a quiet wall junction rather than an artifact.
  _paintCornerSeam(g, baseX, baseY, ts);
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
  // Phase 5.2 retune for the taller (WALL_HEIGHT_TILES = 2.2) wall:
  // wainscot drops to 28 % (lower band, ~25–30 % of wall as the room
  // shell rule requires) and brass cap shrinks to 4 % so it stays a
  // visible trim line without dominating the tall dark panel above it.
  const capPx        = Math.max(1, Math.round(wallPx * 0.04));
  const separatorPx  = (detail && ts >= SEPARATOR_TS) ? 1 : 0;
  const highlightPx  = (detail && ts >= HIGHLIGHT_TS) ? 1 : 0;
  const wainscotPx   = Math.round(wallPx * 0.28);
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

// ── Corner seam ───────────────────────────────────────────────────────────

// A thin vertical shadow line at the inside NW corner where the two walls
// meet. Replaces the Phase 3 wood-column-with-brass-overhang treatment,
// which had wider brass capital + base than the column body and produced
// a small "T" artifact above the adjacent walls' brass cap rails.
//
// The seam is just dark — no brass overhang, no flaring base, no part
// of it extends beyond the column footprint. The walls' own brass cap
// rails naturally form an L at the corner top, which reads as a
// junction without competing with the walls themselves. Width scales
// with tile size so the seam stays a hairline (1–2px) at any zoom.
function _paintCornerSeam(
  g: Phaser.GameObjects.Graphics,
  baseX: number, baseY: number, ts: number,
): void {
  const corner   = Proj.worldToScreen(1, 1, ts);
  const cx       = corner.x + baseX;
  const cy       = corner.y + baseY;
  const wallPx   = Proj.wallVerticalOffset(ts);
  const seamW    = ts >= 24 ? 2 : 1;
  // Stop the seam just below the brass cap rail so it doesn't notch the
  // bright cap. The walls' caps then meet cleanly across the corner.
  const capPx    = Math.max(1, Math.round(wallPx * 0.06));
  const seamH    = wallPx - capPx;

  g.fillStyle(SHADOW, 0.55);
  g.fillRect(cx - seamW / 2, cy - seamH, seamW, seamH);
}
