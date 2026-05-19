// bar.ts — V2 recipe for BAR.
//
// 8×1 wall service. Long facade with two clearly readable bands:
//   • upper: dark backbar with rows of bottle silhouettes
//   • lower: brass-trimmed counter with a faint highlight
// Brass cornice along the top of the facade, brass kickplate along the
// bottom.
//
// The facade occupies the lower 75 % of the wall height —
// bigger than the small services because a real bar is a substantial
// wall feature — but plain wall + brass cap rail from WallRendererV2
// remain visible above.
import Phaser from 'phaser';
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SHADOW, SCREEN_GLOW,
} from '../PaletteV2';
import {
  WallSection, getWallSection, drawWallVoid,
  drawFacadeRect, drawWallBand, facadePx as computeFacadePx,
} from './wallShared';

const BAR_FACADE_FRACTION = 0.75;

export function drawBar(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;
  const F = BAR_FACADE_FRACTION;

  drawWallVoid(g, section, alpha, F);

  // Lower counter (facade 0.0 → 0.34) — warm wood with a brass
  // kickplate at the very base and a slim brass lip on top.
  drawFacadeRect(g, section, 0.0, 1.0, 0.0,  0.34, F, WOOD_MID, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.0,  0.06, F, BRASS, alpha * 0.75);
  drawFacadeRect(g, section, 0.0, 1.0, 0.32, 0.36, F, BRASS, alpha * 0.9);
  drawFacadeRect(g, section, 0.0, 1.0, 0.34, 0.36, F, BRASS_HIGHLIGHT, alpha * 0.8);

  // Backbar band (facade 0.36 → 0.86) — dark backdrop for bottles.
  drawFacadeRect(g, section, 0.0, 1.0, 0.36, 0.86, F, SHADOW, alpha * 0.85);

  // Bottle silhouettes across the backbar.
  _paintBottles(g, section, F, alpha);

  // Brass cornice along the top of the facade.
  drawFacadeRect(g, section, 0.0, 1.0, 0.86, 0.92, F, BRASS, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.90, 0.92, F, BRASS_HIGHLIGHT, alpha * 0.9);

  // Sign plaque centred above the bottles.
  if (ts >= 18) {
    drawFacadeRect(g, section, 0.42, 0.58, 0.92, 0.98, F, WOOD_DARK, alpha);
    drawFacadeRect(g, section, 0.43, 0.57, 0.93, 0.97, F, BRASS_HIGHLIGHT, alpha * 0.9);
    if (ts >= 22) {
      // Thin warm glow strip just below the top of the facade.
      const px = computeFacadePx(section, F);
      drawWallBand(g, section, px * 0.94, px * 0.96, SCREEN_GLOW, alpha * 0.5);
    }
  }
}

// Paint a row of bottle silhouettes across the backbar. Bottle count
// scales with section width — clamped so it stays readable at all
// zoom levels.
function _paintBottles(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  facadeFraction: number,
  alpha: number,
): void {
  const widthPx = Math.hypot(
    section.bottomB.x - section.bottomA.x,
    section.bottomB.y - section.bottomA.y,
  );
  const targetSpacingPx = Math.max(12, section.ts * 0.55);
  const n = Math.max(4, Math.min(14, Math.round(widthPx / targetSpacingPx)));

  const bottleW   = Math.min(0.06, 1 / (n * 1.5));
  const startGap  = (1 - n * bottleW * 1.5) / 2;
  const stride    = bottleW * 1.5;

  for (let i = 0; i < n; i++) {
    const x = startGap + i * stride;
    drawFacadeRect(g, section, x, x + bottleW, 0.42, 0.80, facadeFraction, WOOD_DARK, alpha * 0.95);
    drawFacadeRect(g, section, x, x + bottleW, 0.42, 0.78, facadeFraction, _bottleColor(i), alpha * 0.7);
    drawFacadeRect(g, section, x + bottleW * 0.30, x + bottleW * 0.70, 0.78, 0.84, facadeFraction, BRASS_HIGHLIGHT, alpha * 0.85);
  }
}

function _bottleColor(i: number): number {
  switch (i % 3) {
    case 0:  return WOOD_DARK;
    case 1:  return SHADOW;
    default: return WOOD_MID;
  }
}
