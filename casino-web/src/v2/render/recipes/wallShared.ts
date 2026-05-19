// wallShared.ts — shared geometry + paint helpers for V2 wall-service
// recipes (WC, Cashier, ATM, Bar, Buffet, Sportsbook).
//
// The placement validator guarantees that any wall service in
// gameState.placedObjs attaches to the NORTH (top) or WEST (left)
// visible wall. This module reads tiles via PlacementValidator
// .detectWallDir and converts the object's footprint into a screen-
// space wall section that the recipe paints into.
//
// All projection math goes through ProjectionV2. Vertical extrusion
// uses wallVerticalOffset(ts) — no literal multipliers on ts for wall
// height.
//
// Section geometry: the bottom edge of the section sits on the SAME
// projected plane as WallRendererV2's wall — for N this is world row=1
// (i.e. obj.row, since N wall services have obj.row = 1 against the
// north border); for W this is world col=1 (obj.col). Anchoring at the
// wall-side edge makes the facade exactly overpaint the wall segments
// WallRendererV2 paints for those tiles; when an object is absent, the
// base wall paint shows through naturally.
import Phaser from 'phaser';
import * as GC from '../../../logic/GameConstants';
import { detectWallDir } from '../../../logic/PlacementValidator';
import * as Proj from '../ProjectionV2';
import { WALL_PANEL, WOOD_DARK, BRASS } from '../PaletteV2';
import { lerpVec } from './drawHelpers';

export type WallSide = 'N' | 'W';

export interface WallSection {
  side    : WallSide;
  // Bottom edge corners, scene-local (already offset by baseX/baseY).
  // For N: bottomA is the leftmost (smaller col); bottomB the rightmost.
  // For W: bottomA is the frontmost (larger row); bottomB the backmost.
  bottomA : Proj.Vec2;
  bottomB : Proj.Vec2;
  topA    : Proj.Vec2;
  topB    : Proj.Vec2;
  wallPx  : number;
  baseX   : number;
  baseY   : number;
  ts      : number;
}

// Returns the wall section for the given object, or null if the object
// is not actually attached to a visible (N/W) wall. Recipes call this
// at entry and bail on null so a stray validator state never throws.
export function getWallSection(
  obj: GC.PlacedObj,
  tiles: readonly GC.Tile[],
  baseX: number, baseY: number, ts: number,
): WallSection | null {
  // PV.detectWallDir expects a mutable array, but only reads from it.
  // The cast keeps the wallShared API readonly without changing PV's
  // signature (PV is the source of truth and we don't want to churn it).
  const wallDir = detectWallDir(obj.col, obj.row, obj.w, obj.h, tiles as GC.Tile[]);
  if (wallDir !== 'top' && wallDir !== 'left') return null;

  const side: WallSide = wallDir === 'top' ? 'N' : 'W';
  const { col, row, w, h } = obj;
  let bottomAWorld: Proj.Vec2;
  let bottomBWorld: Proj.Vec2;
  if (side === 'N') {
    // North wall: facade bottom edge sits on the wall plane at world
    // row = obj.row (matches WallRendererV2 painting at world row=1
    // for the typical case). Span runs west-to-east along the wall.
    bottomAWorld = Proj.worldToScreen(col,     row, ts);
    bottomBWorld = Proj.worldToScreen(col + w, row, ts);
  } else {
    // West wall: facade bottom edge sits on the wall plane at world
    // col = obj.col. Span runs front-to-back (larger row → smaller row)
    // so bottomA stays the front (down-left on screen) corner.
    bottomAWorld = Proj.worldToScreen(col, row + h, ts);
    bottomBWorld = Proj.worldToScreen(col, row,     ts);
  }

  const bottomA: Proj.Vec2 = { x: bottomAWorld.x + baseX, y: bottomAWorld.y + baseY };
  const bottomB: Proj.Vec2 = { x: bottomBWorld.x + baseX, y: bottomBWorld.y + baseY };
  const wallPx = Proj.wallVerticalOffset(ts);
  const topA: Proj.Vec2 = { x: bottomA.x, y: bottomA.y - wallPx };
  const topB: Proj.Vec2 = { x: bottomB.x, y: bottomB.y - wallPx };

  return { side, bottomA, bottomB, topA, topB, wallPx, baseX, baseY, ts };
}

// ── Painting helpers ─────────────────────────────────────────────────────

// Fill the entire wall section as a single parallelogram. Used as the
// base "void" pass before per-recipe details overpaint.
export function fillWallQuad(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  color: number, alpha: number,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints([section.bottomA, section.bottomB, section.topB, section.topA], true);
}

