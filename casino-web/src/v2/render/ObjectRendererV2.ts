// ObjectRendererV2.ts — dispatcher for V2 floor-object recipes.
//
// Pure painter. Reads placedObjs + functionalIds from parameters (not
// gameState directly) so future callers can render alternate object sets
// (placement ghost preview, screenshot exports) without monkey-patching.
//
// Depth sort: back-to-front using ProjectionV2.depthKey. Tie-break by
// original index in placedObjs so a stable ordering survives across
// re-renders even when two objects share the same depth key.
//
// Every ObjType in OBJ_DEFS has a recipe; the dispatcher's default case
// silently skips unknown types so a save with a future ObjType added
// before its recipe exists still loads cleanly.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import type { RecipeContext } from './recipes/RecipeContext';
import { drawSlot } from './recipes/slot';
import { drawSmallTable } from './recipes/smallTable';
import { drawLargeTable } from './recipes/largeTable';
import { drawKeno } from './recipes/keno';
import { drawHighStakes } from './recipes/highStakes';
import { drawWC } from './recipes/wc';
import { drawCashier } from './recipes/cashier';
import { drawATM } from './recipes/atm';
import { drawBar } from './recipes/bar';
import { drawBuffet } from './recipes/buffet';
import { drawSportsbook } from './recipes/sportsbook';

export function drawObjects(
  g: Phaser.GameObjects.Graphics,
  placedObjs: readonly GC.PlacedObj[],
  functionalIds: ReadonlySet<string>,
  tiles: readonly GC.Tile[],
  baseX: number, baseY: number, ts: number,
): void {
  if (placedObjs.length === 0) return;

  // Stable depth-sorted view of the input. Shallow copy — never mutate
  // the caller's array. Tie-break by original index keeps the paint
  // order deterministic when depthKey collides.
  const ordered = placedObjs
    .map((obj, index) => ({ obj, index }))
    .sort((a, b) => {
      const da = Proj.depthKey(a.obj.col, a.obj.row, a.obj.w, a.obj.h);
      const db = Proj.depthKey(b.obj.col, b.obj.row, b.obj.w, b.obj.h);
      if (da !== db) return da - db;
      return a.index - b.index;
    });

  for (const { obj } of ordered) {
    const isFunctional = functionalIds.has(obj.id);
    // 1.0 functional / 0.45 inert so the player can see at a glance
    // which placements aren't currently operating.
    const alpha = isFunctional ? 1.0 : 0.45;
    const ctx: RecipeContext = {
      g, obj, tiles, baseX, baseY, ts, alpha, isFunctional,
    };
    _dispatch(ctx);
  }
}

// Public single-object draw used by both drawObjects and the placement
// ghost in GhostRendererV2. The recipe paints into the caller's
// Graphics; alpha/isFunctional in ctx drive dim/bright variations.
export function drawObject(ctx: RecipeContext): void {
  _dispatch(ctx);
}

// Per-type dispatch. Every ObjType in OBJ_DEFS has a recipe today;
// the default case stays as a safety net for any future ObjType added
// before its recipe exists.
function _dispatch(ctx: RecipeContext): void {
  switch (ctx.obj.type) {
    case GC.ObjType.SLOT_MACHINE:      drawSlot       (ctx); return;
    case GC.ObjType.SMALL_TABLE:       drawSmallTable (ctx); return;
    case GC.ObjType.LARGE_TABLE:       drawLargeTable (ctx); return;
    case GC.ObjType.KENO_LOUNGE:       drawKeno       (ctx); return;
    case GC.ObjType.HIGH_STAKES_TABLE: drawHighStakes (ctx); return;
    case GC.ObjType.WC:                drawWC         (ctx); return;
    case GC.ObjType.CASHIER:           drawCashier    (ctx); return;
    case GC.ObjType.ATM:               drawATM        (ctx); return;
    case GC.ObjType.BAR:               drawBar        (ctx); return;
    case GC.ObjType.BUFFET:            drawBuffet     (ctx); return;
    case GC.ObjType.SPORTSBOOK:        drawSportsbook (ctx); return;
    default:                                                  return;
  }
}
