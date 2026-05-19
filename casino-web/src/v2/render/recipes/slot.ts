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
//
// Slot cabinet height of 1.10 reads as an upright machine, and
// the body is inset inside the tile so the cabinet is slimmer than the
// floor footprint (it stands on a small plinth). Cabinet : floor-tile
// ratio is now ≈ 1.10 : 0.80 ≈ 1.38, which feels like a stand-up
// machine rather than a low box.
const SLOT_CABINET_HEIGHT_TILES = 1.10;
const SLOT_BODY_INSET           = 0.10;   // fraction of tile, each side

export function drawSlot(ctx: RecipeContext): void {
  const { g, obj, baseX, baseY, ts, alpha } = ctx;

  // Split into cabinet + chair via the existing orientation helper.
  // Both come back as absolute tile coordinates.
  const { seat, machine } = GC.slotParts(obj.col, obj.row, obj.facing);

  // ── Cabinet ─────────────────────────────────────────────────────────────
  // The cabinet sits on the full tile (shadow + plinth) but the body
  // itself is inset, so the silhouette reads slimmer.
  const I = SLOT_BODY_INSET;
  const tile = offsetQuad(Proj.tileQuad(machine.x, machine.y, ts), baseX, baseY);
  const base = offsetQuad(
    Proj.footprintQuad(machine.x + I, machine.y + I, 1 - 2 * I, 1 - 2 * I, ts),
    baseX, baseY,
  );
  const top  = liftQuad(base, SLOT_CABINET_HEIGHT_TILES, ts);

  // 1. Floor shadow under the FULL tile so the cabinet feels grounded.
  drawSoftShadow(g, tile, alpha);

  // 2. Plinth — full tile in dark wood; the inset body stands on top.
  fillQuad(g, tile, WOOD_DARK, alpha * 0.85);

  // 3. East side face of the inset body (slightly darker than front
  //    so the cabinet reads as 3D).
  const eastFace: Proj.Vec2[] = [
    base[1], base[2], top[2], top[1],
  ];
  fillQuad(g, eastFace, WOOD_MID, alpha);

  // 4. South (front) face — main brass-gold cabinet panel.
  const southFace: Proj.Vec2[] = [
    base[3], base[2], top[2], top[3],
  ];
  fillQuad(g, southFace, SLOT_BODY, alpha);

  // 5. Top face — slightly brighter brass.
  fillQuad(g, top, BRASS, alpha);

  // 6. Brass cap rail across the top of the south face + sliver highlight.
  const capBand = insetFace(southFace, /*insetBottom*/ 0.88, /*insetTop*/ 0.00, /*insetSide*/ 0.00);
  fillQuad(g, capBand, BRASS, alpha);
  const capHighlight = insetFace(southFace, /*insetBottom*/ 0.95, /*insetTop*/ 0.00, /*insetSide*/ 0.05);
  if (ts >= 22) fillQuad(g, capHighlight, BRASS_HIGHLIGHT, alpha * 0.85);

  // 7. Marquee strip just below the cap — thin warm band reads as the
  //    backlit name plate above the screen at full zoom.
  if (ts >= 22) {
    const marquee = insetFace(southFace, /*insetBottom*/ 0.78, /*insetTop*/ 0.13, /*insetSide*/ 0.08);
    fillQuad(g, marquee, SLOT_BODY, alpha);
    fillQuad(g, marquee, BRASS_HIGHLIGHT, alpha * 0.30);
  }

  // 8. Screen — taller now that the cabinet is taller. Lower bottom inset
  //    pulls the screen further down the front; smaller side inset makes
  //    it wider relative to the slimmer cabinet face.
  const screen = insetFace(southFace, /*insetBottom*/ 0.22, /*insetTop*/ 0.26, /*insetSide*/ 0.14);
  fillQuad(g, screen, SCREEN_DARK, alpha);
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
