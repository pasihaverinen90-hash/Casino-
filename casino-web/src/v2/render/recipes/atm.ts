// atm.ts — V2 recipe for ATM.
//
// 1×1 wall service. Compact wall-mounted machine: small inset body,
// lit screen, card-slot and cash-slot strips, brass trim.
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_MID, WOOD_DARK, BRASS, BRASS_HIGHLIGHT,
  SCREEN_DARK, SCREEN_GLOW,
} from '../PaletteV2';
import { getWallSection, drawWallVoid, drawInsetRectOnWall } from './wallShared';

export function drawATM(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha } = ctx;

  drawWallVoid(g, section, alpha);

  // Wood wainscot lower band.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0, 0.28, WOOD_MID, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.27, 0.28, WOOD_DARK, alpha * 0.8);

  // Machine body — dark inset within the wall, vertically tall.
  drawInsetRectOnWall(g, section, 0.20, 0.80, 0.30, 0.92, WOOD_DARK, alpha);
  // Brass trim around the body.
  drawInsetRectOnWall(g, section, 0.18, 0.20, 0.30, 0.92, BRASS, alpha * 0.85);
  drawInsetRectOnWall(g, section, 0.80, 0.82, 0.30, 0.92, BRASS, alpha * 0.85);
  drawInsetRectOnWall(g, section, 0.18, 0.82, 0.90, 0.92, BRASS, alpha * 0.85);
  drawInsetRectOnWall(g, section, 0.18, 0.82, 0.30, 0.32, BRASS, alpha * 0.85);

  // Screen — upper portion of the machine.
  drawInsetRectOnWall(g, section, 0.24, 0.76, 0.62, 0.88, SCREEN_DARK, alpha);
  if (alpha >= 0.9) {
    drawInsetRectOnWall(g, section, 0.24, 0.76, 0.62, 0.88, SCREEN_GLOW, 0.35);
    // Bright pip catch-light.
    drawInsetRectOnWall(g, section, 0.28, 0.40, 0.78, 0.85, BRASS_HIGHLIGHT, 0.6);
  }

  // Card slot — slim horizontal strip below the screen.
  drawInsetRectOnWall(g, section, 0.28, 0.72, 0.54, 0.58, BRASS_HIGHLIGHT, alpha * 0.9);
  // Cash slot — wider strip at the bottom of the body.
  drawInsetRectOnWall(g, section, 0.26, 0.74, 0.38, 0.44, BRASS, alpha * 0.85);
}
