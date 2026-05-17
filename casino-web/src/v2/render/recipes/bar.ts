// bar.ts — V2 recipe for BAR.
//
// 8×1 wall service. Long facade with two clearly readable bands:
//   • upper: dark backbar with rows of bottle silhouettes
//   • lower: brass-trimmed counter with a faint highlight
// Brass cornice along the top, brass kickplate along the bottom.
import Phaser from 'phaser';
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SHADOW, SCREEN_GLOW,
} from '../PaletteV2';
import {
  WallSection, getWallSection, drawWallVoid,
  drawInsetRectOnWall, drawWallBand,
} from './wallShared';

export function drawBar(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;

  drawWallVoid(g, section, alpha);

  // Lower counter (0.0 → 0.34 of wall height) — warm wood with a brass
  // kickplate at the very base and a slim brass lip on top.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0,  0.34, WOOD_MID, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0,  0.06, BRASS,    alpha * 0.75);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.32, 0.36, BRASS,    alpha * 0.9);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.34, 0.36, BRASS_HIGHLIGHT, alpha * 0.8);

  // Backbar band (0.36 → 0.86) — dark backdrop for bottles.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.36, 0.86, SHADOW, alpha * 0.85);

  // Bottle silhouettes across the backbar. Spacing scales with the
  // section width so an 8-tile bar gets ~10 bottles, smaller bars get
  // proportionally fewer. Always at least 4 bottles so the bar reads
  // as "stocked" even at extreme zoom.
  _paintBottles(g, section, alpha);

  // Brass cornice along the top of the section.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.86, 0.92, BRASS, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.90, 0.92, BRASS_HIGHLIGHT, alpha * 0.9);

  // Sign plaque centred above the bottles.
  if (ts >= 18) {
    drawInsetRectOnWall(g, section, 0.42, 0.58, 0.92, 0.98, WOOD_DARK, alpha);
    drawInsetRectOnWall(g, section, 0.43, 0.57, 0.93, 0.97, BRASS_HIGHLIGHT, alpha * 0.9);
    // Three tiny brass pips suggest "neon" inside the plaque.
    if (ts >= 22) {
      const wallPx = section.wallPx;
      drawWallBand(g, section, wallPx * 0.94, wallPx * 0.96, SCREEN_GLOW, alpha * 0.5);
    }
  }
}

// Paint a row of bottle silhouettes across the backbar. Each bottle is
// a thin vertical strip with a slightly brighter neck dot — bottle
// shape implied by the silhouette + colour without rendering details.
function _paintBottles(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  alpha: number,
): void {
  // Scale bottle count to section width — clamp so it stays readable.
  const widthPx = Math.hypot(
    section.bottomB.x - section.bottomA.x,
    section.bottomB.y - section.bottomA.y,
  );
  const targetSpacingPx = Math.max(12, section.ts * 0.55);
  const n = Math.max(4, Math.min(14, Math.round(widthPx / targetSpacingPx)));

  const bottleW   = Math.min(0.06, 1 / (n * 1.5));   // fraction of section width
  const startGap  = (1 - n * bottleW * 1.5) / 2;
  const stride    = bottleW * 1.5;

  for (let i = 0; i < n; i++) {
    const x = startGap + i * stride;
    // Bottle body — long thin rectangle on the backbar.
    drawInsetRectOnWall(g, section, x, x + bottleW, 0.42, 0.80, WOOD_DARK, alpha * 0.95);
    drawInsetRectOnWall(g, section, x, x + bottleW, 0.42, 0.78, _bottleColor(i), alpha * 0.7);
    // Neck — slim strip above the bottle body.
    drawInsetRectOnWall(g, section, x + bottleW * 0.30, x + bottleW * 0.70, 0.78, 0.84, BRASS_HIGHLIGHT, alpha * 0.85);
  }
}

// Rotate through three warm bottle tints so the bar doesn't read as a
// row of identical strips. All earthy / amber so it stays inside the
// premium casino palette.
function _bottleColor(i: number): number {
  switch (i % 3) {
    case 0:  return WOOD_DARK;
    case 1:  return SHADOW;
    default: return WOOD_MID;
  }
}
