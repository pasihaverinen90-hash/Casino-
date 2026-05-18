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

// Positioned to the LEFT of SummaryCardV2 so the two don't overlap
// in the bottom-right corner. Keep these in sync with the matching
// .v2-summary-card values in styleV2.css:
//   width: 220px;
//   right: 16px;
const SUMMARY_CARD_WIDTH_PX = 220;
const SUMMARY_CARD_RIGHT_PX = 16;
const SUMMARY_CARD_GAP_PX   = 16;
const ZOOM_RIGHT_PX = SUMMARY_CARD_WIDTH_PX + SUMMARY_CARD_RIGHT_PX + SUMMARY_CARD_GAP_PX;

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
      'bottom: 88px',          // aligns with SummaryCardV2's lower edge; above V1/V2 BottomBar.
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
