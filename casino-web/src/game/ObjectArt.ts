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

// Phase V1 — subtle drop shadow painted just inside an object's footprint
// rect, called from paintObject before any body draw. Only fires at full
// alpha so the placement ghost (alpha 0.6) and non-functional objects
// (alpha 0.45) stay clean — both depend on a dim/coloured overlay reading
// clearly, and a shadow underneath would muddy them. The shadow stays
// within the footprint plus ≤2 px, so it can never bleed onto adjacent
// build tiles or make a neighbour read as occupied.
function paintObjectShadow(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, alpha: number,
): void {
  if (alpha < 1) return;
  const off = Math.min(2, Math.max(1, Math.floor(Math.min(w, h) * 0.06)));
  const sw  = Math.max(1, w - 1);
  const sh  = Math.max(1, h - 1);
  const r   = Math.max(1, Math.min(sw, sh) * 0.10);
  // V1.1 — bumped from 0.22 to 0.30 so objects keep visible lift against
  // the new dark-burgundy carpet. Still inside the footprint plus ≤2 px,
  // so the shadow never bleeds onto an adjacent build tile.
  g.fillStyle(GC.COL_SHADOW, 0.30);
  g.fillRoundedRect(x + off, y + off, sw, sh, r);
}

export function paintObject(
  g: Phaser.GameObjects.Graphics,
  type: GC.ObjType,
  x: number, y: number, w: number, h: number,
  alpha: number,
  wallSide: WallSide | null = null,
  facing: GC.Orientation = 'S',
  variant: string = '',
): void {
  paintObjectShadow(g, x, y, w, h, alpha);
  switch (type) {
    case GC.ObjType.SLOT_MACHINE: drawSlotG (g, x, y, w, h, alpha, facing); break;
    case GC.ObjType.SMALL_TABLE:  drawTableG(g, x, y, w, h, alpha, false, facing, variant); break;
    case GC.ObjType.LARGE_TABLE:  drawTableG(g, x, y, w, h, alpha, true,  facing, variant);  break;
    case GC.ObjType.WC:           drawWCG        (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.BAR:          drawBarG       (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.CASHIER:      drawCashierG   (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.ATM:          drawAtmG       (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.BUFFET:       drawBuffetG    (g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.SPORTSBOOK:   drawSportsbookG(g, x, y, w, h, alpha, wallSide); break;
    case GC.ObjType.KENO_LOUNGE:       drawKenoLoungeG(g, x, y, w, h, alpha); break;
    case GC.ObjType.HIGH_STAKES_TABLE: drawHighStakesG(g, x, y, w, h, alpha, facing, variant); break;
  }
}

// Small stool glyph for table seat tiles. The cushion is a wood-toned disc;
// a darker dot on the side opposite the table reads as the backrest, so
// the seat visibly faces the table. Matches the slot chair palette so
// table seats and slot chairs feel like they belong to the same casino.
//
// `dirX, dirY` is a unit vector from the seat tile's centre toward the
// table's centre. Pass (0, 0) for an undirected stool.
export function paintSeat(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, ts: number, alpha: number,
  dirX: number, dirY: number,
): void {
  const cx = x + ts / 2;
  const cy = y + ts / 2;
  const r  = Math.max(1.5, ts * 0.22);

  // Cushion.
  g.fillStyle(0x5a3d22, alpha);
  g.fillCircle(cx, cy, r);
  // Soft top-left highlight.
  g.fillStyle(0xffffff, alpha * 0.18);
  g.fillCircle(cx - r * 0.3, cy - r * 0.3, Math.max(1, r * 0.4));
  // Backrest dot on the side opposite the table.
  const bx = cx - dirX * r * 0.6;
  const by = cy - dirY * r * 0.6;
  g.fillStyle(0x3a2412, alpha * 0.85);
  g.fillCircle(bx, by, Math.max(1, r * 0.5));
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

  // Phase V1 dimensional cue — 1px brighter highlight at the top of the
  // cabinet body sells "this stands upright". Pure overlay, no geometry
  // change.
  g.fillStyle(0xfff5d6, a * 0.35);
  g.fillRect(x + pad, y + pad, w - 2 * pad, 1);

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

  // Phase V1 — slim shadow line just above the base. Defines the lip
  // between cabinet body and base plate so the cabinet feels less flat.
  g.fillStyle(GC.COL_SHADOW, a * 0.45);
  g.fillRect(x + pad, y + h - pad - baseH - 1, w - 2 * pad, 1);

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
  large: boolean, facing: GC.Orientation, variant: string,
): void {
  // Variant palette — felt and rim swap together so the four table types
  // read at a glance even at small zooms. The first entry of each pair is
  // the default for a missing/unknown variant.
  //                              felt        rim
  const blackjackPalette = { felt: 0x1d6b30, rim: 0x5a4022 };
  const pokerPalette     = { felt: 0x144a20, rim: 0x4a2f1a };
  const roulettePalette  = { felt: 0x144a22, rim: 0x4d3a1a };
  const crapsPalette     = { felt: 0x6b1a1a, rim: 0x6e2818 };
  const palette = large
    ? (variant === 'craps' ? crapsPalette : roulettePalette)
    : (variant === 'poker' ? pokerPalette : blackjackPalette);

  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.12));

  // Carpet around table.
  g.fillStyle(0x1f1812, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Wood rim.
  g.fillStyle(palette.rim, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);

  // Phase V1 dimensional cues — 1px rim highlight on the top edge and a
  // 1px shadow line at the bottom edge give the rim subtle thickness so
  // the table feels less like a flat rectangle. Felt drawn over them
  // preserves the dealer band / centerpiece readability.
  g.fillStyle(0xfff5d6, a * 0.28);
  g.fillRect(x + pad, y + pad, w - 2 * pad, 1);
  g.fillStyle(GC.COL_SHADOW, a * 0.40);
  g.fillRect(x + pad, y + h - pad - 1, w - 2 * pad, 1);

  // Felt.
  g.fillStyle(palette.felt, a);
  const felt = Math.max(1, Math.round(pad * 0.6));
  const innerX = x + pad + felt;
  const innerY = y + pad + felt;
  const innerW = w - 2 * (pad + felt);
  const innerH = h - 2 * (pad + felt);
  g.fillRect(innerX, innerY, innerW, innerH);

  // Dealer band on the facing side — cue for which 3 sides have seats.
  const bandT = Math.max(2, Math.round(Math.min(w, h) * 0.16));
  g.fillStyle(0x8a3a14, a);
  if (facing === 'N')      g.fillRect(innerX, innerY,                  innerW, bandT);
  else if (facing === 'S') g.fillRect(innerX, innerY + innerH - bandT, innerW, bandT);
  else if (facing === 'W') g.fillRect(innerX, innerY,                  bandT,  innerH);
  else                     g.fillRect(innerX + innerW - bandT, innerY, bandT,  innerH);

  // Variant-specific centerpiece. Each recipe is intentionally small so
  // the look reads at game scale rather than relying on fine detail.
  const cx = x + w / 2;
  const cy = y + h / 2;

  if (large && variant === 'craps') {
    drawCrapsCentre(g, cx, cy, innerX, innerY, innerW, innerH, a);
  } else if (large) {
    drawRouletteCentre(g, cx, cy, w, h, a);
  } else if (variant === 'poker') {
    drawPokerCentre(g, cx, cy, innerX, innerY, innerW, innerH, felt, a);
  } else {
    drawBlackjackCentre(g, innerX, innerY, innerW, innerH, felt, bandT, facing, a);
  }
}

// Roulette: prominent two-tone wheel with a brass nub — the visual
// signature of a roulette table.
function drawRouletteCentre(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, w: number, h: number, a: number,
): void {
  const r  = Math.max(2, Math.min(w, h) * 0.20);
  g.fillStyle(0x8a3a14, a);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0x1a1208, a);
  g.fillCircle(cx, cy, Math.max(1, r * 0.45));
  // Brass nub catches the eye and reads as "spinning hub".
  g.fillStyle(0xe8d066, a * 0.85);
  g.fillCircle(cx, cy, Math.max(1, r * 0.18));
}

// Craps: brass centre stripe along the long axis with a pair of dice
// markers in the middle. Combined with the red felt this is unmistakably
// a craps table even at low zoom.
function drawCrapsCentre(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  innerX: number, innerY: number, innerW: number, innerH: number,
  a: number,
): void {
  const stripeT = Math.max(1, Math.round(Math.min(innerW, innerH) * 0.10));
  g.fillStyle(0xe8d066, a * 0.75);
  if (innerW >= innerH) {
    g.fillRect(innerX, cy - stripeT / 2, innerW, stripeT);
  } else {
    g.fillRect(cx - stripeT / 2, innerY, stripeT, innerH);
  }
  // Two small dice as light ivory squares.
  const d = Math.max(2, Math.round(Math.min(innerW, innerH) * 0.16));
  g.fillStyle(0xfff5d6, a);
  g.fillRect(cx - d - 1, cy - d / 2, d, d);
  g.fillRect(cx + 1,     cy - d / 2, d, d);
}

// Blackjack: brass arc-style stripe just inside the dealer band, plus a
// row of small chip-slot dots along the player edge. Reads as "dealer
// pulls cards from here".
function drawBlackjackCentre(
  g: Phaser.GameObjects.Graphics,
  innerX: number, innerY: number, innerW: number, innerH: number,
  felt: number, bandT: number, facing: GC.Orientation, a: number,
): void {
  const stripeT = Math.max(1, Math.round(Math.min(innerW, innerH) * 0.06));
  g.fillStyle(0xe8d066, a * 0.7);
  if (facing === 'N') {
    g.fillRect(innerX + felt, innerY + bandT + felt, innerW - 2 * felt, stripeT);
  } else if (facing === 'S') {
    g.fillRect(innerX + felt, innerY + innerH - bandT - felt - stripeT, innerW - 2 * felt, stripeT);
  } else if (facing === 'W') {
    g.fillRect(innerX + bandT + felt, innerY + felt, stripeT, innerH - 2 * felt);
  } else {
    g.fillRect(innerX + innerW - bandT - felt - stripeT, innerY + felt, stripeT, innerH - 2 * felt);
  }
  // Chip-slot dots near the opposite (player) edge — keeps the cue subtle.
  const dotR = Math.max(1, Math.round(Math.min(innerW, innerH) * 0.05));
  g.fillStyle(0xc8b070, a * 0.85);
  const slots = 3;
  for (let i = 1; i <= slots; i++) {
    const t = i / (slots + 1);
    if (facing === 'N')      g.fillCircle(innerX + innerW * t, innerY + innerH - dotR * 2, dotR);
    else if (facing === 'S') g.fillCircle(innerX + innerW * t, innerY + dotR * 2,           dotR);
    else if (facing === 'W') g.fillCircle(innerX + innerW - dotR * 2, innerY + innerH * t, dotR);
    else                     g.fillCircle(innerX + dotR * 2,           innerY + innerH * t, dotR);
  }
}

// Poker: deeper green felt + a central oval representing the community
// card area, framed by four small chip dots in the corners. Distinct
// from blackjack's brass-arc treatment.
function drawPokerCentre(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  innerX: number, innerY: number, innerW: number, innerH: number,
  felt: number, a: number,
): void {
  const ovalW = Math.max(2, Math.round(innerW * 0.55));
  const ovalH = Math.max(2, Math.round(innerH * 0.40));
  g.fillStyle(0x0e3a18, a);
  g.fillEllipse(cx, cy, ovalW, ovalH);
  // Inner darker oval for depth.
  g.fillStyle(0x092a11, a * 0.7);
  g.fillEllipse(cx, cy, Math.max(1, ovalW - 4), Math.max(1, ovalH - 4));
  // Chip dots in the four felt corners.
  const dotR = Math.max(1, Math.round(Math.min(innerW, innerH) * 0.05));
  g.fillStyle(0xc8b070, a * 0.8);
  g.fillCircle(innerX + felt + dotR,           innerY + felt + dotR,           dotR);
  g.fillCircle(innerX + innerW - felt - dotR,  innerY + felt + dotR,           dotR);
  g.fillCircle(innerX + felt + dotR,           innerY + innerH - felt - dotR,  dotR);
  g.fillCircle(innerX + innerW - felt - dotR,  innerY + innerH - felt - dotR,  dotR);
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

  // Phase V1 — slim top highlight + bottom shadow give the counter
  // perceived thickness. The brass strip drawn next overlaps these on
  // the floor-facing edge; on the wall-facing edge they remain visible
  // and sell "the counter has depth".
  g.fillStyle(0xfff5d6, a * 0.22);
  g.fillRect(body.x, body.y, body.w, 1);
  g.fillStyle(GC.COL_SHADOW, a * 0.40);
  g.fillRect(body.x, body.y + body.h - 1, body.w, 1);

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

// ATM — 1×1 wall machine. Visually distinct from Cashier (which reads as
// a glassed booth): ATM has a dark slate body, a small green-glow screen
// with a brass card slot below it. Same band-as-wall trick as Cashier so
// the back of the unit blends into the wall behind it.
function drawAtmG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
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

  // Machine body — dark slate.
  g.fillStyle(0x222a36, a);
  g.fillRect(body.x, body.y, body.w, body.h);

  // Screen — green-glow inset on the floor side. Sized small so the
  // brass card slot below it still reads.
  const m  = Math.max(1, Math.round(Math.min(body.w, body.h) * 0.18));
  const sw = Math.max(1, body.w - 2 * m);
  const sh = Math.max(1, Math.round(body.h * 0.42));
  let sx = body.x + m;
  let sy = body.y + m;
  if (facing === 'S') sy = body.y + m;            // top of body, away from floor
  else if (facing === 'N') sy = body.y + body.h - sh - m;
  else if (facing === 'W') {
    sx = body.x + body.w - sh - m;                // screen on the wall-side strip
    sy = body.y + m;
  } else if (facing === 'E') {
    sx = body.x + m;
    sy = body.y + m;
  }
  g.fillStyle(0x0f3a24, a);
  g.fillRect(sx, sy, sw, sh);
  // Inner brighter rectangle for "screen lit" feel.
  g.fillStyle(0x4dcc88, a * 0.85);
  const ix = sx + Math.max(1, Math.round(sw * 0.15));
  const iy = sy + Math.max(1, Math.round(sh * 0.20));
  const iw = Math.max(1, Math.round(sw * 0.70));
  const ih = Math.max(1, Math.round(sh * 0.30));
  g.fillRect(ix, iy, iw, ih);

  // Card slot — slim brass strip on the floor-facing edge.
  g.fillStyle(0xcc8a44, a);
  if (facing === 'N') {
    const t = Math.max(1, Math.round(body.h * 0.10));
    g.fillRect(body.x + m, body.y + 1, body.w - 2 * m, t);
  } else if (facing === 'S') {
    const t = Math.max(1, Math.round(body.h * 0.10));
    g.fillRect(body.x + m, body.y + body.h - 1 - t, body.w - 2 * m, t);
  } else if (facing === 'W') {
    const t = Math.max(1, Math.round(body.w * 0.10));
    g.fillRect(body.x + 1, body.y + m, t, body.h - 2 * m);
  } else {
    const t = Math.max(1, Math.round(body.w * 0.10));
    g.fillRect(body.x + body.w - 1 - t, body.y + m, t, body.h - 2 * m);
  }
}

// Buffet — 4×1 wall service. Wall band on the wall side; warm wood
// counter facing the floor; a row of chafing-dish humps with brass tops
// along the floor edge so it reads as "food service" at a glance.
function drawBuffetG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
  const eff: WallSide = side ?? (w >= h ? 'N' : 'W');
  const { band, body, facing } = splitForWall(x, y, w, h, eff);

  drawWallBand(g, band, a);

  // Warm wood counter body.
  g.fillStyle(0x8a5a2e, a);
  g.fillRect(body.x, body.y, body.w, body.h);
  // Phase V1 — slim warm-tone top highlight on the body. Sits at the
  // body's world-y top edge; the chafing-dish row and the existing
  // facing-dependent dark base line below stay intact. Adds a "lit
  // counter top" feel without changing any geometry.
  g.fillStyle(0xfff0c8, a * 0.22);
  g.fillRect(body.x, body.y, body.w, 1);
  // Slim darker base line at the wall-side edge of the body for depth.
  g.fillStyle(0x5a3818, a * 0.85);
  if (facing === 'N') g.fillRect(body.x, body.y, body.w, 1);
  else if (facing === 'S') g.fillRect(body.x, body.y + body.h - 1, body.w, 1);
  else if (facing === 'W') g.fillRect(body.x, body.y, 1, body.h);
  else g.fillRect(body.x + body.w - 1, body.y, 1, body.h);

  // Chafing-dish row along the floor-facing edge. Brass dome with a
  // darker base. Number of dishes scales with body length.
  const horiz = facing === 'N' || facing === 'S';
  const longLen = horiz ? body.w : body.h;
  const dishes  = Math.max(2, Math.floor(longLen / 8));
  const dishW   = Math.max(3, Math.round(longLen / (dishes + 0.4)));
  for (let i = 0; i < dishes; i++) {
    const t = (i + 0.5) / dishes;
    if (facing === 'N') {
      const cx = body.x + t * body.w;
      const dy = body.y + body.h - Math.max(2, Math.round(body.h * 0.55));
      drawChafingDish(g, cx, dy, dishW, Math.max(2, Math.round(body.h * 0.55)), a);
    } else if (facing === 'S') {
      const cx = body.x + t * body.w;
      const dy = body.y;
      drawChafingDish(g, cx, dy, dishW, Math.max(2, Math.round(body.h * 0.55)), a);
    } else if (facing === 'W') {
      const cy = body.y + t * body.h;
      const dx = body.x + body.w - Math.max(2, Math.round(body.w * 0.55));
      drawChafingDishV(g, dx, cy, Math.max(2, Math.round(body.w * 0.55)), dishW, a);
    } else {
      const cy = body.y + t * body.h;
      const dx = body.x;
      drawChafingDishV(g, dx, cy, Math.max(2, Math.round(body.w * 0.55)), dishW, a);
    }
  }
}

// Single chafing dish glyph centred at (cx, top-y), drawn as a brass dome
// over a darker base. Used by the floor-facing row in Buffet (horizontal).
function drawChafingDish(
  g: Phaser.GameObjects.Graphics,
  cx: number, topY: number, dishW: number, dishH: number, a: number,
): void {
  const baseH = Math.max(1, Math.round(dishH * 0.30));
  const domeH = dishH - baseH;
  // Base — dark wood/iron tone.
  g.fillStyle(0x3a1f0e, a);
  g.fillRect(cx - dishW / 2, topY + domeH, dishW, baseH);
  // Brass dome.
  g.fillStyle(0xe8d066, a);
  g.fillEllipse(cx, topY + domeH, dishW, domeH * 2);
  // Small handle dot on top.
  g.fillStyle(0xfff0a8, a);
  g.fillCircle(cx, topY + Math.max(1, Math.round(domeH * 0.25)),
               Math.max(1, Math.round(Math.min(dishW, domeH) * 0.18)));
}

// Vertical-orientation variant for E/W facings.
function drawChafingDishV(
  g: Phaser.GameObjects.Graphics,
  leftX: number, cy: number, dishW: number, dishH: number, a: number,
): void {
  const baseW = Math.max(1, Math.round(dishW * 0.30));
  const domeW = dishW - baseW;
  g.fillStyle(0x3a1f0e, a);
  g.fillRect(leftX + domeW, cy - dishH / 2, baseW, dishH);
  g.fillStyle(0xe8d066, a);
  g.fillEllipse(leftX + domeW, cy, domeW * 2, dishH);
  g.fillStyle(0xfff0a8, a);
  g.fillCircle(leftX + Math.max(1, Math.round(domeW * 0.25)), cy,
               Math.max(1, Math.round(Math.min(dishH, domeW) * 0.18)));
}

// Sportsbook — 4×1 wall service. Slate counter on the floor side; two
// wide green "odds-board" screen panels embedded near the wall side with
// thin slats reading as betting lines. Brass strip along the counter edge
// for the cashier-style highlight.
function drawSportsbookG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  side: WallSide | null,
): void {
  const eff: WallSide = side ?? (w >= h ? 'N' : 'W');
  const { band, body, facing } = splitForWall(x, y, w, h, eff);

  drawWallBand(g, band, a);

  // Slate counter body.
  g.fillStyle(0x222a36, a);
  g.fillRect(body.x, body.y, body.w, body.h);

  // Two green "odds-board" panels biased toward the wall side of the body.
  const horiz = facing === 'N' || facing === 'S';
  g.fillStyle(0x1a4d2a, a);
  if (horiz) {
    const pad   = Math.max(1, Math.round(body.w * 0.06));
    const panel = (body.w - pad * 3) / 2;
    const panH  = Math.max(2, Math.round(body.h * 0.55));
    const panY  = facing === 'N' ? body.y + 1 : body.y + body.h - 1 - panH;
    g.fillRect(body.x + pad,             panY, panel, panH);
    g.fillRect(body.x + pad * 2 + panel, panY, panel, panH);
    // Slats on each panel — thin ivory horizontal lines.
    g.fillStyle(0xe8e8e0, a * 0.85);
    for (let p = 0; p < 2; p++) {
      const px = body.x + pad + p * (panel + pad);
      const slats = 3;
      for (let i = 0; i < slats; i++) {
        const sy = panY + Math.max(1, Math.round(panH * (0.25 + i * 0.22)));
        g.fillRect(px + 1, sy, panel - 2, 1);
      }
    }
  } else {
    const pad   = Math.max(1, Math.round(body.h * 0.06));
    const panel = (body.h - pad * 3) / 2;
    const panW  = Math.max(2, Math.round(body.w * 0.55));
    const panX  = facing === 'W' ? body.x + 1 : body.x + body.w - 1 - panW;
    g.fillRect(panX, body.y + pad,             panW, panel);
    g.fillRect(panX, body.y + pad * 2 + panel, panW, panel);
    g.fillStyle(0xe8e8e0, a * 0.85);
    for (let p = 0; p < 2; p++) {
      const py = body.y + pad + p * (panel + pad);
      const slats = 3;
      for (let i = 0; i < slats; i++) {
        const sx = panX + Math.max(1, Math.round(panW * (0.25 + i * 0.22)));
        g.fillRect(sx, py + 1, 1, panel - 2);
      }
    }
  }

  // Brass strip along the floor-facing edge of the counter.
  g.fillStyle(0xcc8a44, a);
  if (facing === 'N') {
    const t = Math.max(1, Math.round(body.h * 0.18));
    g.fillRect(body.x, body.y + body.h - t, body.w, t);
  } else if (facing === 'S') {
    const t = Math.max(1, Math.round(body.h * 0.18));
    g.fillRect(body.x, body.y, body.w, t);
  } else if (facing === 'W') {
    const t = Math.max(1, Math.round(body.w * 0.18));
    g.fillRect(body.x + body.w - t, body.y, t, body.h);
  } else {
    const t = Math.max(1, Math.round(body.w * 0.18));
    g.fillRect(body.x, body.y, t, body.h);
  }
}

// Keno Lounge — 3×3 floor table-like attraction. Lounge carpet base,
// felt rim, central 4×4 keno board with a few highlighted "drawn" dots.
// No dealer band — keno is a relaxed game where players read the board,
// so the visual reads as "shared lounge" rather than "table game".
function drawKenoLoungeG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
): void {
  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.10));

  // Carpet base across the whole footprint.
  g.fillStyle(0x2a1a4d, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Wood rim — purple-tinted dark wood.
  g.fillStyle(0x4a2f1a, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);

  // Felt — deep purple, the lounge's signature.
  const felt   = Math.max(1, Math.round(pad * 0.6));
  const innerX = x + pad + felt;
  const innerY = y + pad + felt;
  const innerW = w - 2 * (pad + felt);
  const innerH = h - 2 * (pad + felt);
  g.fillStyle(0x4d2a6e, a);
  g.fillRect(innerX, innerY, innerW, innerH);

  // 4×4 keno-board grid centred on the felt. Dots are gold; a few
  // randomised slots are brighter to read as "drawn numbers".
  const cols = 4;
  const rows = 4;
  const cellW = innerW / cols;
  const cellH = innerH / rows;
  const dotR  = Math.max(1, Math.min(cellW, cellH) * 0.22);
  // Deterministic-by-position highlight pattern so every Keno Lounge
  // looks the same. Picked to feel scattered but balanced.
  const lit = new Set(['0,0', '1,2', '2,1', '3,3']);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = innerX + (c + 0.5) * cellW;
      const cy = innerY + (r + 0.5) * cellH;
      const isLit = lit.has(`${c},${r}`);
      g.fillStyle(isLit ? 0xfff0a8 : 0xc8a040, a * (isLit ? 1.0 : 0.7));
      g.fillCircle(cx, cy, dotR);
      if (isLit) {
        // Subtle ring around drawn numbers for emphasis.
        g.lineStyle(1, 0xe8d066, a * 0.9);
        g.strokeCircle(cx, cy, dotR + 1);
      }
    }
  }
  g.lineStyle(0, 0, 0); // reset stroke state for downstream draws
}

