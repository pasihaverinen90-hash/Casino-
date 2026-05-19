// cashier.ts — V2 recipe for CASHIER.
//
// 1×1 wall service. Counter window centred on a brass-trimmed frame,
// dark glass with a small attendant silhouette behind it, lower counter
// ledge, brass coin pip as the "$" cue.
//
// Facade occupies lower 58 % of wall height. Plain wall
// remains visible above the facade.
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT, SHADOW, SCREEN_DARK,
} from '../PaletteV2';
import {
  getWallSection, drawWallVoid, drawFacadeRect, facadeCenter,
} from './wallShared';

const CASHIER_FACADE_FRACTION = 0.58;

export function drawCashier(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;
  const F = CASHIER_FACADE_FRACTION;

  drawWallVoid(g, section, alpha, F);

  // Wood wainscot lower band.
  drawFacadeRect(g, section, 0.0, 1.0, 0.0, 0.32, F, WOOD_MID, alpha);

  // Counter ledge — a slightly brighter wood band on top of the
  // wainscot, suggesting the lip of the counter.
  drawFacadeRect(g, section, 0.0, 1.0, 0.30, 0.36, F, WOOD_DARK, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.34, 0.36, F, BRASS, alpha * 0.75);

  // Window frame — brass border around the glass.
  drawFacadeRect(g, section, 0.10, 0.90, 0.40, 0.86, F, BRASS, alpha);
  // Dark glass interior.
  drawFacadeRect(g, section, 0.16, 0.84, 0.44, 0.82, F, SCREEN_DARK, alpha);

  // Soft glass reflection across the top of the window.
  drawFacadeRect(g, section, 0.18, 0.50, 0.74, 0.80, F, BRASS_HIGHLIGHT, alpha * 0.20);

  // Attendant silhouette behind the glass.
  if (ts >= 18) {
    const cBody  = facadeCenter(section, F, 0.55);
    const torsoW = Math.max(3, ts * 0.18);
    const torsoH = Math.max(3, ts * 0.20);
    g.fillStyle(SHADOW, alpha * 0.85);
    g.fillEllipse(cBody.x, cBody.y, torsoW, torsoH);
    const cHead = facadeCenter(section, F, 0.66);
    g.fillCircle(cHead.x, cHead.y, Math.max(2, ts * 0.07));
  }

  // Coin pip = "$" cue, on the brass band above the window.
  if (ts >= 16) {
    const cPip = facadeCenter(section, F, 0.92);
    const r    = Math.max(2, ts * 0.10);
    g.fillStyle(BRASS, alpha);
    g.fillCircle(cPip.x, cPip.y, r);
    g.lineStyle(1, BRASS_HIGHLIGHT, alpha);
    g.strokeCircle(cPip.x, cPip.y, r);
  }
}
