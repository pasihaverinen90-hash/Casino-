// sportsbook.ts — V2 recipe for SPORTSBOOK.
//
// 4×1 wall service. Bank of lit screens above a slim ticker strip, all
// inside a brass-bordered frame. Reads as distinct from Bar (no
// bottles) and Buffet (no domes) — instead, multiple glowing rectangles
// dominate the wall.
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SCREEN_DARK, SCREEN_GLOW,
} from '../PaletteV2';
import {
  getWallSection, drawWallVoid, drawInsetRectOnWall,
} from './wallShared';

export function drawSportsbook(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;

  drawWallVoid(g, section, alpha);

  // Lower counter band (0.0 → 0.20).
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0,  0.20, WOOD_MID, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.18, 0.20, BRASS,    alpha * 0.85);

  // Ticker strip just above the counter (0.22 → 0.30) — a dim
  // amber-glow band suggesting odds scrolling across.
  drawInsetRectOnWall(g, section, 0.04, 0.96, 0.22, 0.30, SCREEN_DARK, alpha);
  if (alpha >= 0.9) {
    drawInsetRectOnWall(g, section, 0.04, 0.96, 0.22, 0.30, SCREEN_GLOW, 0.40);
  }

  // Screen bank — four lit panels across the upper wall. Each panel
  // has a dark base + glow overlay + a small bright pip. Spacing fits
  // any wall width because we walk normalised section coords.
  const PANEL_TOP   = 0.84;
  const PANEL_BOT   = 0.40;
  const N_PANELS    = 4;
  const PANEL_GAP   = 0.025;
  const PANEL_WIDTH = (1 - PANEL_GAP * (N_PANELS + 1)) / N_PANELS;

  for (let i = 0; i < N_PANELS; i++) {
    const x0 = PANEL_GAP + i * (PANEL_WIDTH + PANEL_GAP);
    const x1 = x0 + PANEL_WIDTH;

    // Brass frame (slightly larger than the screen).
    drawInsetRectOnWall(g, section, x0 - 0.005, x1 + 0.005, PANEL_BOT - 0.01, PANEL_TOP + 0.01, BRASS, alpha * 0.85);
    // Dark screen.
    drawInsetRectOnWall(g, section, x0, x1, PANEL_BOT, PANEL_TOP, SCREEN_DARK, alpha);
    // Lit glow.
    if (alpha >= 0.9) {
      drawInsetRectOnWall(g, section, x0, x1, PANEL_BOT, PANEL_TOP, SCREEN_GLOW, 0.32);
    }
    // A small bright pip in the upper-left to sell "active content".
    if (alpha >= 0.9 && ts >= 18) {
      const pipW = PANEL_WIDTH * 0.20;
      const pipY1 = PANEL_TOP - (PANEL_TOP - PANEL_BOT) * 0.20;
      const pipY2 = PANEL_TOP - 0.02;
      drawInsetRectOnWall(g, section, x0 + PANEL_WIDTH * 0.10, x0 + PANEL_WIDTH * 0.10 + pipW, pipY1, pipY2, BRASS_HIGHLIGHT, 0.85);
    }
  }

  // Brass cornice at the very top.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.88, 0.94, BRASS, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.92, 0.94, BRASS_HIGHLIGHT, alpha * 0.9);

  // Tiny sign plaque centred above the cornice.
  if (ts >= 18) {
    drawInsetRectOnWall(g, section, 0.40, 0.60, 0.94, 0.99, WOOD_DARK, alpha);
    drawInsetRectOnWall(g, section, 0.41, 0.59, 0.95, 0.98, BRASS_HIGHLIGHT, alpha * 0.85);
  }
}
