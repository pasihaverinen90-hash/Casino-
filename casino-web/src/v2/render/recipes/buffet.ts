// buffet.ts — V2 recipe for BUFFET.
//
// 4×1 wall service. Hot-food bay with chafing-dish domes on a counter,
// glass sneeze-guard highlight, warm light glow, brass trim. Reads as
// distinct from Bar (no bottles, domes instead).
//
// Phase 5.2: facade occupies lower 68 % of wall — substantial but
// noticeably shorter than the bar (75 %) and leaves plain wall +
// brass cap visible above.
import Phaser from 'phaser';
import type { RecipeContext } from './RecipeContext';
import {
  WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT,
  SHADOW, SCREEN_GLOW,
} from '../PaletteV2';
import {
  WallSection, getWallSection, drawWallVoid,
  drawFacadeRect, facadeCenter,
} from './wallShared';

const BUFFET_FACADE_FRACTION = 0.68;

export function drawBuffet(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;
  const F = BUFFET_FACADE_FRACTION;

  drawWallVoid(g, section, alpha, F);

  // Counter base (facade 0.0 → 0.30).
  drawFacadeRect(g, section, 0.0, 1.0, 0.0,  0.30, F, WOOD_MID, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.0,  0.05, F, BRASS, alpha * 0.75);
  drawFacadeRect(g, section, 0.0, 1.0, 0.30, 0.34, F, BRASS, alpha * 0.9);

  // Hot-food bay (facade 0.34 → 0.62) — darker recessed band where the food sits.
  drawFacadeRect(g, section, 0.0, 1.0, 0.34, 0.62, F, SHADOW, alpha * 0.85);
  // Warm glow across the bay — implies heat lamps.
  if (alpha >= 0.9) {
    drawFacadeRect(g, section, 0.0, 1.0, 0.34, 0.62, F, SCREEN_GLOW, 0.18);
  }

  // Chafing-dish domes along the bay.
  _paintDomes(g, section, F, alpha);

  // Sneeze guard — slim semi-transparent band right above the domes.
  drawFacadeRect(g, section, 0.04, 0.96, 0.62, 0.65, F, BRASS_HIGHLIGHT, alpha * 0.35);

  // Upper wall portion of the facade (above the bay).
  drawFacadeRect(g, section, 0.0, 1.0, 0.66, 0.88, F, WOOD_DARK, alpha * 0.85);

  // Brass cornice along the top of the facade.
  drawFacadeRect(g, section, 0.0, 1.0, 0.86, 0.92, F, BRASS, alpha);
  drawFacadeRect(g, section, 0.0, 1.0, 0.90, 0.92, F, BRASS_HIGHLIGHT, alpha * 0.9);

  // Sign plaque centred near the top of the facade.
  if (ts >= 18) {
    drawFacadeRect(g, section, 0.36, 0.64, 0.92, 0.98, F, WOOD_DARK, alpha);
    drawFacadeRect(g, section, 0.37, 0.63, 0.93, 0.97, F, BRASS_HIGHLIGHT, alpha * 0.8);
  }
  // Tiny warm pip in the plaque at large zoom — sells "warm light".
  if (ts >= 22) {
    const c = facadeCenter(section, F, 0.95);
    g.fillStyle(SCREEN_GLOW, alpha * 0.75);
    g.fillCircle(c.x, c.y, Math.max(1, ts * 0.06));
  }
}

// 3–6 brass domes evenly spaced across the bay (centre y ≈ 50 % of facade).
function _paintDomes(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  facadeFraction: number,
  alpha: number,
): void {
  const facadeHeightPx = section.wallPx * facadeFraction;
  const widthPx  = Math.hypot(
    section.bottomB.x - section.bottomA.x,
    section.bottomB.y - section.bottomA.y,
  );
  const yCentre  = facadeHeightPx * 0.50;
  const domeR    = Math.max(3, section.ts * 0.18);
  const targetSpacingPx = Math.max(20, section.ts * 0.75);
  const n        = Math.max(3, Math.min(6, Math.round(widthPx / targetSpacingPx)));

  for (let i = 0; i < n; i++) {
    const fx = (i + 0.5) / n;
    const bx = section.bottomA.x + (section.bottomB.x - section.bottomA.x) * fx;
    const by = section.bottomA.y + (section.bottomB.y - section.bottomA.y) * fx;
    const dx = bx;
    const dy = by - yCentre;
    g.fillStyle(BRASS, alpha);
    g.fillEllipse(dx, dy, domeR * 2, domeR * 1.2);
    g.fillStyle(BRASS_HIGHLIGHT, alpha * 0.85);
    g.fillEllipse(dx - domeR * 0.3, dy - domeR * 0.25, domeR * 0.9, domeR * 0.5);
  }
}
