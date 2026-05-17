// RecipeContext.ts — shared input shape for V2 object recipes.
//
// Declared in a small standalone file so recipe modules don't have to
// import from ObjectRendererV2 (which would create a cycle once the
// dispatcher imports the recipes back).
//
// Phase 5: added `tiles` so wall-service recipes can call
// PlacementValidator.detectWallDir(...) to find which visible wall they
// attach to. Tiles are read-only — recipes never mutate them.
import Phaser from 'phaser';
import * as GC from '../../../logic/GameConstants';

export interface RecipeContext {
  g           : Phaser.GameObjects.Graphics;
  obj         : GC.PlacedObj;
  tiles       : readonly GC.Tile[];
  baseX       : number;
  baseY       : number;
  ts          : number;
  // 1.0 when functional, 0.45 when inert. Recipes multiply every fillStyle
  // / strokeStyle alpha by this so a dim object reads correctly without
  // recipes having to track functional state per-paint.
  alpha       : number;
  isFunctional: boolean;
}
