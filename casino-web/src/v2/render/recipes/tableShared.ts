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

// Felt colour per variant. craps is the only variant that swaps to red
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
    const s = Proj.liftObjectPoint(
      Proj.worldToScreen(p.c, p.r, ts), rimHeightTiles, ts,
    );
    return { x: s.x + baseX, y: s.y + baseY };
  });

  fillQuad(g, quad, WOOD_DARK, alpha * 0.72);
}

// Variant centrepiece painted at the felt top's centre. Default is a
// small brass disk with a brighter rim; specific variants tweak the
// interior to hint at the game (roulette wheel, craps dice marks,
// poker concentric ring, blackjack arc). Visual polish is
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
  const center = Proj.liftObjectPoint(
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
    // Wheel: dark disk + four cardinal spoke marks + bright spindle.
    g.fillStyle(SHADOW, alpha * 0.75);
    g.fillCircle(cx, cy, r * 0.66);
    if (ts >= 18) {
      g.lineStyle(1, BRASS_HIGHLIGHT, alpha * 0.9);
      const sk = r * 0.55;
      g.beginPath();
      g.moveTo(cx - sk, cy); g.lineTo(cx + sk, cy);
      g.moveTo(cx, cy - sk); g.lineTo(cx, cy + sk);
      g.strokePath();
    }
    g.fillStyle(BRASS_HIGHLIGHT, alpha);
    g.fillCircle(cx, cy, Math.max(1, r * 0.20));
  } else if (variant === 'craps') {
    // Dark pit stripe behind two small white dice.
    g.fillStyle(SHADOW, alpha * 0.75);
    g.fillRect(cx - r * 0.95, cy - r * 0.40, r * 1.90, r * 0.80);
    const ds = Math.max(3, r * 0.42);
    g.fillStyle(0xffffff, alpha * 0.90);
    g.fillRect(cx - ds - 2, cy - ds / 2, ds, ds);
    g.fillRect(cx + 2,      cy - ds / 2, ds, ds);
    // Two pip dots so they read as dice rather than blank cubes.
    if (ts >= 18) {
      g.fillStyle(SHADOW, alpha);
      const pr = Math.max(1, ds * 0.15);
      g.fillCircle(cx - ds - 2 + ds * 0.5, cy, pr);
      g.fillCircle(cx + 2     + ds * 0.5, cy, pr);
    }
  } else if (variant === 'poker') {
    // Chip-stack motif: concentric brass ring + a small offset stack.
    g.lineStyle(1, BRASS_HIGHLIGHT, alpha);
    g.strokeCircle(cx, cy, r * 0.66);
    if (ts >= 18) {
      const stackR = Math.max(2, r * 0.30);
      const sx = cx + r * 0.42;
      // Three thin stripes suggesting a stack of chips.
      g.fillStyle(0xffffff, alpha * 0.85);
      g.fillRect(sx - stackR, cy - stackR * 0.10, stackR * 2, Math.max(1, stackR * 0.18));
      g.fillRect(sx - stackR, cy - stackR * 0.35, stackR * 2, Math.max(1, stackR * 0.18));
      g.fillStyle(SHADOW, alpha * 0.85);
      g.fillRect(sx - stackR, cy + stackR * 0.16, stackR * 2, Math.max(1, stackR * 0.18));
    }
  } else if (variant === 'blackjack') {
    // Brass arc ("shoe" cue) + small card rectangle inside.
    g.lineStyle(2, BRASS_HIGHLIGHT, alpha * 0.9);
    g.beginPath();
    g.arc(cx, cy, r * 0.74, Math.PI * 0.15, Math.PI * 0.85);
    g.strokePath();
    if (ts >= 18) {
      const cardW = Math.max(3, r * 0.55);
      const cardH = Math.max(4, r * 0.40);
      g.fillStyle(0xffffff, alpha * 0.85);
      g.fillRect(cx - cardW / 2, cy + r * 0.08, cardW, cardH);
      g.fillStyle(SHADOW, alpha);
      g.fillRect(cx - cardW / 2, cy + r * 0.08, cardW, 1);
    }
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
