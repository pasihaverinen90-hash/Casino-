// slot.ts — V2 recipe for SLOT_MACHINE.
//
// Footprint is 1×2 (or 2×1 horizontal). The footprint splits into a
// cabinet tile and a chair tile per GC.slotParts(). The cabinet extrudes
// upward by SLOT_CABINET_HEIGHT_TILES — a *recipe-local* constant, not
// wallVerticalOffset (walls and floor objects are independent height
// concerns). The chair tile stays at floor level and gets a small
// stool glyph.
//
// Visible cabinet faces: top + south + east (looking at the dimetric
// room from south-east toward north-west). North and west faces are
// hidden behind the cabinet itself.
import * as GC from '../../../logic/GameConstants';
import * as Proj from '../ProjectionV2';
import {
  WOOD_DARK, WOOD_MID,
  BRASS, BRASS_HIGHLIGHT,
  SLOT_BODY, SCREEN_DARK, SCREEN_GLOW,
} from '../PaletteV2';
import type { RecipeContext } from './RecipeContext';
import {
  offsetQuad, liftQuad, fillQuad, insetFace,
  drawSoftShadow, drawStoolAtTileCenter,
} from './drawHelpers';

// Per-recipe height. Independent of wall height — wall and floor object
// heights are unrelated. Tune here without touching any other file.
const SLOT_CABINET_HEIGHT_TILES = 0.85;

export function drawSlot(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  // Split into cabinet + chair via the existing orientation helper.
  // Both come back as absolute tile coordinates.
  const { seat, machine } = GC.slotParts(obj.col, obj.row, obj.facing);

  // ── Cabinet ─────────────────────────────────────────────────────────────
  const floor = offsetQuad(Proj.tileQuad(machine.x, machine.y, ts), baseX, baseY);
  const top   = liftQuad(floor, SLOT_CABINET_HEIGHT_TILES, ts);

  // 1. Floor shadow under the cabinet tile.
  drawSoftShadow(g, floor, alpha);

  // 2. Plinth — a thin darker base just above the carpet so the cabinet
  //    feels rooted. Re-use the floor parallelogram with dark wood at
  //    a higher alpha than the shadow.
  fillQuad(g, floor, WOOD_DARK, alpha * 0.85);

  // 3. East side face (between floor TR→BR and top TR→BR). Slightly
  //    darker than the front face so the cabinet reads as 3D.
  const eastFace: Proj.Vec2[] = [
    floor[1], floor[2], top[2], top[1],
  ];
  fillQuad(g, eastFace, WOOD_MID, alpha);

  // 4. South (front) face — main brass-gold cabinet panel.
  const southFace: Proj.Vec2[] = [
    floor[3], floor[2], top[2], top[3],
  ];
  fillQuad(g, southFace, SLOT_BODY, alpha);

  // 5. Top face — slightly brighter brass. Acts as the "lid" of the box.
  fillQuad(g, top, BRASS, alpha);

  // 6. Brass cap rail across the top edge of the south face, plus a
  //    sliver highlight just above it on the lid. Adds dimensional
  //    separation between the front panel and the top.
  const capBand = insetFace(southFace, /*insetBottom*/ 0.86, /*insetTop*/ 0.00, /*insetSide*/ 0.0);
  fillQuad(g, capBand, BRASS, alpha);
  const capHighlight = insetFace(southFace, /*insetBottom*/ 0.94, /*insetTop*/ 0.00, /*insetSide*/ 0.05);
  if (ts >= 22) fillQuad(g, capHighlight, BRASS_HIGHLIGHT, alpha * 0.85);

  // 7. Screen on the south face — dark inset bezel with optional glow.
  //    Use the projection-aware insetFace so the screen rides the same
  //    shear as the cabinet (looks correct at all zoom levels).
  const screen = insetFace(southFace, /*insetBottom*/ 0.40, /*insetTop*/ 0.18, /*insetSide*/ 0.18);
  fillQuad(g, screen, SCREEN_DARK, alpha);
  // Lit screen glow — only at strong alpha so inert slots don't appear
  // to be still running. The glow is a soft wash; a small bright pip
  // adds a catch-light.
  if (alpha >= 0.9) {
    fillQuad(g, screen, SCREEN_GLOW, 0.35);
    const pip = insetFace(screen, 0.55, 0.10, 0.55);
    fillQuad(g, pip, 0xffffff, 0.45);
  }

  // ── Chair tile ─────────────────────────────────────────────────────────
  // Small stool glyph at the chair tile centre. Stays at floor level —
  // the guest stands on this tile while using the slot.
  drawStoolAtTileCenter(g, seat.x, seat.y, baseX, baseY, ts, alpha);
}
