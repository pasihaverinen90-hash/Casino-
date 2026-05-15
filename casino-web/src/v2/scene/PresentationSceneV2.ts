// PresentationSceneV2.ts — Presentation V2 scene.
//
// Phase 2 scope:
//   • dark backdrop
//   • projected casino floor via FloorRendererV2
//   • pan + zoom camera via CameraControllerV2
//   • small dev label so it's obvious V2 is active
//
// Still intentionally NOT implemented:
//   • walls (Phase 3) — WALL tiles paint as a flat dark placeholder for now
//   • objects, guests, placement, ghost, demolish, V2 UI
//
// Subscribes to gameState 'state_changed' so the floor repaints if tiles
// ever change (today they don't; the hook is there for correctness as
// future phases lean on it). Pan/zoom triggers repaint via the camera's
// onChange callback — no per-frame redraw, no animation.
import Phaser from 'phaser';
import { gameState } from '../../state/GameState';
import { BG_DARK, UI_GOLD_DIM } from '../render/PaletteV2';
import { drawFloor } from '../render/FloorRendererV2';
import { CameraControllerV2 } from './CameraControllerV2';

export class PresentationSceneV2 extends Phaser.Scene {
  private gfxFloor!  : Phaser.GameObjects.Graphics;
  private camera!    : CameraControllerV2;
  private debugLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PresentationSceneV2' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DARK);

    this.gfxFloor = this.add.graphics();

    this.camera = new CameraControllerV2(this, () => this._redraw());

    // Dev label — small, top-left, semi-transparent so it doesn't compete
    // with the floor. Removed when V2 UI lands.
    this.debugLabel = this.add.text(8, 4, 'Presentation V2 · Floor + Camera', {
      fontFamily: 'monospace',
      fontSize  : '11px',
      color     : _hex(UI_GOLD_DIM),
    }).setDepth(100).setAlpha(0.7);

    gameState.on('state_changed', () => this._redraw());
    this.scale.on('resize', () => {
      this.camera.onResize();
      this._redraw();
    });

    this._redraw();
  }

  private _redraw(): void {
    this.gfxFloor.clear();
    drawFloor(
      this.gfxFloor,
      gameState.tiles,
      this.camera.offsetX,
      this.camera.offsetY,
      this.camera.tileSize,
    );
  }
}

// 0xRRGGBB → '#rrggbb' for Phaser Text style.
function _hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
