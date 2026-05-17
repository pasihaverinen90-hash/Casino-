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
import { uiBus } from '../../events/UIBus';
import { BG_DARK, UI_GOLD_DIM } from '../render/PaletteV2';
import { drawFloor } from '../render/FloorRendererV2';
import { drawWalls } from '../render/WallRendererV2';
import { drawObjects } from '../render/ObjectRendererV2';
import { CameraControllerV2 } from './CameraControllerV2';
import { ZoomControlsV2 } from '../ui/ZoomControlsV2';
import { V2PreviewNotice } from '../ui/V2PreviewNotice';

export class PresentationSceneV2 extends Phaser.Scene {
  private gfxFloor!    : Phaser.GameObjects.Graphics;
  private gfxWalls!    : Phaser.GameObjects.Graphics;
  private gfxObjects!  : Phaser.GameObjects.Graphics;
  private camera!      : CameraControllerV2;
  private debugLabel!  : Phaser.GameObjects.Text;
  private zoomControls?: ZoomControlsV2;
  private previewNotice?: V2PreviewNotice;
  // Bound handler kept so we can uiBus.off() on shutdown without leaking
  // listeners across renderer swaps.
  private _onStartPlacement = (): void => {
    // V2 has no placement input yet (Phase 4.1 guard). Toast the player
    // and emit placement_cancelled so BuildPanel clears its highlight —
    // otherwise a clicked item stays selected forever in V2.
    gameState.emit(
      'toast_requested',
      'V2 preview does not support building yet. Use V1 to build for now.',
    );
    uiBus.emit('placement_cancelled');
  };

  constructor() {
    super({ key: 'PresentationSceneV2' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DARK);

    // Layer order: floor (depth 0), walls (1), objects (2), debug label
    // and zoom controls above. Walls overpaint the N/W edge wall-tile
    // placeholder fill from FloorRendererV2 — that's the intended hand-off
    // (floor paints WALL_PANEL flat strips at the border; walls overpaint
    // the visible N/W ones with the tall composition; S/E stay as flat).
    // Objects depth-sort internally via ObjectRendererV2 — within the
    // single gfxObjects Graphics, paint order is the depth order.
    this.gfxFloor   = this.add.graphics().setDepth(0);
    this.gfxWalls   = this.add.graphics().setDepth(1);
    this.gfxObjects = this.add.graphics().setDepth(2);

    this.camera = new CameraControllerV2(this, () => this._redraw());

    // Dev label — small, top-left, semi-transparent so it doesn't compete
    // with the floor. Removed when V2 UI lands.
    this.debugLabel = this.add.text(8, 4, 'Presentation V2 · Floor + Walls', {
      fontFamily: 'monospace',
      fontSize  : '11px',
      color     : _hex(UI_GOLD_DIM),
    }).setDepth(100).setAlpha(0.7);

    // V2-only zoom buttons (DOM overlay, bottom-right). Mounted only in
    // this scene so V1 stays unchanged. _redraw() refreshes their
    // disabled/grey state after every camera change.
    this.zoomControls = new ZoomControlsV2(this.camera);

    // V2-only preview notice (DOM overlay, top-centre). Temporary guard
    // while V2 lacks placement input — delete this and its file in
    // Phase 7 once V2 InputControllerV2 lands.
    this.previewNotice = new V2PreviewNotice();

    // Intercept start_placement so a BuildPanel click in V2 produces a
    // clear toast instead of silent nothingness. Emitting placement_cancelled
    // clears the BuildPanel highlight via its existing subscription.
    uiBus.on('start_placement', this._onStartPlacement);

    gameState.on('state_changed', () => this._redraw());
    this.scale.on('resize', () => {
      this.camera.onResize();
      this._redraw();
    });

    // Tear down DOM + native listeners when the scene shuts down so a
    // re-boot (e.g. tab refresh into different renderer) doesn't leak.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.camera.destroy();
      this.zoomControls?.destroy();
      this.zoomControls = undefined;
      this.previewNotice?.destroy();
      this.previewNotice = undefined;
      uiBus.off('start_placement', this._onStartPlacement);
    });

    this._redraw();
  }

  private _redraw(): void {
    this.gfxFloor.clear();
    this.gfxWalls.clear();
    this.gfxObjects.clear();
    drawFloor(
      this.gfxFloor,
      gameState.tiles,
      this.camera.offsetX,
      this.camera.offsetY,
      this.camera.tileSize,
    );
    drawWalls(
      this.gfxWalls,
      this.camera.offsetX,
      this.camera.offsetY,
      this.camera.tileSize,
    );
    drawObjects(
      this.gfxObjects,
      gameState.placedObjs,
      gameState.functionalIds,
      gameState.tiles,
      this.camera.offsetX,
      this.camera.offsetY,
      this.camera.tileSize,
    );
    // Refresh zoom-button disabled state after every camera change. Cheap
    // (two style writes), no need to skip when no zoom change happened.
    this.zoomControls?.refresh();
  }
}

// 0xRRGGBB → '#rrggbb' for Phaser Text style.
function _hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
