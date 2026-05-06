// ObjectArt.ts — procedural drawing for placed objects.
// Two output backends share the same per-type shape recipes:
//   • paintObject(g, …)  → Phaser Graphics, used by GridScene
//   • paintThumb(ctx, …) → Canvas2D, used by BuildPanel thumbnails
//
// Shapes are lightweight on purpose: enough to be recognisable as a slot
// cabinet / felt table / counter, without an art pipeline.
//
// P2.1: floor attractions render with explicit orientation. Slot art is
// split into a cabinet half and a chair half along the facing axis;
// tables draw a dealer band on the facing side so player seats read on
// the other three sides.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';

// Which side of a wall-service's footprint borders the wall. Used to
// render the back of the service as a wall continuation so it reads as
// embedded into the wall instead of free-standing in front of it.
export type WallSide = 'N' | 'S' | 'W' | 'E';

// Splits a footprint rect into (wall band, service body) given which side
// faces the wall. The band is ~35 % of the depth perpendicular to the wall.
function splitForWall(
  x: number, y: number, w: number, h: number, side: WallSide,
): { band: { x: number; y: number; w: number; h: number };
     body: { x: number; y: number; w: number; h: number };
     // Direction the body faces (the casino floor) — used to place doors,
     // windows, brass bands, etc., on the correct edge.
     facing: WallSide } {
  const bandRatio = 0.35;
  if (side === 'N') {
    const bh = Math.max(2, Math.round(h * bandRatio));
    return {
      band: { x, y, w, h: bh },
      body: { x, y: y + bh, w, h: h - bh },
      facing: 'S',
    };
  }
  if (side === 'S') {
    const bh = Math.max(2, Math.round(h * bandRatio));
    return {
      band: { x, y: y + h - bh, w, h: bh },
      body: { x, y, w, h: h - bh },
      facing: 'N',
    };
  }
  if (side === 'W') {
    const bw = Math.max(2, Math.round(w * bandRatio));
    return {
      band: { x, y, w: bw, h },
      body: { x: x + bw, y, w: w - bw, h },
      facing: 'E',
    };
  }
  // E
  const bw = Math.max(2, Math.round(w * bandRatio));
  return {
    band: { x: x + w - bw, y, w: bw, h },
    body: { x, y, w: w - bw, h },
    facing: 'W',
  };
}

// ── Phaser Graphics renderer (in-grid) ───────────────────────────────────

