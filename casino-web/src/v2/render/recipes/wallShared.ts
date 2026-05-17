// wallShared.ts — shared geometry + paint helpers for V2 wall-service
// recipes (WC, Cashier, ATM, Bar, Buffet, Sportsbook).
//
// The Phase 3 placement validator guarantees that any wall service in
// gameState.placedObjs attaches to the NORTH (top) or WEST (left) visible
// wall. This module reads tiles via PlacementValidator.detectWallDir and
// converts the object's footprint into a screen-space wall section that
// the recipe paints into.
//
// All projection math goes through ProjectionV2. Vertical extrusion uses
// wallVerticalOffset(ts) — no literal multipliers on ts for wall height.
//
// Section geometry follows the Phase 5 prompt: the bottom edge of the
// section sits at the INSIDE edge of the object's footprint (the side
// facing the room interior), not at the wall tile itself. So a N service
// rises from `row + h`; a W service rises from `col + w`. The result
// reads as a tall facade standing forward of the painted wall.
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
  // signature (PV is shared with V1 and we don't want to churn it).
  const wallDir = detectWallDir(obj.col, obj.row, obj.w, obj.h, tiles as GC.Tile[]);
  if (wallDir !== 'top' && wallDir !== 'left') return null;

  const side: WallSide = wallDir === 'top' ? 'N' : 'W';
  const { col, row, w, h } = obj;
  let bottomAWorld: Proj.Vec2;
  let bottomBWorld: Proj.Vec2;
  if (side === 'N') {
    bottomAWorld = Proj.worldToScreen(col,     row + h, ts);
    bottomBWorld = Proj.worldToScreen(col + w, row + h, ts);
  } else {
    bottomAWorld = Proj.worldToScreen(col + w, row + h, ts);
    bottomBWorld = Proj.worldToScreen(col + w, row,     ts);
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

// Dark wall-panel base. Wall recipes call this first so any leftover
// WallRendererV2 wall behind the section is hidden by the recipe's own
// composition.
export function drawWallVoid(
  g: Phaser.GameObjects.Graphics,
  section: WallSection,
  alpha: number,
): void {
  fillWallQuad(g, section, WALL_PANEL, alpha);
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
