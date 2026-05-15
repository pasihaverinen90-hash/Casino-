// largeTable.ts — V2 recipe for LARGE_TABLE.
//
// 2×4 footprint (or 4×2 horizontal). Same composition as small table
// with a slightly taller rim and a larger centrepiece. Variant 'craps'
// swaps to red felt; 'roulette' gets a wheel-like inner disk.
import * as Proj from '../ProjectionV2';
import { WOOD_MID, WOOD_DARK } from '../PaletteV2';
import type { RecipeContext } from './RecipeContext';
import {
  offsetQuad, liftQuad, fillQuad,
  drawSoftShadow, drawStoolAtTileCenter,
} from './drawHelpers';
import {
  feltColorForVariant, drawDealerBand, drawTableCenterpiece, drawFeltRim,
} from './tableShared';

// Per-recipe rim height. Slightly taller than the small table so the
// premium tables feel more substantial without breaking the felt-on-top
// silhouette convention.
const LARGE_TABLE_RIM_HEIGHT_TILES = 0.20;

export function drawLargeTable(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  const floor = offsetQuad(
    Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts),
    baseX, baseY,
  );

  // 1. Shadow.
  drawSoftShadow(g, floor, alpha);

  // 2. Lift to felt.
  const felt = liftQuad(floor, LARGE_TABLE_RIM_HEIGHT_TILES, ts);

  // 3. Visible rim faces.
  const southRim: Proj.Vec2[] = [floor[3], floor[2], felt[2], felt[3]];
  const eastRim:  Proj.Vec2[] = [floor[1], floor[2], felt[2], felt[1]];
  fillQuad(g, southRim, WOOD_MID, alpha);
  fillQuad(g, eastRim,  WOOD_DARK, alpha);

  // 4. Felt top.
  fillQuad(g, felt, feltColorForVariant(obj.variant ?? ''), alpha);

  // 5. Brass rim trim.
  drawFeltRim(g, felt, alpha);

  // 6. Dealer band.
  drawDealerBand(g, obj, baseX, baseY, ts, alpha, LARGE_TABLE_RIM_HEIGHT_TILES);

  // 7. Variant centrepiece (larger than small table).
  drawTableCenterpiece(
    g, obj, baseX, baseY, ts, alpha,
    LARGE_TABLE_RIM_HEIGHT_TILES, /*isLarge*/ true,
  );

  // 8. Player stools.
  for (const s of obj.seats) {
    drawStoolAtTileCenter(g, s.x, s.y, baseX, baseY, ts, alpha);
  }
}
