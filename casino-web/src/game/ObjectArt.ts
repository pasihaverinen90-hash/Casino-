// ObjectArt.ts — procedural drawing for placed objects.
// Two output backends share the same per-type shape recipes:
//   • paintObject(g, …)  → Phaser Graphics, used by GridScene
//   • paintThumb(ctx, …) → Canvas2D, used by BuildPanel thumbnails
//
// Shapes are lightweight on purpose: enough to be recognisable as a slot
// cabinet / felt table / counter, without an art pipeline.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';

// ── Phaser Graphics renderer (in-grid) ───────────────────────────────────

export function paintObject(
  g: Phaser.GameObjects.Graphics,
  type: GC.ObjType,
  x: number, y: number, w: number, h: number,
  alpha: number,
): void {
  switch (type) {
    case GC.ObjType.SLOT_MACHINE: drawSlotG(g, x, y, w, h, alpha); break;
    case GC.ObjType.SMALL_TABLE:  drawTableG(g, x, y, w, h, alpha, false); break;
    case GC.ObjType.LARGE_TABLE:  drawTableG(g, x, y, w, h, alpha, true);  break;
    case GC.ObjType.WC:           drawWCG     (g, x, y, w, h, alpha); break;
    case GC.ObjType.BAR:          drawBarG    (g, x, y, w, h, alpha); break;
    case GC.ObjType.CASHIER:      drawCashierG(g, x, y, w, h, alpha); break;
  }
}

function drawSlotG(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a: number): void {
  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.08));
  const baseH = Math.max(2, Math.round(h * 0.18));

  // Carpet / shadow base
  g.fillStyle(0x1a1d22, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Cabinet body (gold)
  g.fillStyle(0xccb31a, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad - baseH);

  // Screen (dark inset)
  g.fillStyle(0x0e1115, a);
  g.fillRect(x + pad * 2, y + pad * 2, w - 4 * pad, Math.max(2, Math.round(h * 0.36)));

  // Coin slot / handle area
  g.fillStyle(0x6a5a14, a);
  g.fillRect(x + Math.round(w * 0.4), y + Math.round(h * 0.65), Math.max(2, Math.round(w * 0.2)), Math.max(1, Math.round(h * 0.05)));

  // Base
  g.fillStyle(0x3a2f12, a);
  g.fillRect(x + pad, y + h - pad - baseH, w - 2 * pad, baseH);
}

function drawTableG(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a: number, large: boolean): void {
  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.12));

  // Carpet around table
  g.fillStyle(0x1f1812, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Wood rim
  g.fillStyle(large ? 0x4d3a1a : 0x5a4022, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);

  // Felt
  g.fillStyle(large ? 0x144a22 : 0x1d6b30, a);
  const felt = Math.max(1, Math.round(pad * 0.6));
  g.fillRect(x + pad + felt, y + pad + felt, w - 2 * (pad + felt), h - 2 * (pad + felt));

  // Centerpiece — wheel for large, dealer line for small
  if (large) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r  = Math.max(2, Math.min(w, h) * 0.18);
    g.fillStyle(0x8a3a14, a);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0x1a1208, a);
    g.fillCircle(cx, cy, Math.max(1, r * 0.4));
  } else {
    const stripeH = Math.max(1, Math.round(h * 0.06));
    g.fillStyle(0x0e3a18, a);
    g.fillRect(x + pad + felt, y + h / 2 - stripeH / 2, w - 2 * (pad + felt), stripeH);
  }
}

function drawWCG(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a: number): void {
  // Tile facade
  g.fillStyle(0x4db368, a);
  g.fillRect(x, y, w - 1, h - 1);
  // Door inset (centered along the long axis)
  const horiz = w >= h;
  g.fillStyle(0x1d3a26, a);
  if (horiz) {
    const dw = Math.max(2, Math.round(w * 0.22));
    g.fillRect(x + (w - dw) / 2, y + 2, dw, h - 4);
  } else {
    const dh = Math.max(2, Math.round(h * 0.22));
    g.fillRect(x + 2, y + (h - dh) / 2, w - 4, dh);
  }
}

function drawBarG(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a: number): void {
  const horiz = w >= h;
  // Dark counter back
  g.fillStyle(0x4a1a14, a);
  g.fillRect(x, y, w - 1, h - 1);
  // Brass / wood front edge band
  g.fillStyle(0xcc8a44, a);
  if (horiz) g.fillRect(x, y + Math.round(h * 0.6), w - 1, Math.max(2, Math.round(h * 0.18)));
  else        g.fillRect(x + Math.round(w * 0.6), y, Math.max(2, Math.round(w * 0.18)), h - 1);
  // Bottle silhouettes along the back
  g.fillStyle(0xe8d066, a * 0.9);
  if (horiz) {
    const n = Math.max(2, Math.floor(w / Math.max(8, h)));
    for (let i = 0; i < n; i++) {
      const bx = x + (i + 0.5) * (w / n);
      g.fillRect(bx - 1, y + 2, 2, Math.max(2, Math.round(h * 0.4)));
    }
  } else {
    const n = Math.max(2, Math.floor(h / Math.max(8, w)));
    for (let i = 0; i < n; i++) {
      const by = y + (i + 0.5) * (h / n);
      g.fillRect(x + 2, by - 1, Math.max(2, Math.round(w * 0.4)), 2);
    }
  }
}

