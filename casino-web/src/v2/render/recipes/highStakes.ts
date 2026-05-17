// highStakes.ts — V2 recipe for HIGH_STAKES_TABLE.
//
// 3×3 premium floor table. Taller rim than regular tables, deeper felt,
// ornate centrepiece (large brass disk + concentric ring + inner pip),
// brass corner studs. Variant 'high-roller' uses red felt; 'baccarat'
// (and anything else) uses standard green.
import * as Proj from '../ProjectionV2';
import {
  WOOD_DARK, WOOD_MID,
  FELT_GREEN, FELT_HIGH_STAKES,
  BRASS, BRASS_HIGHLIGHT, SHADOW,
} from '../PaletteV2';
import type { RecipeContext } from './RecipeContext';
import {
  offsetQuad, liftQuad, fillQuad,
  drawSoftShadow, drawStoolAtTileCenter,
} from './drawHelpers';

const HIGH_STAKES_RIM_HEIGHT_TILES = 0.25;

export function drawHighStakes(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  const floor = offsetQuad(
    Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts),
    baseX, baseY,
  );
  drawSoftShadow(g, floor, alpha);

  const felt = liftQuad(floor, HIGH_STAKES_RIM_HEIGHT_TILES, ts);

  // Thicker premium rim — same composition as regular tables but
  // visually heavier because the height is greater.
  const southRim: Proj.Vec2[] = [floor[3], floor[2], felt[2], felt[3]];
  const eastRim:  Proj.Vec2[] = [floor[1], floor[2], felt[2], felt[1]];
  fillQuad(g, southRim, WOOD_MID, alpha);
  fillQuad(g, eastRim,  WOOD_DARK, alpha);

  // Felt — red for high-roller, green for everything else (baccarat
  // included; the default is the conservative "premium green" look).
  const variant = obj.variant ?? '';
  const feltColor = (variant === 'high-roller') ? FELT_HIGH_STAKES : FELT_GREEN;
  fillQuad(g, felt, feltColor, alpha);

  // Double brass rim — 3 px outer + 1 px highlight inner for the "ornate"
  // premium feel without spending much time.
  g.lineStyle(3, BRASS, alpha * 0.92);
  g.strokePoints(felt, true);
  g.lineStyle(1, BRASS_HIGHLIGHT, alpha * 0.85);
  g.strokePoints(felt, true);

  // Centrepiece: large brass disk + dark ring + inner pip.
  const centre = Proj.liftPoint(
    Proj.footprintCenter(obj.col, obj.row, obj.w, obj.h, ts),
    HIGH_STAKES_RIM_HEIGHT_TILES, ts,
  );
  const cx = centre.x + baseX;
  const cy = centre.y + baseY;
  const r  = Math.max(4, ts * 0.42);

  g.fillStyle(BRASS, alpha);
  g.fillCircle(cx, cy, r);
  g.lineStyle(2, BRASS_HIGHLIGHT, alpha);
  g.strokeCircle(cx, cy, r);
  g.fillStyle(SHADOW, alpha * 0.65);
  g.fillCircle(cx, cy, r * 0.62);
  g.fillStyle(BRASS_HIGHLIGHT, alpha);
  g.fillCircle(cx, cy, Math.max(1, r * 0.22));

  // Brass corner studs at the four felt corners.
  const studR = Math.max(2, ts * 0.10);
  for (const c of felt) {
    g.fillStyle(BRASS, alpha * 0.9);
    g.fillCircle(c.x, c.y, studR);
    g.fillStyle(BRASS_HIGHLIGHT, alpha * 0.7);
    g.fillCircle(c.x - studR * 0.3, c.y - studR * 0.3, Math.max(1, studR * 0.4));
  }

  // Player stools.
  for (const s of obj.seats) {
    drawStoolAtTileCenter(g, s.x, s.y, baseX, baseY, ts, alpha);
  }
}
