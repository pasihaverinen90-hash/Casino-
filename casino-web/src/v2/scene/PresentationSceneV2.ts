// PresentationSceneV2.ts — Presentation V2 scene.
//
// Phase 7: V2 is now functionally interactive. Placement, demolish,
// rotation, hover, and selection are wired via InputControllerV2 which
// consumes the same uiBus event contracts as V1 GridScene. Validation
// goes through PlacementValidator and commit through gameState.tryPlace
// / gameState.demolish — V2 does not duplicate any gameplay rules.
//
// Layer order:
//   0  floor
//   1  walls
//   2  objects
//   3  guests       (per-frame redraw)
//   10 ghost
//   11 demolish
//   12 selection
//   100 debug label
//   DOM zoomControls + previewNotice (overlay)
import Phaser from 'phaser';
import { gameState } from '../../state/GameState';
import { BG_DARK, UI_GOLD_DIM } from '../render/PaletteV2';
import { drawFloor } from '../render/FloorRendererV2';
import { drawWalls } from '../render/WallRendererV2';
import { drawObjects } from '../render/ObjectRendererV2';
import { drawGuests } from '../render/GuestRendererV2';
import { drawGhost } from '../render/GhostRendererV2';
import { drawDemolish } from '../render/DemolishRendererV2';
import { drawSelection } from '../render/SelectionRendererV2';
import { CameraControllerV2 } from './CameraControllerV2';
import { InputControllerV2 } from './InputControllerV2';
import { GuestVisualControllerV2 } from '../guests/GuestVisualControllerV2';
import { ZoomControlsV2 } from '../ui/ZoomControlsV2';

export class PresentationSceneV2 extends Phaser.Scene {
  private gfxFloor!       : Phaser.GameObjects.Graphics;
  private gfxWalls!       : Phaser.GameObjects.Graphics;
  private gfxObjects!     : Phaser.GameObjects.Graphics;
  private gfxGuests!      : Phaser.GameObjects.Graphics;
  private gfxGhost!       : Phaser.GameObjects.Graphics;
  private gfxDemolish!    : Phaser.GameObjects.Graphics;
  private gfxSelection!   : Phaser.GameObjects.Graphics;
  private camera!         : CameraControllerV2;
  private guestController!: GuestVisualControllerV2;
  private inputController!: InputControllerV2;
  private debugLabel!     : Phaser.GameObjects.Text;
  private zoomControls?   : ZoomControlsV2;

  constructor() {
    super({ key: 'PresentationSceneV2' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DARK);

    this.gfxFloor     = this.add.graphics().setDepth(0);
    this.gfxWalls     = this.add.graphics().setDepth(1);
    this.gfxObjects   = this.add.graphics().setDepth(2);
    this.gfxGuests    = this.add.graphics().setDepth(3);
    this.gfxGhost     = this.add.graphics().setDepth(10);
    this.gfxDemolish  = this.add.graphics().setDepth(11);
    this.gfxSelection = this.add.graphics().setDepth(12);

    this.camera          = new CameraControllerV2(this, () => this._redraw());
    this.guestController = new GuestVisualControllerV2();
    // InputControllerV2 owns placement/demolish/hover state. On any
    // change (ghost moved, demolish toggled, hover changed, R pressed)
    // it calls _redrawOverlays so dynamic layers re-paint without
    // redrawing the entire scene.
    this.inputController = new InputControllerV2(
      this, this.camera, this.guestController, () => this._redrawOverlays(),
    );

    this.debugLabel = this.add.text(8, 4, 'Presentation V2', {
      fontFamily: 'monospace',
      fontSize  : '11px',
      color     : _hex(UI_GOLD_DIM),
    }).setDepth(100).setAlpha(0.7);

    this.zoomControls  = new ZoomControlsV2(this.camera);

    gameState.on('state_changed', () => {
      this._redraw();
      this.guestController.refreshTargets();
    });
    this.scale.on('resize', () => {
      this.camera.onResize();
      this._redraw();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputController.destroy();
      this.camera.destroy();
      this.guestController.destroy();
      this.zoomControls?.destroy();
      this.zoomControls = undefined;
    });

    this._redraw();
  }

  // Per-frame Phaser hook. Guests redraw every frame; ghost/demolish/
  // selection layers refresh on input-driven changes via
  // _redrawOverlays so we don't repaint them every frame for no reason.
  update(_time: number, delta: number): void {
    this.guestController.update(delta);
    this.gfxGuests.clear();
    drawGuests(
      this.gfxGuests,
      this.guestController.getGuests(),
      this.camera.offsetX,
      this.camera.offsetY,
      this.camera.tileSize,
    );
  }

  // Full repaint — static layers (floor/walls/objects) + overlay
  // refresh + zoom-button state. Called on camera change, gameState
  // change, and resize.
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
    this._redrawOverlays();
    this.zoomControls?.refresh();
  }

  // Overlay-only refresh — ghost, demolish, selection. Called from the
  // InputControllerV2 onChange callback (pointer moves, R, Esc,
  // start/exit placement, demolish toggle, hover change).
  private _redrawOverlays(): void {
    this.gfxGhost.clear();
    this.gfxDemolish.clear();
    this.gfxSelection.clear();

    if (this.inputController.isDemolishing()) {
      drawDemolish(
        this.gfxDemolish,
        gameState.placedObjs,
        this.inputController.getHoveredObjId(),
        this.camera.offsetX,
        this.camera.offsetY,
        this.camera.tileSize,
      );
    } else {
      drawGhost(
        this.gfxGhost,
        this.inputController.getGhost(),
        gameState.tiles,
        this.camera.offsetX,
        this.camera.offsetY,
        this.camera.tileSize,
      );
      // Plain hover outline when not placing and not demolishing.
      const hoveredId = !this.inputController.getGhost()
        ? this.inputController.getHoveredObjId()
        : null;
      const hovered = hoveredId
        ? gameState.placedObjs.find(o => o.id === hoveredId) ?? null
        : null;
      drawSelection(
        this.gfxSelection,
        hovered,
        this.camera.offsetX,
        this.camera.offsetY,
        this.camera.tileSize,
      );
    }
  }
}

// 0xRRGGBB → '#rrggbb' for Phaser Text style.
function _hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
