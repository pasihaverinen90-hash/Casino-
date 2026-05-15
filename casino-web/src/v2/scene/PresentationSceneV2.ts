// PresentationSceneV2.ts — Phase 1 scaffold scene for the Presentation V2
// renderer.
//
// Boots behind ?renderer=v2 (see state/RendererFlag.ts and main.ts). Paints
// only a dark backdrop and a small "Presentation V2 Scaffold" label so the
// canvas visibly proves V2 is active.
//
// Intentionally NOT implemented yet:
//   • floor / wall / object / guest rendering
//   • placement input or ghost
//   • camera pan/zoom
//   • any gameState subscription
//
// Later phases will replace this body with the real layered renderer. The
// HTML UI (TopHUD, BottomBar, BuildPanel, etc.) still mounts above this
// scene exactly as it does over V1, because UI panels read gameState
// directly and are scene-independent.
import Phaser from 'phaser';
import { BG_DARK, UI_GOLD, UI_GOLD_DIM } from '../render/PaletteV2';

export class PresentationSceneV2 extends Phaser.Scene {
  private titleText!   : Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PresentationSceneV2' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DARK);

    this.titleText = this.add.text(0, 0, 'Presentation V2 Scaffold', {
      fontFamily: 'monospace',
      fontSize  : '22px',
      color     : _hex(UI_GOLD),
    }).setOrigin(0.5).setDepth(1);

    this.subtitleText = this.add.text(0, 0, 'Phase 1 · renderer=v2', {
      fontFamily: 'monospace',
      fontSize  : '13px',
      color     : _hex(UI_GOLD_DIM),
    }).setOrigin(0.5).setDepth(1);

    this._reposition();
    this.scale.on('resize', () => this._reposition());
  }

  // Centre labels on the canvas. HTML UI overlays the top/bottom strips, so
  // we anchor on the geometric centre and accept partial overlap — the label
  // is a developer cue, not a final layout.
  private _reposition(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.titleText.setPosition(w / 2, h / 2 - 14);
    this.subtitleText.setPosition(w / 2, h / 2 + 14);
  }
}

// 0xRRGGBB → '#rrggbb' for Phaser Text style (which expects a CSS string).
function _hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
