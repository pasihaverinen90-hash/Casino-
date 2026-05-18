// ZoomControlsV2.ts — small V2-only DOM zoom buttons.
//
// Two buttons in the bottom-right corner — magnifying-glass with minus
// (zoom out) and plus (zoom in). They mount as plain HTML so they don't
// pan with the floor and don't need to be in any Phaser display list.
//
// Lifecycle:
//   constructor → builds the DOM, appends to #ui-root (or document.body
//     as a fallback), wires click handlers, sets initial disabled state.
//   refresh()   → re-reads canZoomIn/Out from the camera and updates
//     opacity, cursor, and aria state. Call after any camera change.
//   destroy()   → removes the DOM. Safe to call multiple times.
//
// Phase 3.2 keeps this minimal — no V2 styleV2.css yet, all styling is
// inline so the file is self-contained. The full V2 UI shell (TopHUDV2,
// BottomBarV2, BuildPanelV2) lands in Phase 8+ and can move these
// buttons into a styled overlay then.
import type { CameraControllerV2 } from '../scene/CameraControllerV2';

// Phase 8E.2: anchored bottom-right above the V2 bottom nav. The buttons
// hide entirely whenever any of the large V2 panels (Build / Hotel /
// Stats) is open — main.ts toggles a `v2-panel-open` class on uiRoot,
// and the matching CSS rule sets `display: none` on this container.
// That dodges the per-panel collision math we tried in earlier patches.
const ZOOM_RIGHT_PX  = 24;
const ZOOM_BOTTOM_PX = 96;

export class ZoomControlsV2 {
  private camera   : CameraControllerV2;
  private container: HTMLElement;
  private btnOut   : HTMLButtonElement;
  private btnIn    : HTMLButtonElement;

  constructor(camera: CameraControllerV2) {
    this.camera    = camera;
    this.container = document.createElement('div');
    this.container.className = 'v2-zoom-controls interactive';
    // 'interactive' mirrors the class used by other V1 UI overlays so any
    // pointer-events rules in style.css that whitelist UI overlays apply
    // to V2 controls too. Inline cssText is the source of truth for now.
    this.container.style.cssText = [
      'position: absolute',
      `right: ${ZOOM_RIGHT_PX}px`,
      `bottom: ${ZOOM_BOTTOM_PX}px`,
      'display: flex',
      'gap: 6px',
      'z-index: 50',
      'pointer-events: auto',
      'user-select: none',
    ].join(';');

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

    this.container.appendChild(this.btnOut);
    this.container.appendChild(this.btnIn);

    const parent = document.getElementById('ui-root') ?? document.body;
    parent.appendChild(this.container);

    this.refresh();
  }

  refresh(): void {
    const canOut = this.camera.canZoomOut();
    const canIn  = this.camera.canZoomIn();
    this._setEnabled(this.btnOut, canOut);
    this._setEnabled(this.btnIn,  canIn);
  }

  destroy(): void {
    this.container.remove();
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  private _buildBtn(label: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.textContent = label;
    btn.title       = title;
    btn.setAttribute('aria-label', title);
    btn.style.cssText = [
      'width: 36px',
      'height: 36px',
      'background: rgba(16, 16, 22, 0.85)',
      'border: 1px solid #a07820',     // PaletteV2.BRASS
      'color: #e8c462',                 // PaletteV2.UI_GOLD
      'font: 600 20px/1 monospace',
      'border-radius: 6px',
      'cursor: pointer',
      'padding: 0',
      'transition: background-color 100ms, opacity 100ms',
      'pointer-events: auto',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) btn.style.background = 'rgba(60, 40, 22, 0.92)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(16, 16, 22, 0.85)';
    });
    return btn;
  }

  private _setEnabled(btn: HTMLButtonElement, enabled: boolean): void {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '0.35';
    btn.style.cursor  = enabled ? 'pointer' : 'default';
  }
}
