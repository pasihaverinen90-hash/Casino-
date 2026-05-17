// buffet.ts — V2 recipe for BUFFET.
//
// 4×1 wall service. Hot-food bay with chafing-dish domes on a counter,
// glass sneeze-guard highlight, warm light glow, brass trim. Reads as
// distinct from Bar (no bottles, domes instead).
import Phaser from 'phaser';
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SHADOW, SCREEN_GLOW,
} from '../PaletteV2';
import {
  WallSection, getWallSection, drawWallVoid,
  drawInsetRectOnWall, wallCenter,
} from './wallShared';

export function drawBuffet(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;

  drawWallVoid(g, section, alpha);

  // Counter base (0.0 → 0.30).
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0,  0.30, WOOD_MID, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.0,  0.05, BRASS,    alpha * 0.75);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.30, 0.34, BRASS,    alpha * 0.9);

  // Hot-food bay (0.34 → 0.62) — darker recessed band where the food sits.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.34, 0.62, SHADOW, alpha * 0.85);
  // Warm glow across the bay — implies heat lamps.
  if (alpha >= 0.9) {
    drawInsetRectOnWall(g, section, 0.0, 1.0, 0.34, 0.62, SCREEN_GLOW, 0.18);
  }

  // Chafing-dish domes along the bay.
  _paintDomes(g, section, alpha);

  // Sneeze guard — a thin glass band tilted in front of the bay. We
  // suggest it with a slim semi-transparent band right above the domes.
  drawInsetRectOnWall(g, section, 0.04, 0.96, 0.62, 0.65, BRASS_HIGHLIGHT, alpha * 0.35);

  // Upper wall (above the bay) — plain wood panel with a subtle band.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.66, 0.88, WOOD_DARK, alpha * 0.85);

  // Brass cornice along the top.
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.86, 0.92, BRASS, alpha);
  drawInsetRectOnWall(g, section, 0.0, 1.0, 0.90, 0.92, BRASS_HIGHLIGHT, alpha * 0.9);

  // Sign plaque centred above the bay.
  if (ts >= 18) {
    drawInsetRectOnWall(g, section, 0.36, 0.64, 0.92, 0.98, WOOD_DARK, alpha);
    drawInsetRectOnWall(g, section, 0.37, 0.63, 0.93, 0.97, BRASS_HIGHLIGHT, alpha * 0.8);
  }
  // Tiny warm pip in the plaque at large zoom — sells "warm light" cue.
  if (ts >= 22) {
    const c = wallCenter(section, 0.95);
    g.fillStyle(SCREEN_GLOW, alpha * 0.75);
    g.fillCircle(c.x, c.y, Math.max(1, ts * 0.06));
  }
}

// Five brass domes evenly spaced across the bay. Each is a half-ellipse
// drawn as a tight ellipse clipped by the band — we approximate with a
// filled ellipse centred at the dome's y, sized to fit inside the bay.
function _paintDomes(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  alpha: number,
): void {
  const wallPx   = section.wallPx;
  const widthPx  = Math.hypot(
    section.bottomB.x - section.bottomA.x,
    section.bottomB.y - section.bottomA.y,
  );
  const yCentre  = wallPx * 0.50;     // midway in the bay band
  const domeR    = Math.max(3, section.ts * 0.18);
  const targetSpacingPx = Math.max(20, section.ts * 0.75);
  const n        = Math.max(3, Math.min(6, Math.round(widthPx / targetSpacingPx)));

  // Walk along the bottom edge from x=0..1 in normalised section coords.
  for (let i = 0; i < n; i++) {
    const fx = (i + 0.5) / n;
    const bx = section.bottomA.x + (section.bottomB.x - section.bottomA.x) * fx;
    const by = section.bottomA.y + (section.bottomB.y - section.bottomA.y) * fx;
    const dx = bx;
    const dy = by - yCentre;
    g.fillStyle(BRASS, alpha);
    g.fillEllipse(dx, dy, domeR * 2, domeR * 1.2);
    // Highlight on the upper-left of the dome.
    g.fillStyle(BRASS_HIGHLIGHT, alpha * 0.85);
    g.fillEllipse(dx - domeR * 0.3, dy - domeR * 0.25, domeR * 0.9, domeR * 0.5);
  }
}
