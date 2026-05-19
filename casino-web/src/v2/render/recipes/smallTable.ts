// smallTable.ts — V2 recipe for SMALL_TABLE.
//
// 2×3 footprint (or 3×2 horizontal). Painted as a low extruded box with
// felt top: a thin vertical rim (south + east faces visible) and a felt
// parallelogram lifted by SMALL_TABLE_RIM_HEIGHT_TILES sits on top.
// Dealer band overlays the felt on the facing side; variant centrepiece
// at the felt centre; player-seat stools on the 3 non-dealer adjacent
// tiles (sourced from obj.seats — precomputed by GameState).
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

// Per-recipe rim height. Independent of wall height. Tables stay low
// because the felt is the read surface — too tall and they fight slots.
// Rim height 0.25 makes tables feel like physical low
// furniture rather than felt mats; still well under the new ~1.10
// slot cabinet height.
const SMALL_TABLE_RIM_HEIGHT_TILES = 0.25;

export function drawSmallTable(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  // Floor footprint.
  const floor = offsetQuad(
    Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts),
    baseX, baseY,
  );

  // 1. Soft floor shadow under the whole footprint.
  drawSoftShadow(g, floor, alpha);

  // 2. Lift to felt height.
  const felt = liftQuad(floor, SMALL_TABLE_RIM_HEIGHT_TILES, ts);

  // 3. Visible vertical rim faces — south (front) + east (right side).
  //    Both are thin strips since rim is only 0.18 tile tall.
  const southRim: Proj.Vec2[] = [floor[3], floor[2], felt[2], felt[3]];
  const eastRim:  Proj.Vec2[] = [floor[1], floor[2], felt[2], felt[1]];
  fillQuad(g, southRim, WOOD_MID, alpha);
  fillQuad(g, eastRim,  WOOD_DARK, alpha);

  // 4. Felt top.
  fillQuad(g, felt, feltColorForVariant(obj.variant ?? ''), alpha);

  // 5. Brass rim trim around the felt.
  drawFeltRim(g, felt, alpha);

  // 6. Dealer band on the facing side.
  drawDealerBand(g, obj, baseX, baseY, ts, alpha, SMALL_TABLE_RIM_HEIGHT_TILES);

  // 7. Variant centrepiece on the felt.
  drawTableCenterpiece(
    g, obj, baseX, baseY, ts, alpha,
    SMALL_TABLE_RIM_HEIGHT_TILES, /*isLarge*/ false,
  );

  // 8. Player stools on the 3 non-dealer adjacent tiles. obj.seats was
  //    precomputed at placement time so this is a straight iteration.
  for (const s of obj.seats) {
    drawStoolAtTileCenter(g, s.x, s.y, baseX, baseY, ts, alpha);
  }
}
