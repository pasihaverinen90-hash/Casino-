// SelectionRendererV2.ts — subtle gold outline around the hovered or
// selected object footprint. Used outside demolish mode for object
// hover feedback. Selection drives no UI yet; the outline is purely a
// visual hint.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import { UI_GOLD } from './PaletteV2';

export function drawSelection(
  g: Phaser.GameObjects.Graphics,
  obj: GC.PlacedObj | null,
  baseX: number, baseY: number, ts: number,
): void {
  if (!obj) return;
  const quad = Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts)
    .map(p => ({ x: p.x + baseX, y: p.y + baseY }));
  g.lineStyle(2, UI_GOLD, 0.95);
  g.strokePoints(quad, true);
  g.lineStyle(0, 0, 0);
}
