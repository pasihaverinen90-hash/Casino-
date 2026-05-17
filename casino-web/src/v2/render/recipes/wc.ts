// wc.ts — V2 recipe for WC.
//
// 3×1 wall service. Paints a wall section with a dark doorway cutout
// in the lower-middle, a small brass kickplate, and a brass sign plaque
// above the door with simple male/female figure dots as a pictogram
// hint (graphics-only — no Phaser.Text yet).
import type { RecipeContext } from './RecipeContext';
import {
  WALL_PANEL, WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT, SHADOW,
} from '../PaletteV2';
import {
  getWallSection, drawWallVoid, drawInsetRectOnWall, wallCenter,
} from './wallShared';

export function drawWC(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;

  // Dark wall panel base.
  drawWallVoid(g, section, alpha);

  // Wood wainscoting band along the bottom 28% — keeps the wall
  // composition consistent with the wider WallRendererV2 wall.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0, 0.28, WOOD_MID, alpha);

  // Door cutout — centred (~36% width), tall (0% to 72% height). Dark
  // recessed look using SHADOW so it reads as an opening.
  drawInsetRectOnWall(g, section, 0.32, 0.68, 0.00, 0.72, SHADOW, alpha);
  // Inner doorframe — slim brass border just inside the cutout edge.
  drawInsetRectOnWall(g, section, 0.32, 0.34, 0.00, 0.72, BRASS, alpha * 0.85);
  drawInsetRectOnWall(g, section, 0.66, 0.68, 0.00, 0.72, BRASS, alpha * 0.85);
  drawInsetRectOnWall(g, section, 0.32, 0.68, 0.70, 0.72, BRASS, alpha * 0.85);

  // Brass kickplate at the very bottom of the door.
  drawInsetRectOnWall(g, section, 0.34, 0.66, 0.00, 0.08, BRASS, alpha * 0.75);

  // Sign plaque above the door — brass frame + dark interior.
  drawInsetRectOnWall(g, section, 0.36, 0.64, 0.80, 0.94, BRASS, alpha);
  drawInsetRectOnWall(g, section, 0.38, 0.62, 0.82, 0.92, WALL_PANEL, alpha);

  // Two pictogram dots inside the plaque hinting at "people" — keeps
  // the WC distinguishable from a generic dark wall opening even at
  // low zoom. Sized in screen pixels so it stays visible at ts ≥ 14.
  if (ts >= 16) {
    const cTop  = wallCenter(section, 0.88);
    const dotR  = Math.max(2, ts * 0.07);
    const dx    = Math.max(3, ts * 0.10);
    g.fillStyle(BRASS_HIGHLIGHT, alpha);
    g.fillCircle(cTop.x - dx, cTop.y, dotR);
    g.fillCircle(cTop.x + dx, cTop.y, dotR);
  }

  // Subtle highlight band along the top of the wainscot — same trick
  // WallRendererV2 uses to define the panel/wainscot seam.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.28, 0.29, WOOD_DARK, alpha * 0.85);
}