// Dark wall-panel base inside the recipe's facade band. Wall recipes
// call this first so any leftover WallRendererV2 wall behind the
// facade is hidden by the recipe's own composition.
//
// `facadeFraction` lets recipes void only the lower
// facade slice (e.g. 0.6) instead of the whole wall section, leaving
// the upper wall paint from WallRendererV2 visible above. Defaults to
// 1.0 for callers that still want the full void.
export function drawWallVoid(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  alpha: number,
  facadeFraction = 1.0,
): void {
  if (facadeFraction >= 1.0) {
    fillWallQuad(g, section, WALL_PANEL, alpha);
    return;
  }
  drawInsetRectOnWall(g, section, 0, 1, 0, facadeFraction, WALL_PANEL, alpha);
}

// Horizontal band across the full section width, between two pixel
// heights y1 (lower) and y2 (upper) above the bottom edge. Lifting via
// section.wallPx keeps every recipe in agreement on the height axis.
export function drawWallBand(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  y1: number, y2: number,
  color: number, alpha: number,
): void {
  const quad: Proj.Vec2[] = [
    { x: section.bottomA.x, y: section.bottomA.y - y1 },
    { x: section.bottomB.x, y: section.bottomB.y - y1 },
    { x: section.bottomB.x, y: section.bottomB.y - y2 },
    { x: section.bottomA.x, y: section.bottomA.y - y2 },
  ];
  g.fillStyle(color, alpha);
  g.fillPoints(quad, true);
}

// A point lifted yFraction up the wall, halfway across the bottom edge.
// Useful for centring labels / signs.
export function wallCenter(section: WallSection, yFraction: number): Proj.Vec2 {
  return {
    x: (section.bottomA.x + section.bottomB.x) / 2,
    y: (section.bottomA.y + section.bottomB.y) / 2 - yFraction * section.wallPx,
  };
}

// Inset filled rectangle on the wall, expressed in *normalised* wall
// coordinates: x in [0, 1] along bottomA→bottomB, y in [0, 1] from
// floor edge to top of wall. The rectangle inherits the wall's shear so
// signs / doors / windows ride the wall correctly at any zoom.
export function drawInsetRectOnWall(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  x1: number, x2: number,
  y1: number, y2: number,
  color: number, alpha: number,
): void {
  const bottomAtX1 = lerpVec(section.bottomA, section.bottomB, x1);
  const bottomAtX2 = lerpVec(section.bottomA, section.bottomB, x2);
  const quad: Proj.Vec2[] = [
    { x: bottomAtX1.x, y: bottomAtX1.y - y1 * section.wallPx },
    { x: bottomAtX2.x, y: bottomAtX2.y - y1 * section.wallPx },
    { x: bottomAtX2.x, y: bottomAtX2.y - y2 * section.wallPx },
    { x: bottomAtX1.x, y: bottomAtX1.y - y2 * section.wallPx },
  ];
  g.fillStyle(color, alpha);
  g.fillPoints(quad, true);
}

// ── Facade-fraction helpers ──────────────────────────────────────────────
//
// Wall services don't fill the whole wall — they paint into
// a lower facade slice (typically 50–80 % of wall height). These helpers
// let recipes keep their internal y-fractions in [0, 1] of the facade,
// converted on the fly to wall y-fractions. The recipe just declares
// one constant (FACADE_FRACTION) and uses the *Facade variants below.

// Drop-in for drawInsetRectOnWall when the recipe is working in facade
// coordinates. y1 / y2 are 0..1 of the facade, x1 / x2 are 0..1 along
// the wall section width as before.
export function drawFacadeRect(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  x1: number, x2: number,
  facadeY1: number, facadeY2: number,
  facadeFraction: number,
  color: number, alpha: number,
): void {
  drawInsetRectOnWall(
    g, section, x1, x2,
    facadeY1 * facadeFraction, facadeY2 * facadeFraction,
    color, alpha,
  );
}

// A point centred horizontally and lifted to facadeYFraction up the
// facade. Equivalent to wallCenter(section, facadeYFraction * facadeFraction).
export function facadeCenter(
  section: WallSection,
  facadeFraction: number,
  facadeYFraction: number,
): Proj.Vec2 {
  return wallCenter(section, facadeYFraction * facadeFraction);
}

// Convenience: pixel height of the facade in scene-local screen pixels.
// Useful for recipes that paint absolute-pixel bands (e.g. SCREEN_GLOW
// strips) via drawWallBand.
export function facadePx(section: WallSection, facadeFraction: number): number {
  return section.wallPx * facadeFraction;
}

// Hairline brass frame around the wall section, with a darker inner trim.
// Adds a finished edge so the recipe doesn't bleed into the surrounding
// wall paint. Optional — recipes may skip if the section is small.
export function drawWallPanelFrame(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  alpha: number,
): void {
  const ring: Proj.Vec2[] = [section.bottomA, section.bottomB, section.topB, section.topA];
  g.lineStyle(2, BRASS, alpha * 0.9);
  g.strokePoints(ring, true);
  g.lineStyle(1, WOOD_DARK, alpha * 0.6);
  g.strokePoints(ring, true);
}
