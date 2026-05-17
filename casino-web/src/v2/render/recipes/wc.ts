// wc.ts — V2 recipe for WC.
//
// 3×1 wall service. Paints a wall section with a dark doorway cutout
// in the lower-middle, a small brass kickplate, and a brass sign plaque
// above the door with simple male/female figure dots as a pictogram
// hint (graphics-only — no Phaser.Text yet).
//
// Phase 5.2: the facade occupies only the lower 60 % of the wall.
// WallRendererV2's upper panel + brass cap remain visible above so
// the WC reads as embedded into the wall, not a full-height fixture.
import type { RecipeContext } from './RecipeContext';
import {
  WALL_PANEL, WOOD_DARK, WOOD_MID, BRASS, BRASS_HIGHLIGHT, SHADOW,
} from '../PaletteV2';
import {
  getWallSection, drawWallVoid, drawFacadeRect, facadeCenter,
} from './wallShared';

// Fraction of full wall height the WC facade occupies. The remainder
// stays as plain wall painted by WallRendererV2.
const WC_FACADE_FRACTION = 0.60;

export function drawWC(ctx: RecipeContext): void {
  const section = getWallSection(ctx.obj, ctx.tiles, ctx.baseX, ctx.baseY, ctx.ts);
  if (!section) return;
  const { g, alpha, ts } = ctx;
  const F = WC_FACADE_FRACTION;

  // Dark wall panel base inside the facade band only.
  drawWallVoid(g, section, alpha, F);

  // Wood wainscoting along the bottom of the facade.
  drawFacadeRect(g, section, 0.0, 1.0, 0.0, 0.28, F, WOOD_MID, alpha);

  // Door cutout — centred (~36 % width), tall (0 % → 72 % of facade).
  drawFacadeRect(g, section, 0.32, 0.68, 0.00, 0.72, F, SHADOW, alpha);
  // Brass doorframe along the cutout edges.
  drawFacadeRect(g, section, 0.32, 0.34, 0.00, 0.72, F, BRASS, alpha * 0.85);
  drawFacadeRect(g, section, 0.66, 0.68, 0.00, 0.72, F, BRASS, alpha * 0.85);
  drawFacadeRect(g, section, 0.32, 0.68, 0.70, 0.72, F, BRASS, alpha * 0.85);

  // Brass kickplate at the very bottom of the door.
  drawFacadeRect(g, section, 0.34, 0.66, 0.00, 0.08, F, BRASS, alpha * 0.75);

  // Sign plaque above the door — brass frame + dark interior.
  drawFacadeRect(g, section, 0.36, 0.64, 0.80, 0.94, F, BRASS, alpha);
  drawFacadeRect(g, section, 0.38, 0.62, 0.82, 0.92, F, WALL_PANEL, alpha);

  // Two pictogram dots inside the plaque hinting at "people".
  if (ts >= 16) {
    const cTop  = facadeCenter(section, F, 0.88);
    const dotR  = Math.max(2, ts * 0.07);
    const dx    = Math.max(3, ts * 0.10);
    g.fillStyle(BRASS_HIGHLIGHT, alpha);
    g.fillCircle(cTop.x - dx, cTop.y, dotR);
    g.fillCircle(cTop.x + dx, cTop.y, dotR);
  }

  // Thin shadow stripe along the top of the wainscot — matches the
  // band the wider WallRendererV2 wall has just above the wainscot.
  drawFacadeRect(g, section, 0.0, 1.0, 0.28, 0.29, F, WOOD_DARK, alpha * 0.85);
}