function drawCashierG(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a: number): void {
  // Booth body
  g.fillStyle(0x2d4d6e, a);
  g.fillRect(x, y, w - 1, h - 1);
  // Window
  g.fillStyle(0xc8e0ff, a * 0.85);
  const m = Math.max(1, Math.round(Math.min(w, h) * 0.18));
  g.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
  // Slot/grille
  g.fillStyle(0x1a2a3a, a);
  g.fillRect(x + m + 1, y + h / 2 - 1, w - 2 * m - 2, 2);
}

// ── Canvas2D thumbnail renderer (build panel) ────────────────────────────

export function paintThumb(
  ctx: CanvasRenderingContext2D,
  type: GC.ObjType,
  W: number, H: number,
): void {
  // Match each shape recipe but on a single tile-shaped icon. We render
  // the object on a tile-sized inner area so wall services look like wall
  // services and tables look like tables at a glance.
  ctx.clearRect(0, 0, W, H);
  const inset = Math.max(2, Math.round(Math.min(W, H) * 0.08));
  const x = inset, y = inset, w = W - 2 * inset, h = H - 2 * inset;

  switch (type) {
    case GC.ObjType.SLOT_MACHINE: drawSlotC(ctx, x, y, w, h); break;
    case GC.ObjType.SMALL_TABLE:  drawTableC(ctx, x, y, w, h, false); break;
    case GC.ObjType.LARGE_TABLE:  drawTableC(ctx, x, y, w, h, true); break;
    case GC.ObjType.WC:           drawWCC     (ctx, x, y, w, h); break;
    case GC.ObjType.BAR:          drawBarC    (ctx, x, y, w, h); break;
    case GC.ObjType.CASHIER:      drawCashierC(ctx, x, y, w, h); break;
  }
}

function fillRect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawSlotC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const baseH = Math.max(3, Math.round(h * 0.18));
  fillRect(ctx, '#ccb31a', x, y, w, h - baseH);
  fillRect(ctx, '#0e1115', x + 4, y + 4, w - 8, Math.round(h * 0.4));
  fillRect(ctx, '#6a5a14', x + Math.round(w * 0.35), y + Math.round(h * 0.6), Math.round(w * 0.3), Math.max(2, Math.round(h * 0.06)));
  fillRect(ctx, '#3a2f12', x, y + h - baseH, w, baseH);
}

function drawTableC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, large: boolean): void {
  fillRect(ctx, large ? '#4d3a1a' : '#5a4022', x, y, w, h);
  const f = Math.max(2, Math.round(Math.min(w, h) * 0.14));
  fillRect(ctx, large ? '#144a22' : '#1d6b30', x + f, y + f, w - 2 * f, h - 2 * f);
  if (large) {
    const cx = x + w / 2, cy = y + h / 2;
    const r = Math.max(3, Math.min(w, h) * 0.18);
    ctx.fillStyle = '#8a3a14'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1208'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill();
  } else {
    fillRect(ctx, '#0e3a18', x + f, y + h / 2 - 2, w - 2 * f, 4);
  }
}

function drawWCC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#4db368', x, y, w, h);
  const dw = Math.max(4, Math.round(w * 0.3));
  fillRect(ctx, '#1d3a26', x + (w - dw) / 2, y + 4, dw, h - 8);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(h * 0.34)}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('WC', x + w / 2, y + h / 2);
}

function drawBarC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#4a1a14', x, y, w, h);
  fillRect(ctx, '#cc8a44', x, y + Math.round(h * 0.62), w, Math.max(3, Math.round(h * 0.18)));
  ctx.fillStyle = '#e8d066';
  const n = 4;
  for (let i = 0; i < n; i++) {
    const bx = x + (i + 0.5) * (w / n);
    ctx.fillRect(bx - 1.5, y + 4, 3, Math.round(h * 0.42));
  }
}

function drawCashierC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#2d4d6e', x, y, w, h);
  const m = Math.max(3, Math.round(Math.min(w, h) * 0.18));
  fillRect(ctx, '#c8e0ff', x + m, y + m, w - 2 * m, h - 2 * m);
  ctx.fillStyle = '#1a2a3a';
  ctx.font = `bold ${Math.round(h * 0.5)}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', x + w / 2, y + h / 2 + 1);
}
