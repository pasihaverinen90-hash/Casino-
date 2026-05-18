// ZoomControlsV2.ts — V2 view (−/+) buttons that live inside TopHUDV2.
//
// Phase 8E.3 moved these out of a floating bottom-right overlay and into
// the TopHUDV2 "View" slot next to the speed controls. Layout is now
// inline (no absolute positioning) — the buttons share the same visual
// language as the speed buttons so the HUD reads as a single row of
// segmented controls: clock · view · speed.
//
// Ownership stays with PresentationSceneV2 because the buttons need a
// CameraControllerV2 reference (zoom math + canZoomIn/Out). The scene
// resolves the slot element by id at create-time and passes it in.
//
// Lifecycle:
//   constructor → builds buttons, appends to `parent`, wires clicks,
//     sets initial enabled state.
//   refresh()   → re-reads canZoomIn/Out and updates the disabled state.
//   destroy()   → removes the buttons from the slot.
import type { CameraControllerV2 } from '../scene/CameraControllerV2';

export class ZoomControlsV2 {
  private camera   : CameraControllerV2;
  private container: HTMLElement;
  private btnOut   : HTMLButtonElement;
  private btnIn    : HTMLButtonElement;

  constructor(camera: CameraControllerV2, parent: HTMLElement) {
    this.camera    = camera;
    this.container = document.createElement('div');
    this.container.className = 'v2-zoom-controls interactive';

    this.btnOut = this._buildBtn('−', 'Zoom out');
    this.btnIn  = this._buildBtn('+', 'Zoom in');

    this.btnOut.addEventListener('click', e => {
      e.stopPropagation();
      this.camera.zoomOut();
      this.refresh();
    });
    this.btnIn.addEventListener('click', e => {
      e.stopPropagation();
      this.camera.zoomIn();
      this.refresh();
    });

    this.container.append(this.btnOut, this.btnIn);
    parent.appendChild(this.container);

    this.refresh();
  }

  refresh(): void {
    this.btnOut.disabled = !this.camera.canZoomOut();
    this.btnIn .disabled = !this.camera.canZoomIn();
  }

  destroy(): void {
    this.container.remove();
  }

  private _buildBtn(label: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'v2-view-btn';
    btn.textContent = label;
    btn.title       = title;
    btn.setAttribute('aria-label', title);
    return btn;
  }
}
