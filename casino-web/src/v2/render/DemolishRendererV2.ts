// DemolishRendererV2.ts — red overlay on placed object footprints
// while demolish mode is active. Hovered object gets a stronger fill
// and an outline.
//
// Pure painter. No state mutation. Hit-testing + click commit lives in
// InputControllerV2.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from './ProjectionV2';
import { GHOST_BAD } from './PaletteV2';

export function drawDemolish(
  g: Phaser.GameObjects.Graphics,
  placedObjs: readonly GC.PlacedObj[],
  hoveredObjId: string | null,
  baseX: number, baseY: number, ts: number,
): void {
  if (placedObjs.length === 0) return;

  for (const obj of placedObjs) {
    const quad = Proj.footprintQuad(obj.col, obj.row, obj.w, obj.h, ts)
      .map(p => ({ x: p.x + baseX, y: p.y + baseY }));
    const isHover = obj.id === hoveredObjId;
    g.fillStyle(GHOST_BAD, isHover ? 0.55 : 0.30);
    g.fillPoints(quad, true);
    if (isHover) {
      g.lineStyle(2, GHOST_BAD, 1);
      g.strokePoints(quad, true);
      g.lineStyle(0, 0, 0);
    }
  }
}
