// tableShared.ts — table-only helpers used by smallTable + largeTable.
//
// Kept separate from drawHelpers (which is generic geometry) so the
// helpers file stays small and obvious.
import Phaser from 'phaser';
import * as GC from '../../../logic/GameConstants';
import * as Proj from '../ProjectionV2';
import {
  FELT_GREEN, FELT_HIGH_STAKES,
  WOOD_DARK, BRASS, BRASS_HIGHLIGHT, SHADOW,
} from '../PaletteV2';
import { fillQuad, lerpVec } from './drawHelpers';

// Felt colour per variant. craps is the only V1 variant that swaps to red
// felt; everything else stays on the standard green. Add per-variant
// overrides here as table content grows.
export function feltColorForVariant(variant: string): number {
  if (variant === 'craps') return FELT_HIGH_STAKES;
  return FELT_GREEN;
}

// Dark felt band on the dealer side of the table top. The dealer side is
// the cardinal direction the table FACES (per GC convention); the band
// occupies the thin strip closest to that edge at the lifted felt height.
//
// Painted on top of the felt parallelogram, so callers should invoke this
// after fillQuad(feltTop).
export function drawDealerBand(
  g: Phaser.GameObjects.Graphics,
  obj: GC.PlacedObj,
  baseX: number, baseY: number, ts: number,
  alpha: number,
  rimHeightTiles: number,
): void {
  const { col, row, w, h, facing } = obj;
  // Band thickness in world tiles. ~22% of the perpendicular dimension
  // reads as a clear dealer area without eating the table.
  const t = 0.22;

  let a: { c: number; r: number };
  let b: { c: number; r: number };
  let c: { c: number; r: number };
  let d: { c: number; r: number };
  switch (facing) {
    case 'N':  // dealer on the north (back) edge
      a = { c: col,     r: row             };
      b = { c: col + w, r: row             };
      c = { c: col + w, r: row + t         };
      d = { c: col,     r: row + t         };
      break;
    case 'S':
      a = { c: col,     r: row + h - t     };
      b = { c: col + w, r: row + h - t     };
      c = { c: col + w, r: row + h         };
      d = { c: col,     r: row + h         };
      break;
    case 'E':
      a = { c: col + w - t, r: row         };
      b = { c: col + w,     r: row         };
      c = { c: col + w,     r: row + h     };
      d = { c: col + w - t, r: row + h     };
      break;
    case 'W':
      a = { c: col,         r: row         };
      b = { c: col + t,     r: row         };
      c = { c: col + t,     r: row + h     };
      d = { c: col,         r: row + h     };
      break;
  }

  const quad: Proj.Vec2[] = [a, b, c, d].map(p => {
    const s = Proj.liftPoint(
      Proj.worldToScreen(p.c, p.r, ts), rimHeightTiles, ts,
    );
    return { x: s.x + baseX, y: s.y + baseY };
  });

  fillQuad(g, quad, WOOD_DARK, alpha * 0.72);
}

// Variant centrepiece painted at the felt top's centre. Default is a
// small brass disk with a brighter rim; specific variants tweak the
// interior to hint at the game (roulette wheel, craps dice marks,
// poker concentric ring, blackjack arc). Visual polish — Phase 4 is
// intentionally simple; richer marks land later.
//
// TODO (phase 11 polish): replace with real per-variant motifs (wheel
// sectors, felt logos, dice pips, suit arcs). For now the silhouette
// difference is enough to tell variants apart at a glance.
export function drawTableCenterpiece(
  g: Phaser.GameObjects.Graphics,
  obj: GC.PlacedObj,
  baseX: number, baseY: number, ts: number,
  alpha: number,
  rimHeightTiles: number,
  isLarge: boolean,
): void {
  const center = Proj.liftPoint(
    Proj.footprintCenter(obj.col, obj.row, obj.w, obj.h, ts),
    rimHeightTiles, ts,
  );
  const cx = center.x + baseX;
  const cy = center.y + baseY;
  const r  = isLarge ? Math.max(3, ts * 0.30) : Math.max(2, ts * 0.22);

  // Base brass disk shared by every variant.
  g.fillStyle(BRASS, alpha * 0.85);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1, BRASS_HIGHLIGHT, alpha);
  g.strokeCircle(cx, cy, r);

  const variant = obj.variant ?? '';
  if (variant === 'roulette') {
    // Inner dark disk + bright spindle pip → "wheel".
    g.fillStyle(SHADOW, alpha * 0.7);
    g.fillCircle(cx, cy, r * 0.62);
    g.fillStyle(BRASS_HIGHLIGHT, alpha);
    g.fillCircle(cx, cy, Math.max(1, r * 0.18));
  } else if (variant === 'craps') {
    // Two small white "dice" squares.
    g.fillStyle(0xffffff, alpha * 0.85);
    const ds = Math.max(2, r * 0.36);
    g.fillRect(cx - ds - 1, cy - ds / 2, ds, ds);
    g.fillRect(cx + 1,      cy - ds / 2, ds, ds);
  } else if (variant === 'poker') {
    // Concentric brass ring → "chip stack" feel.
    g.lineStyle(1, BRASS_HIGHLIGHT, alpha);
    g.strokeCircle(cx, cy, r * 0.65);
  } else if (variant === 'blackjack') {
    // Brass arc across the centre → "shoe" direction hint.
    g.lineStyle(2, BRASS_HIGHLIGHT, alpha * 0.9);
    g.beginPath();
    g.arc(cx, cy, r * 0.7, Math.PI * 0.15, Math.PI * 0.85);
    g.strokePath();
  }
  // Other variants (baccarat, high-roller, etc.) keep the default disk.
}

// Brass border stroke around the felt parallelogram. Reads as the table
// rim trim. 2 px line, alpha-aware. Small helper just so both recipes
// agree on the line width / colour.
export function drawFeltRim(
  g: Phaser.GameObjects.Graphics,
  feltQuad: Proj.Vec2[],
  alpha: number,
): void {
  g.lineStyle(2, BRASS, alpha * 0.85);
  g.strokePoints(feltQuad, true);
}

// Re-export for tests / future use without a separate import dance.
export { lerpVec };
