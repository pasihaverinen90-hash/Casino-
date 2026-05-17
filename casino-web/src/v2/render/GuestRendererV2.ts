// GuestRendererV2.ts — pure renderer for V2 guest billboards.
//
// Each guest is drawn at its projected (col, row) position with a soft
// shadow under the feet, a torso, a head, and a small catch-light. Body
// bobs while moving; head leans toward the projected screen direction
// of movement. Subtle perspective scaling (~0.88 → ~1.12) makes guests
// closer to the camera read a touch larger.
//
// Depth: the scene paints this renderer on its own Graphics layer above
// ObjectRendererV2, so a guest will always appear in front of a slot or
// table at the same tile. That's acceptable for Phase 6 — interleaved
// per-guest/per-object depth sort is a Phase 11 polish item.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import { SHADOW } from './PaletteV2';
import type { GuestVisualV2 } from '../guests/GuestVisualControllerV2';

const GRID_DEPTH_DENOM = GC.GRID_COLS + GC.GRID_ROWS;
const PERSP_MIN  = 0.88;
const PERSP_GAIN = 0.24;   // PERSP_MIN..(PERSP_MIN + PERSP_GAIN)

export function drawGuests(
  g: Phaser.GameObjects.Graphics,
  guests: readonly GuestVisualV2[],
  baseX: number, baseY: number, ts: number,
): void {
  if (guests.length === 0 || ts < 8) return;

  // Base sprite sizes — smaller than slots/tables so guests read as
  // people, not objects.
  const headR  = Math.max(2, ts * 0.13);
  const bodyW  = Math.max(3, Math.round(ts * 0.30));
  const bodyH  = Math.max(3, Math.round(ts * 0.36));
  const bobAmp = Math.max(0.5, ts * 0.06);
  const lean   = Math.max(0.6, ts * 0.07);

  for (const guest of guests) {
    const p  = Proj.worldToScreen(guest.col, guest.row, ts);
    const x  = p.x + baseX;
    const y  = p.y + baseY;

    // Perspective scale: closer to camera (larger col+row) → slightly
    // larger guest. Subtle so it reads as depth, not cartoon zoom.
    const depth = (guest.col + guest.row) / GRID_DEPTH_DENOM;
    const scale = PERSP_MIN + PERSP_GAIN * Math.max(0, Math.min(1, depth));

    const moving = guest.state === 'walking' || guest.state === 'leaving';
    const bob    = moving ? Math.sin(guest.phase) * bobAmp : 0;

    // Convert grid-space direction to screen-space direction for the
    // head lean. worldToScreen(dx, dy, ts) is the screen vector of a
    // (dx, dy) tile step; we normalise it for the displacement.
    const dirS  = Proj.worldToScreen(guest.dirX, guest.dirY, ts);
    const dLen  = Math.hypot(dirS.x, dirS.y);
    const dirNX = dLen > 0 ? dirS.x / dLen : 0;
    const dirNY = dLen > 0 ? dirS.y / dLen : 0;

    // 1. Soft elongated floor shadow under the feet.
    g.fillStyle(SHADOW, 0.32);
    g.fillEllipse(
      x, y + bodyH * 0.45 * scale,
      bodyW * scale * 1.10,
      Math.max(2, bodyH * 0.45) * scale,
    );

    // 2. Torso — rounded rect in the guest's body tint. Bobs by a
    //    fraction of the head bob so the body feels grounded.
    const torsoX = x - (bodyW * scale) / 2;
    const torsoY = y - bodyH * 0.18 * scale + bob * 0.35;
    g.fillStyle(guest.tint, 1);
    g.fillRoundedRect(
      torsoX, torsoY,
      bodyW * scale, bodyH * scale,
      Math.max(1, bodyW * 0.42),
    );

    // 3. Head — leans toward the projected direction of travel.
    const hx = x + dirNX * lean * scale;
    const hy = y - bodyH * 0.45 * scale + bob + dirNY * lean * 0.4 * scale;
    g.fillStyle(guest.headTint, 1);
    g.fillCircle(hx, hy, headR * scale);

    // 4. Small white catch-light on the upper-left of the head.
    g.fillStyle(0xffffff, 0.30);
    g.fillCircle(
      hx - headR * 0.3 * scale,
      hy - headR * 0.35 * scale,
      Math.max(1, headR * 0.35 * scale),
    );
  }
}