// High-Stakes Table — 3×3 premium table. Deep red felt with gold trim,
// dealer band on the facing side (same convention as small/large tables),
// and a variant-dependent centerpiece. Reads as "this is the expensive
// table" at a glance.
function drawHighStakesG(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, a: number,
  facing: GC.Orientation, variant: string,
): void {
  const pad = Math.max(1, Math.round(Math.min(w, h) * 0.12));

  // Carpet around table — darker than the standard table carpet so the
  // table itself pops as premium.
  g.fillStyle(0x140805, a * 0.9);
  g.fillRect(x, y, w - 1, h - 1);

  // Wood rim — very dark wood with a thin inner gold trim line.
  g.fillStyle(0x2a0e08, a);
  g.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad);
  g.fillStyle(0xe8d066, a * 0.85);
  const trim = 1;
  g.fillRect(x + pad,           y + pad,           w - 2 * pad, trim);
  g.fillRect(x + pad,           y + h - pad - trim, w - 2 * pad, trim);
  g.fillRect(x + pad,           y + pad,           trim, h - 2 * pad);
  g.fillRect(x + w - pad - trim, y + pad,           trim, h - 2 * pad);

  // Felt — deep blood red.
  const felt   = Math.max(1, Math.round(pad * 0.6));
  const innerX = x + pad + felt;
  const innerY = y + pad + felt;
  const innerW = w - 2 * (pad + felt);
  const innerH = h - 2 * (pad + felt);
  g.fillStyle(0x6e1a1a, a);
  g.fillRect(innerX, innerY, innerW, innerH);

  // Dealer band — gold-tinted on the facing side. Matches the small/large
  // table convention so player seats are read on the other 3 sides.
  const bandT = Math.max(2, Math.round(Math.min(w, h) * 0.14));
  g.fillStyle(0x8a3a14, a);
  if (facing === 'N')      g.fillRect(innerX, innerY,                  innerW, bandT);
  else if (facing === 'S') g.fillRect(innerX, innerY + innerH - bandT, innerW, bandT);
  else if (facing === 'W') g.fillRect(innerX, innerY,                  bandT,  innerH);
  else                     g.fillRect(innerX + innerW - bandT, innerY, bandT,  innerH);

  const cx = x + w / 2;
  const cy = y + h / 2;

  if (variant === 'high-roller') {
    drawHighRollerCentre(g, cx, cy, innerW, innerH, a);
  } else {
    // baccarat default
    drawBaccaratCentre(g, cx, cy, innerW, innerH, a);
  }
}

