// keno.ts — V2 recipe for KENO_LOUNGE.
//
// 3×3 floor table with a central display unit. Same low-rim composition
// as small/large tables, plus a small extruded box on the centre tile
// that reads as the keno number display.
import * as Proj from '../ProjectionV2';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SCREEN_DARK, SCREEN_GLOW,
} from '../PaletteV2';
import type { RecipeContext } from './RecipeContext';
import {
  offsetQuad, liftQuad, fillQuad,
  drawSoftShadow, drawStoolAtTileCenter,
} from './drawHelpers';
import { feltColorForVariant, drawFeltRim } from './tableShared';

// Phase 5.4 — slightly thicker rim so the keno table reads as
// physical furniture; display height unchanged (still the dominant
// silhouette cue vs. regular tables).
const KENO_RIM_HEIGHT_TILES     = 0.28;
const KENO_DISPLAY_HEIGHT_TILES = 0.50;

export function drawKeno(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  // ── Felt body (same shape as a large table) ─────────────────────────────
  const floor = offsetQuad(
    Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts),
    baseX, baseY,
  );
  drawSoftShadow(g, floor, alpha);

  const felt = liftQuad(floor, KENO_RIM_HEIGHT_TILES, ts);

  const southRim: Proj.Vec2[] = [floor[3], floor[2], felt[2], felt[3]];
  const eastRim:  Proj.Vec2[] = [floor[1], floor[2], felt[2], felt[1]];
  fillQuad(g, southRim, WOOD_MID, alpha);
  fillQuad(g, eastRim,  WOOD_DARK, alpha);

  fillQuad(g, felt, feltColorForVariant(obj.variant ?? ''), alpha);
  drawFeltRim(g, felt, alpha);

  // ── Central display unit ────────────────────────────────────────────────
  // Sits on top of the felt at the centre tile. For odd 3×3 keno the
  // centre is (col + 1, row + 1); for any other footprint we fall back
  // to the geometric centre.
  const cTileCol = obj.col + Math.floor(obj.w / 2);
  const cTileRow = obj.row + Math.floor(obj.h / 2);
  const dFloor = offsetQuad(Proj.tileQuad(cTileCol, cTileRow, ts), baseX, baseY);
  const dBase  = liftQuad(dFloor, KENO_RIM_HEIGHT_TILES, ts);
  const dTop   = liftQuad(dFloor, KENO_RIM_HEIGHT_TILES + KENO_DISPLAY_HEIGHT_TILES, ts);

  // South face = the display screen.
  const dSouth: Proj.Vec2[] = [dBase[3], dBase[2], dTop[2], dTop[3]];
  fillQuad(g, dSouth, SCREEN_DARK, alpha);
  if (alpha >= 0.9) {
    fillQuad(g, dSouth, SCREEN_GLOW, 0.30);
  }
  // Side and top.
  const dEast: Proj.Vec2[] = [dBase[1], dBase[2], dTop[2], dTop[1]];
  fillQuad(g, dEast, WOOD_DARK, alpha);
  fillQuad(g, dTop,  WOOD_MID,  alpha);

  // Brass cap rail along the top of the screen face.
  if (ts >= 18) {
    const capQuad: Proj.Vec2[] = [
      { x: dSouth[3].x, y: dSouth[3].y + Math.max(1, ts * 0.04) },
      { x: dSouth[2].x, y: dSouth[2].y + Math.max(1, ts * 0.04) },
      dSouth[2],
      dSouth[3],
    ];
    fillQuad(g, capQuad, BRASS, alpha * 0.85);
  }

  // Small bright pip on the screen — implies a "live number" display.
  if (alpha >= 0.9 && ts >= 18) {
    const pipFloor = offsetQuad(
      Proj.tileQuad(cTileCol, cTileRow, ts), baseX, baseY,
    );
    const pipLifted = liftQuad(pipFloor, KENO_RIM_HEIGHT_TILES + KENO_DISPLAY_HEIGHT_TILES * 0.55, ts);
    const pcx = (pipLifted[2].x + pipLifted[3].x) / 2;
    const pcy = (pipLifted[2].y + pipLifted[3].y) / 2;
    g.fillStyle(BRASS_HIGHLIGHT, 0.9);
    g.fillCircle(pcx, pcy, Math.max(2, ts * 0.08));
  }

  // ── Player stools ───────────────────────────────────────────────────────
  for (const s of obj.seats) {
    drawStoolAtTileCenter(g, s.x, s.y, baseX, baseY, ts, alpha);
  }
}