export function paintObject(
  g: Phaser.GameObjects.Graphics,
  type: GC.ObjType,
  x: number, y: number, w: number, h: number,
  alpha: number,
  wallSide: WallSide | null = null,
  facing: GC.Orientation = 'S',
): void {
  switch (type) {
    case GC.ObjType.SLOT_MACHINE: drawSlotG (g, x, y, w, h, alpha, facing); break;
    case GC.ObjType.SMALL_TABLE:  drawTableG(g, x, y, w, h, alpha, false, facing); break;
    case GC.ObjType.LARGE_TABLE:  drawTableG(g, x, y, w, h, alpha, true,  facing);  break;
    case GC.ObjType.WC:           drawWCG     (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.BAR:          drawBarG    (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.CASHIER:      drawCashierG(g, x, y, w, h, alpha, wallSide); break;
  }
}

// Slot machine (1×2 footprint): cabinet on the side opposite `facing`,
// chair on the `facing` side. The chair tile is rendered as a small seat
// glyph so guests look like they're sitting on it rather than overlapping
// the cabinet.
function drawSlotG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  facing: GC.Orientation,
): void {
  // Determine which half of the rectangle is the chair tile.
  // Vertical (h > w): facing N → chair top, S → chair bottom.
  // Horizontal (w > h): facing W → chair left, E → chair right.
  let chair: { x: number; y: number; w: number; h: number };
  let cab:   { x: number; y: number; w: number; h: number };
  if (h >= w) {
    const half = h / 2;
    if (facing === 'N') {
      chair = { x, y,        w, h: half };
      cab   = { x, y: y + half, w, h: h - half };
    } else { // 'S' (or fallback for E/W on a vertical footprint)
      cab   = { x, y,        w, h: half };
      chair = { x, y: y + half, w, h: h - half };
    }
  } else {
    const half = w / 2;
    if (facing === 'W') {
      chair = { x,        y, w: half,     h };
      cab   = { x: x + half, y, w: w - half, h };
    } else { // 'E'
      cab   = { x,        y, w: half,     h };
      chair = { x: x + half, y, w: w - half, h };
    }
  }

  // Carpet base across the whole footprint.
  g.fillStyle(0x1a1d22, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  drawSlotCabinet(g, cab.x, cab.y, cab.w, cab.h, a);
  drawSlotChair  (g, chair.x, chair.y, chair.w, chair.h, a, facing);
}

function drawSlotCabinet(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
): void {
  const pad   = Math.max(1, Math.round(Math.min(w, h) * 0.10));
  const baseH = Math.max(2, Math.round(h * 0.18));

  // Cabinet body (gold).
  g.fillStyle(0xccb31a, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad - baseH);

  // Screen (dark inset).
  g.fillStyle(0x0e1115, a);
  g.fillRect(
    x + pad * 2, y + pad * 2,
    Math.max(1, w - 4 * pad),
    Math.max(2, Math.round(h * 0.36)),
  );

  // Coin slot / handle area.
  g.fillStyle(0x6a5a14, a);
  g.fillRect(
    x + Math.round(w * 0.35), y + Math.round(h * 0.62),
    Math.max(2, Math.round(w * 0.30)),
    Math.max(1, Math.round(h * 0.06)),
  );

  // Base.
  g.fillStyle(0x3a2f12, a);
  g.fillRect(x + pad, y + h - pad - baseH, w - 2 * pad, baseH);
}

// Small chair glyph. The seat hugs the side opposite the cabinet so it
// reads as "the player sits here, facing the machine".
function drawSlotChair(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  facing: GC.Orientation,
): void {
  const seatPad = Math.max(1, Math.round(Math.min(w, h) * 0.18));
  // Seat cushion — dark wood.
  g.fillStyle(0x553a22, a * 0.95);
  g.fillRect(
    x + seatPad, y + seatPad,
    Math.max(1, w - 2 * seatPad),
    Math.max(1, h - 2 * seatPad),
  );
  // Backrest along the cabinet-facing edge of the chair tile.
  g.fillStyle(0x3a2412, a);
  const backT = Math.max(1, Math.round(Math.min(w, h) * 0.18));
  if (facing === 'N') {
    // chair is on top tile; backrest is at the top edge.
    g.fillRect(x + seatPad, y + seatPad, w - 2 * seatPad, backT);
  } else if (facing === 'S') {
    g.fillRect(x + seatPad, y + h - seatPad - backT, w - 2 * seatPad, backT);
  } else if (facing === 'W') {
    g.fillRect(x + seatPad, y + seatPad, backT, h - 2 * seatPad);
  } else {
    g.fillRect(x + w - seatPad - backT, y + seatPad, backT, h - 2 * seatPad);
  }
}

function drawTableG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  large: boolean, facing: GC.Orientation,
): void {
  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.12));

  // Carpet around table.
  g.fillStyle(0x1f1812, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Wood rim.
  g.fillStyle(large ? 0x4d3a1a : 0x5a4022, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);

  // Felt.
  g.fillStyle(large ? 0x144a22 : 0x1d6b30, a);
  const felt = Math.max(1, Math.round(pad * 0.6));
  g.fillRect(
    x + pad + felt, y + pad + felt,
    w - 2 * (pad + felt), h - 2 * (pad + felt),
  );

  // Dealer band on the facing side — the cue that tells the player which
  // 3 sides have seats. Dark wood/brass against the green felt.
  const bandT = Math.max(2, Math.round(Math.min(w, h) * 0.16));
  const innerX = x + pad + felt;
  const innerY = y + pad + felt;
  const innerW = w - 2 * (pad + felt);
  const innerH = h - 2 * (pad + felt);
  g.fillStyle(0x8a3a14, a);
  if (facing === 'N')      g.fillRect(innerX, innerY,                 innerW, bandT);
  else if (facing === 'S') g.fillRect(innerX, innerY + innerH - bandT, innerW, bandT);
  else if (facing === 'W') g.fillRect(innerX, innerY,                 bandT,  innerH);
  else                     g.fillRect(innerX + innerW - bandT, innerY, bandT, innerH);

  // Centerpiece — wheel for large, dealer line for small.
  if (large) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r  = Math.max(2, Math.min(w, h) * 0.18);
    g.fillStyle(0x8a3a14, a);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0x1a1208, a);
    g.fillCircle(cx, cy, Math.max(1, r * 0.4));
  } else {
    const stripeH = Math.max(1, Math.round(Math.min(w, h) * 0.06));
    g.fillStyle(0x0e3a18, a);
    g.fillRect(
      x + pad + felt, y + h / 2 - stripeH / 2,
      w - 2 * (pad + felt), stripeH,
    );
  }
}