// Baccarat centerpiece — gold diamond with a small inner card glyph.
// Reads as "elegant card game".
function drawBaccaratCentre(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, innerW: number, innerH: number, a: number,
): void {
  const r = Math.max(2, Math.min(innerW, innerH) * 0.22);
  // Gold diamond.
  g.fillStyle(0xe8d066, a);
  g.beginPath();
  g.moveTo(cx,     cy - r);
  g.lineTo(cx + r, cy);
  g.lineTo(cx,     cy + r);
  g.lineTo(cx - r, cy);
  g.closePath();
  g.fillPath();
  // Small inner card glyph — ivory rectangle with a red corner pip.
  const cw = r * 0.7;
  const ch = r * 0.9;
  g.fillStyle(0xfff5e0, a);
  g.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
  g.fillStyle(0x8a1a1a, a);
  g.fillCircle(cx - cw / 2 + 2, cy - ch / 2 + 2, Math.max(1, cw * 0.18));
}

// High-roller centerpiece — central black-and-gold chip plus four chip
// stacks at the corners of an inner square. Reads as "money table".
function drawHighRollerCentre(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, innerW: number, innerH: number, a: number,
): void {
  const r = Math.max(2, Math.min(innerW, innerH) * 0.18);
  // Central chip — dark with gold ring.
  g.fillStyle(0x1a0e08, a);
  g.fillCircle(cx, cy, r);
  g.lineStyle(Math.max(1, r * 0.18), 0xe8d066, a);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(0, 0, 0);
  // Inner gold star-ish dot.
  g.fillStyle(0xe8d066, a);
  g.fillCircle(cx, cy, Math.max(1, r * 0.35));

  // Four corner chip stacks — small triple-disc stacks in gold.
  const off = Math.min(innerW, innerH) * 0.30;
  const stackR = Math.max(1, r * 0.45);
  const positions: [number, number][] = [
    [cx - off, cy - off], [cx + off, cy - off],
    [cx - off, cy + off], [cx + off, cy + off],
  ];
  for (const [px, py] of positions) {
    // Three offset discs to suggest a stack.
    g.fillStyle(0x6e5018, a);
    g.fillCircle(px, py + stackR * 0.25, stackR);
    g.fillStyle(0x9a7028, a);
    g.fillCircle(px, py,                 stackR);
    g.fillStyle(0xe8d066, a);
    g.fillCircle(px, py - stackR * 0.25, stackR);
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
    case GC.ObjType.WC:           drawWCC        (ctx, x, y, w, h); break;
    case GC.ObjType.BAR:          drawBarC       (ctx, x, y, w, h); break;
    case GC.ObjType.CASHIER:      drawCashierC   (ctx, x, y, w, h); break;
    case GC.ObjType.ATM:          drawAtmC       (ctx, x, y, w, h); break;
    case GC.ObjType.BUFFET:       drawBuffetC    (ctx, x, y, w, h); break;
    case GC.ObjType.SPORTSBOOK:   drawSportsbookC(ctx, x, y, w, h); break;
    case GC.ObjType.KENO_LOUNGE:       drawKenoLoungeC(ctx, x, y, w, h); break;
    case GC.ObjType.HIGH_STAKES_TABLE: drawHighStakesC(ctx, x, y, w, h); break;
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

// Buffet thumbnail — warm wood counter with three brass chafing-dish
// domes along the floor edge. Echoes the in-grid row-of-dishes silhouette.
function drawBuffetC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#8a5a2e', x, y, w, h);
  // Counter base shadow line (top).
  fillRect(ctx, '#5a3818', x, y, w, Math.max(1, Math.round(h * 0.12)));
  // Three chafing-dish domes along the bottom.
  const n = 3;
  const pad = Math.max(1, Math.round(w * 0.08));
  const slot = (w - pad * 2) / n;
  const domeH = Math.max(3, Math.round(h * 0.42));
  const baseH = Math.max(2, Math.round(h * 0.16));
  for (let i = 0; i < n; i++) {
    const cx = x + pad + slot * (i + 0.5);
    const topY = y + h - domeH - baseH;
    // Base.
    fillRect(ctx, '#3a1f0e', cx - slot * 0.4, topY + domeH, slot * 0.8, baseH);
    // Brass dome.
    ctx.fillStyle = '#e8d066';
    ctx.beginPath();
    ctx.ellipse(cx, topY + domeH, slot * 0.4, domeH, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    // Handle dot.
    ctx.fillStyle = '#fff0a8';
    ctx.beginPath();
    ctx.arc(cx, topY + Math.round(domeH * 0.4), Math.max(1.2, slot * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Sportsbook thumbnail — slate body, two green odds-board panels with
// thin slats, brass counter strip at the bottom.
function drawSportsbookC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#222a36', x, y, w, h);
  const pad = Math.max(2, Math.round(w * 0.08));
  const panel = (w - pad * 3) / 2;
  const panY = y + Math.max(2, Math.round(h * 0.12));
  const panH = Math.round(h * 0.50);
  fillRect(ctx, '#1a4d2a', x + pad,             panY, panel, panH);
  fillRect(ctx, '#1a4d2a', x + pad * 2 + panel, panY, panel, panH);
  // Slats.
  ctx.fillStyle = '#e8e8e0';
  const slats = 3;
  for (let p = 0; p < 2; p++) {
    const px = x + pad + p * (panel + pad);
    for (let i = 0; i < slats; i++) {
      const sy = panY + Math.round(panH * (0.22 + i * 0.24));
      ctx.fillRect(px + 2, sy, panel - 4, 1.5);
    }
  }
  // Brass counter strip.
  fillRect(ctx, '#cc8a44', x, y + Math.round(h * 0.78), w, Math.max(2, Math.round(h * 0.14)));
}

// Keno Lounge thumbnail — purple felt, 4×4 dot grid with a few brighter
// "drawn" highlights. Echoes the in-grid keno-board centerpiece.
function drawKenoLoungeC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#4a2f1a', x, y, w, h);
  const f = Math.max(2, Math.round(Math.min(w, h) * 0.12));
  fillRect(ctx, '#4d2a6e', x + f, y + f, w - 2 * f, h - 2 * f);
  // 4×4 dot grid.
  const cols = 4;
  const rows = 4;
  const innerX = x + f;
  const innerY = y + f;
  const innerW = w - 2 * f;
  const innerH = h - 2 * f;
  const cellW = innerW / cols;
  const cellH = innerH / rows;
  const dotR  = Math.max(1, Math.min(cellW, cellH) * 0.22);
  const lit = new Set(['0,0', '1,2', '2,1', '3,3']);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = innerX + (c + 0.5) * cellW;
      const cy = innerY + (r + 0.5) * cellH;
      const isLit = lit.has(`${c},${r}`);
      ctx.fillStyle = isLit ? '#fff0a8' : '#c8a040';
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// High-Stakes Table thumbnail — dark wood rim with gold trim, blood-red
// felt, central gold diamond hinting at the baccarat-default centerpiece.
function drawHighStakesC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Wood rim.
  fillRect(ctx, '#2a0e08', x, y, w, h);
  // Inner gold trim line.
  ctx.strokeStyle = '#e8d066';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  // Felt.
  const f = Math.max(2, Math.round(Math.min(w, h) * 0.14));
  fillRect(ctx, '#6e1a1a', x + f, y + f, w - 2 * f, h - 2 * f);
  // Dealer band on top edge for table-family consistency.
  fillRect(ctx, '#8a3a14', x + f, y + f, w - 2 * f, Math.max(2, Math.round(h * 0.14)));
  // Central gold diamond.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(3, Math.min(w, h) * 0.20);
  ctx.fillStyle = '#e8d066';
  ctx.beginPath();
  ctx.moveTo(cx,     cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx,     cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  // Inner ivory card hint.
  ctx.fillStyle = '#fff5e0';
  ctx.fillRect(cx - r * 0.35, cy - r * 0.45, r * 0.7, r * 0.9);
}

// ATM thumbnail — slate body, green screen, brass slot. Echoes the in-grid
// art so the build-panel choice reads the same on the floor.
function drawAtmC(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fillRect(ctx, '#222a36', x, y, w, h);
  // Screen
  const m = Math.max(3, Math.round(Math.min(w, h) * 0.18));
  fillRect(ctx, '#0f3a24', x + m, y + m, w - 2 * m, Math.round(h * 0.42));
  fillRect(ctx, '#4dcc88',
    x + m + Math.round((w - 2 * m) * 0.15),
    y + m + Math.round(h * 0.42 * 0.20),
    Math.round((w - 2 * m) * 0.70),
    Math.round(h * 0.42 * 0.30));
  // Card slot
  fillRect(ctx, '#cc8a44',
    x + m, y + Math.round(h * 0.66),
    w - 2 * m, Math.max(2, Math.round(h * 0.10)));
  // Keypad hint — three small dark rows below the slot.
  ctx.fillStyle = '#0e1115';
  const kx = x + m;
  const kw = w - 2 * m;
  const ky = y + Math.round(h * 0.80);
  const kh = Math.max(1, Math.round(h * 0.06));
  ctx.fillRect(kx, ky, kw, kh);
}
