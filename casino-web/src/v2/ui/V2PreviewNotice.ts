// V2PreviewNotice.ts — temporary V2-only banner explaining that the new
// renderer is visual-preview-only and the player should build in V1.
//
// Mounts as a plain DOM overlay on #ui-root (fallback document.body) so
// it sits above the Phaser canvas without depending on any Phaser layer.
// Removed entirely once V2 grows real placement input (Phase 7) — at
// that point delete this file and its import from PresentationSceneV2.
//
// No gameState access. No Phaser imports. The "Open V1" link rewrites
// the renderer query parameter and reloads via window.location.

const NOTICE_PRIMARY   = 'Presentation V2 preview';
const NOTICE_SECONDARY = 'UI shell and final polish still in progress.';

export class V2PreviewNotice {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'v2-preview-notice interactive';
    this.container.style.cssText = [
      'position: absolute',
      'top: 72px',                                  // sits below V1 TopHUD (~56 px) with breathing room
      'left: 50%',
      'transform: translateX(-50%)',
      'max-width: 520px',
      'padding: 10px 14px',
      'background: rgba(16, 16, 22, 0.88)',
      'border: 1px solid #a07820',                  // PaletteV2.BRASS
      'border-radius: 6px',
      'color: #e8c462',                             // PaletteV2.UI_GOLD
      'font: 12px/1.4 monospace',
      'text-align: center',
      'z-index: 60',
      'pointer-events: auto',
      'user-select: none',
      'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4)',
    ].join(';');

    const primary = document.createElement('div');
    primary.textContent  = NOTICE_PRIMARY;
    primary.style.cssText = 'font-size: 13px; font-weight: 600;';
    this.container.appendChild(primary);

    const secondary = document.createElement('div');
    secondary.textContent = NOTICE_SECONDARY;
    secondary.style.cssText = 'margin-top: 4px; color: #8a6a2e;';  // PaletteV2.UI_GOLD_DIM
    this.container.appendChild(secondary);

    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.textContent = 'Open V1';
    btn.title       = 'Switch to the stable V1 renderer';
    btn.style.cssText = [
      'margin-top: 8px',
      'padding: 4px 12px',
      'background: rgba(60, 40, 22, 0.85)',
      'border: 1px solid #a07820',
      'border-radius: 4px',
      'color: #e8c462',
      'font: 600 12px monospace',
      'cursor: pointer',
      'pointer-events: auto',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(90, 60, 28, 0.92)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(60, 40, 22, 0.85)';
    });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _openV1();
    });
    this.container.appendChild(btn);

    const parent = document.getElementById('ui-root') ?? document.body;
    parent.appendChild(this.container);
  }

  destroy(): void {
    this.container.remove();
  }
}

// Rewrite the current URL with renderer=v1 and navigate. Preserves the
// path, hash, and other query parameters; replaces an existing renderer
// param or adds one. Triggers a full page reload so the Phaser scene
// list switches cleanly.
function _openV1(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set('renderer', 'v1');
    const target = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.location.assign(target);
  } catch {
    // Fallback for environments without window.location (shouldn't happen
    // in a browser, but keeps the constructor safe-by-default).
  }
}