// Wall-service drawers paint a "wall continuation" band on the wall side
// (so the service reads as built into the wall) and then a service body
// in the floor-facing portion. wallSide may be null on the build-panel
// ghost or on a momentarily-unmoored placement; we fall back to a default
// orientation in that case.

function drawWallBand(
  g: Phaser.GameObjects.Graphics,
  band: { x: number; y: number; w: number; h: number },
  a: number,
): void {
  // Wall tone matches COL_WALL so the band visually merges with the wall
  // tile behind it. A thin highlight on the floor-facing edge gives a
  // header / lintel feel.
  g.fillStyle(GC.COL_WALL, a);
  g.fillRect(band.x, band.y, band.w, band.h);
  g.fillStyle(0x35373a, a);
  g.fillRect(band.x, band.y, band.w, 1);
}

function drawWCG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
  const eff: WallSide = side ?? (w >= h ? 'N' : 'W');
  const { band, body, facing } = splitForWall(x, y, w, h, eff);

  // Wall band first — ensures the back blends with the wall.
  drawWallBand(g, band, a);

  // Service body — green tile facade.
  g.fillStyle(0x4db368, a);
  g.fillRect(body.x, body.y, body.w, body.h);

  // Tile grout — a single divider line for a built-in look.
  g.fillStyle(0x2a5a3a, a * 0.7);
  if (facing === 'N' || facing === 'S') {
    g.fillRect(body.x, body.y + body.h / 2, body.w, 1);
  } else {
    g.fillRect(body.x + body.w / 2, body.y, 1, body.h);
  }

  // Door cutout on the floor-facing edge of the body.
  g.fillStyle(0x1d3a26, a);
  if (facing === 'N') {
    const dw = Math.max(2, Math.round(body.w * 0.22));
    const dh = Math.max(2, Math.round(body.h * 0.55));
    g.fillRect(body.x + (body.w - dw) / 2, body.y, dw, dh);
  } else if (facing === 'S') {
    const dw = Math.max(2, Math.round(body.w * 0.22));
    const dh = Math.max(2, Math.round(body.h * 0.55));
    g.fillRect(body.x + (body.w - dw) / 2, body.y + body.h - dh, dw, dh);
  } else if (facing === 'W') {
    const dh = Math.max(2, Math.round(body.h * 0.22));
    const dw = Math.max(2, Math.round(body.w * 0.55));
    g.fillRect(body.x, body.y + (body.h - dh) / 2, dw, dh);
  } else {
    const dh = Math.max(2, Math.round(body.h * 0.22));
    const dw = Math.max(2, Math.round(body.w * 0.55));
    g.fillRect(body.x + body.w - dw, body.y + (body.h - dh) / 2, dw, dh);
  }
}

function drawBarG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
  const eff: WallSide = side ?? (w >= h ? 'N' : 'W');
  const { band, body, facing } = splitForWall(x, y, w, h, eff);

  // Wall band — back-bar shelving with bottle silhouettes embedded in the wall.
  drawWallBand(g, band, a);
  g.fillStyle(0xe8d066, a * 0.9);
  const horiz = band.w >= band.h;
  if (horiz) {
    const n = Math.max(3, Math.floor(band.w / 12));
    const inset = Math.max(1, Math.round(band.h * 0.25));
    for (let i = 0; i < n; i++) {
      const bx = band.x + (i + 0.5) * (band.w / n);
      g.fillRect(bx - 1, band.y + inset, 2, Math.max(2, band.h - 2 * inset));
    }
  } else {
    const n = Math.max(3, Math.floor(band.h / 12));
    const inset = Math.max(1, Math.round(band.w * 0.25));
    for (let i = 0; i < n; i++) {
      const by = band.y + (i + 0.5) * (band.h / n);
      g.fillRect(band.x + inset, by - 1, Math.max(2, band.w - 2 * inset), 2);
    }
  }

  // Counter body — dark wood.
  g.fillStyle(0x4a1a14, a);
  g.fillRect(body.x, body.y, body.w, body.h);

  // Brass front edge band on the floor-facing side.
  g.fillStyle(0xcc8a44, a);
  if (facing === 'N') {
    const t = Math.max(2, Math.round(body.h * 0.4));
    g.fillRect(body.x, body.y, body.w, t);
  } else if (facing === 'S') {
    const t = Math.max(2, Math.round(body.h * 0.4));
    g.fillRect(body.x, body.y + body.h - t, body.w, t);
  } else if (facing === 'W') {
    const t = Math.max(2, Math.round(body.w * 0.4));
    g.fillRect(body.x, body.y, t, body.h);
  } else {
    const t = Math.max(2, Math.round(body.w * 0.4));
    g.fillRect(body.x + body.w - t, body.y, t, body.h);
  }
}

