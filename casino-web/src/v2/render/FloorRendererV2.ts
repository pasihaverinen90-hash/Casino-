// FloorRendererV2.ts — paints the projected casino floor for Presentation V2.
//
// Pure painting: the renderer takes a Graphics object, the tile array, the
// camera offset, and the tile size, and draws every tile as a projected
// parallelogram via ProjectionV2. It does not touch gameState, does not
// listen to events, and never animates — same (tiles, offset, ts) produces
// pixel-identical output.
//
// Tile recipes:
//   FLOOR   — burgundy carpet base, lighter alt overlay on alternating 2x2
//             groups, antique-gold motif dot at each 4x4 group centre.
//   LOBBY   — richer red base with a small gold accent dot, so it reads as
//             distinct from regular floor.
//   WALL    — flat dark panel placeholder. N/W wall extrusion is drawn
//             by WallRendererV2 over the top of these tiles.
//   BLOCKED — darker placeholder so non-buildable tiles read as obstacles.
//
// Detail overlays (alt, motif, lobby accent) only paint at ts >= DETAIL_TS
// so the floor never reads as noisy at the smallest zoom levels.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import {
  CARPET_BASE, CARPET_ALT, CARPET_MOTIF,
  LOBBY_BASE, LOBBY_TRIM,
  WALL_PANEL, WOOD_DARK,
} from './PaletteV2';

// Below this tile size, draw bases only (no alt / motif / accent) so the
// floor doesn't read as noisy at the smallest zoom levels.
const DETAIL_TS = 14;

export function drawFloor(
  g: Phaser.GameObjects.Graphics,
  tiles: GC.Tile[],
  baseX: number, baseY: number,
  ts: number,
): void {
  const detail = ts >= DETAIL_TS;

  for (let row = 0; row < GC.GRID_ROWS; row++) {
    for (let col = 0; col < GC.GRID_COLS; col++) {
      const t = tiles[row * GC.GRID_COLS + col];
      _paintTile(g, t, col, row, baseX, baseY, ts, detail);
    }
  }
}

// ── Per-tile recipes ────────────────────────────────────────────────────────

function _paintTile(
  g: Phaser.GameObjects.Graphics,
  t: GC.Tile,
  col: number, row: number,
  baseX: number, baseY: number, ts: number, detail: boolean,
): void {
  const quad = _offsetQuad(Proj.tileQuad(col, row, ts), baseX, baseY);

  switch (t.tile_type) {
    case GC.TileType.FLOOR: {
      _fillQuad(g, quad, CARPET_BASE, 1);
      if (detail) {
        const altGroup = (((col >> 1) + (row >> 1)) & 1) === 0;
        if (altGroup) _fillQuad(g, quad, CARPET_ALT, 0.42);
        // Antique-gold motif at every 4x4 group's centre tile — about
        // 1-in-16 floor tiles get the dot, reading as a repeating weave.
        if ((col & 3) === 2 && (row & 3) === 2) {
          _drawMotif(g, col, row, baseX, baseY, ts, CARPET_MOTIF, 0.65);
        }
      }
      return;
    }
    case GC.TileType.LOBBY: {
      _fillQuad(g, quad, LOBBY_BASE, 1);
      if (detail) {
        // Single gold accent dot per lobby tile — distinguishes the
        // reception zone from the regular floor's sparser motif.
        _drawMotif(g, col, row, baseX, baseY, ts, LOBBY_TRIM, 0.45);
      }
      return;
    }
    case GC.TileType.WALL: {
      // Flat placeholder fill. WallRendererV2 overpaints the N/W edges
      // with the proper extruded panels; S/E walls keep this flat fill.
      _fillQuad(g, quad, WALL_PANEL, 1);
      return;
    }
    case GC.TileType.BLOCKED: {
      _fillQuad(g, quad, WOOD_DARK, 1);
      return;
    }
  }
}

// ── Small helpers ───────────────────────────────────────────────────────────

// Draw a small filled rectangle at the projected tile centre. Used for the
// carpet motif and lobby accent. Anchored on tileCenter() so the dot lands
// in the visual middle of the parallelogram in every projection.
function _drawMotif(
  g: Phaser.GameObjects.Graphics,
  col: number, row: number,
  baseX: number, baseY: number, ts: number,
  color: number, alpha: number,
): void {
  const c = Proj.tileCenter(col, row, ts);
  const d = Math.max(2, Math.round(ts * 0.18));
  g.fillStyle(color, alpha);
  g.fillRect(baseX + c.x - d / 2, baseY + c.y - d / 2, d, d);
}

function _fillQuad(
  g: Phaser.GameObjects.Graphics,
  quad: Proj.Vec2[],
  color: number, alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints(quad, true);
}

function _offsetQuad(quad: readonly Proj.Vec2[], dx: number, dy: number): Proj.Vec2[] {
  return [
    { x: quad[0].x + dx, y: quad[0].y + dy },
    { x: quad[1].x + dx, y: quad[1].y + dy },
    { x: quad[2].x + dx, y: quad[2].y + dy },
    { x: quad[3].x + dx, y: quad[3].y + dy },
  ];
}
