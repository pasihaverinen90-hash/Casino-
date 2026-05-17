// cashier.ts — V2 recipe for CASHIER.
//
// 1×1 wall service. Counter window centred on a brass-trimmed frame,
// dark glass with a small attendant silhouette behind it, lower counter
// ledge, brass coin pip as the "$" cue.
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT, SHADOW, SCREEN_DARK,
} from '../PaletteV2';
import {
  getWallSection, drawWallVoid, drawInsetRectOnWall, wallCenter,
} from './wallShared';

export function drawCashier(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;

  drawWallVoid(g, section, alpha);

  // Wood wainscot lower band.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0, 0.32, WOOD_MID, alpha);

  // Counter ledge — a slightly brighter wood band on top of the
  // wainscot, suggesting the lip of the counter.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.30, 0.36, WOOD_DARK, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.34, 0.36, BRASS, alpha * 0.75);

  // Window frame — brass border around the glass.
  drawInsetRectOnWall(g, section, 0.10, 0.90, 0.40, 0.86, BRASS, alpha);
  // Dark glass interior.
  drawInsetRectOnWall(g, section, 0.16, 0.84, 0.44, 0.82, SCREEN_DARK, alpha);

  // Soft glass reflection across the top of the window.
  drawInsetRectOnWall(g, section, 0.18, 0.50, 0.74, 0.80, BRASS_HIGHLIGHT, alpha * 0.20);

  // Attendant silhouette behind the glass — a dark torso + a small
  // head. Always inside the window inset so it stays clipped.
  if (ts >= 18) {
    const cBody  = wallCenter(section, 0.55);
    const torsoW = Math.max(3, ts * 0.18);
    const torsoH = Math.max(3, ts * 0.20);
    g.fillStyle(SHADOW, alpha * 0.85);
    g.fillEllipse(cBody.x, cBody.y, torsoW, torsoH);
    const cHead = wallCenter(section, 0.66);
    g.fillCircle(cHead.x, cHead.y, Math.max(2, ts * 0.07));
  }

  // Coin pip = "$" cue. Bright brass disk on top of the window frame.
  if (ts >= 16) {
    const cPip = wallCenter(section, 0.92);
    const r    = Math.max(2, ts * 0.10);
    g.fillStyle(BRASS, alpha);
    g.fillCircle(cPip.x, cPip.y, r);
    g.lineStyle(1, BRASS_HIGHLIGHT, alpha);
    g.strokeCircle(cPip.x, cPip.y, r);
  }
}