function drawCashierG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
  // Cashier is 1×1; we widen the band slightly so the embedded look reads.
  const eff: WallSide = side ?? 'N';
  const bandRatio = 0.45;
  let band: { x: number; y: number; w: number; h: number };
  let body: { x: number; y: number; w: number; h: number };
  let facing: WallSide;
  if (eff === 'N') {
    const bh = Math.max(2, Math.round(h * bandRatio));
    band = { x, y, w, h: bh }; body = { x, y: y + bh, w, h: h - bh }; facing = 'S';
  } else if (eff === 'S') {
    const bh = Math.max(2, Math.round(h * bandRatio));
    band = { x, y: y + h - bh, w, h: bh }; body = { x, y, w, h: h - bh }; facing = 'N';
  } else if (eff === 'W') {
    const bw = Math.max(2, Math.round(w * bandRatio));
    band = { x, y, w: bw, h }; body = { x: x + bw, y, w: w - bw, h }; facing = 'E';
  } else {
    const bw = Math.max(2, Math.round(w * bandRatio));
    band = { x: x + w - bw, y, w: bw, h }; body = { x, y, w: w - bw, h }; facing = 'W';
  }

  drawWallBand(g, band, a);

  // Booth body — dark teal.
  g.fillStyle(0x2d4d6e, a);
  g.fillRect(body.x, body.y, body.w, body.h);

  // Window — light glass set into the booth, biased toward the floor edge.
  const m = Math.max(1, Math.round(Math.min(body.w, body.h) * 0.2));
  g.fillStyle(0xc8e0ff, a * 0.85);
  g.fillRect(body.x + m, body.y + m, Math.max(1, body.w - 2 * m), Math.max(1, body.h - 2 * m));

  // Service slot facing the floor.
  g.fillStyle(0x1a2a3a, a);
  if (facing === 'N' || facing === 'S') {
    const sy = facing === 'N' ? body.y + 1 : body.y + body.h - 2;
    g.fillRect(body.x + m, sy, Math.max(1, body.w - 2 * m), 1);
  } else {
    const sx = facing === 'W' ? body.x + 1 : body.x + body.w - 2;
    g.fillRect(sx, body.y + m, 1, Math.max(1, body.h - 2 * m));
  }
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

// Slot thumbnail: split vertically into cabinet (top) and chair (bottom)
// so the new 1×2 footprint is recognisable from the build panel itself.
function drawSlotC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cabH   = Math.round(h * 0.62);
  const chairY = y + cabH;
  const chairH = h - cabH;
  // Cabinet
  const baseH = Math.max(3, Math.round(cabH * 0.18));
  fillRect(ctx, '#ccb31a', x, y, w, cabH - baseH);
  fillRect(ctx, '#0e1115', x + 4, y + 4, Math.max(1, w - 8), Math.max(2, Math.round(cabH * 0.42)));
  fillRect(ctx, '#6a5a14', x + Math.round(w * 0.35), y + Math.round(cabH * 0.65), Math.round(w * 0.3), Math.max(2, Math.round(cabH * 0.06)));
  fillRect(ctx, '#3a2f12', x, y + cabH - baseH, w, baseH);
  // Chair
  const chairPad = Math.max(2, Math.round(Math.min(w, chairH) * 0.18));
  fillRect(ctx, '#553a22', x + chairPad, chairY + chairPad, w - 2 * chairPad, chairH - 2 * chairPad);
  fillRect(ctx, '#3a2412', x + chairPad, chairY + chairPad, w - 2 * chairPad, Math.max(2, Math.round(chairH * 0.25)));
}

function drawTableC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, large: boolean): void {
  fillRect(ctx, large ? '#4d3a1a' : '#5a4022', x, y, w, h);
  const f = Math.max(2, Math.round(Math.min(w, h) * 0.14));
  fillRect(ctx, large ? '#144a22' : '#1d6b30', x + f, y + f, w - 2 * f, h - 2 * f);
  // Dealer band along the top — communicates "this side is the dealer side".
  fillRect(ctx, '#8a3a14', x + f, y + f, w - 2 * f, Math.max(2, Math.round(h * 0.16)));
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
