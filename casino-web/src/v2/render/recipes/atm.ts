// atm.ts — V2 recipe for ATM.
//
// 1×1 wall service. Compact wall-mounted machine: small inset body,
// lit screen, card-slot and cash-slot strips, brass trim.
//
// Phase 5.2: facade occupies lower 55 % of wall height. Plain wall
// remains visible above so the ATM reads as an inset device rather
// than a full-height fixture.
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_MID, WOOD_DARK, BRASS, BRASS_HIGHLIGHT,
  SCREEN_DARK, SCREEN_GLOW,
} from '../PaletteV2';
import { getWallSection, drawWallVoid, drawFacadeRect } from './wallShared';

const ATM_FACADE_FRACTION = 0.55;

export function drawATM(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha } = ctx;
  const F = ATM_FACADE_FRACTION;

  drawWallVoid(g, section, alpha, F);

  // Wood wainscot lower band of the facade.
  drawFacadeRect(g, section, 0.0, 1.0, 0.0, 0.28, F, WOOD_MID, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.27, 0.28, F, WOOD_DARK, alpha * 0.8);

  // Machine body — dark inset, vertically tall within the facade.
  drawFacadeRect(g, section, 0.20, 0.80, 0.30, 0.92, F, WOOD_DARK, alpha);
  // Brass trim around the body.
  drawFacadeRect(g, section, 0.18, 0.20, 0.30, 0.92, F, BRASS, alpha * 0.85);
  drawFacadeRect(g, section, 0.80, 0.82, 0.30, 0.92, F, BRASS, alpha * 0.85);
  drawFacadeRect(g, section, 0.18, 0.82, 0.90, 0.92, F, BRASS, alpha * 0.85);
  drawFacadeRect(g, section, 0.18, 0.82, 0.30, 0.32, F, BRASS, alpha * 0.85);

  // Screen — upper portion of the machine.
  drawFacadeRect(g, section, 0.24, 0.76, 0.62, 0.88, F, SCREEN_DARK, alpha);
  if (alpha >= 0.9) {
    drawFacadeRect(g, section, 0.24, 0.76, 0.62, 0.88, F, SCREEN_GLOW, 0.35);
    // Bright pip catch-light.
    drawFacadeRect(g, section, 0.28, 0.40, 0.78, 0.85, F, BRASS_HIGHLIGHT, 0.6);
  }

  // Card slot — slim horizontal strip below the screen.
  drawFacadeRect(g, section, 0.28, 0.72, 0.54, 0.58, F, BRASS_HIGHLIGHT, alpha * 0.9);
  // Cash slot — wider strip at the bottom of the body.
  drawFacadeRect(g, section, 0.26, 0.74, 0.38, 0.44, F, BRASS, alpha * 0.85);
}
