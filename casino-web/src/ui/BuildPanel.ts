// BuildPanel.ts — slide-up build menu.
import * as GC from '../logic/GameConstants';
import { gameState }  from '../state/GameState';
import { uiBus }      from '../events/UIBus';
import { paintThumb } from '../game/ObjectArt';

// Order is purely UI presentation: attractions first, then services.
const OBJ_TYPES = [
  GC.ObjType.SLOT_MACHINE,
  GC.ObjType.SMALL_TABLE,
  GC.ObjType.LARGE_TABLE,
  GC.ObjType.CASHIER,
  GC.ObjType.WC,
  GC.ObjType.BAR,
];

const THUMB_PX = 56;

export class BuildPanel {
  private el       : HTMLElement;
  private itemGrid : HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel hidden interactive';
    this.el.style.height = '360px';

    // ── Title row ──────────────────────────────────────────────────────────
    // P3B UX: demolish has moved out to the bottom bar so it can run with
    // every panel closed. The build panel now only opens placements.
    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';

    const title = document.createElement('h3');
    title.textContent = 'BUILD';

    const btnClose = document.createElement('button');
    btnClose.className   = 'panel-close';
    btnClose.textContent = '✕';
    btnClose.onclick     = () => this.close();

    titleRow.append(title, btnClose);

    // ── Scroll area ────────────────────────────────────────────────────────
    const scroll = document.createElement('div');
    scroll.className = 'panel-scroll';

    this.itemGrid = document.createElement('div');
    this.itemGrid.className = 'build-grid';
    scroll.appendChild(this.itemGrid);

    this.el.append(titleRow, scroll);
    parent.appendChild(this.el);

    this._buildButtons();

    gameState.on('state_changed', () => this._refreshButtons());

    // Hide the panel during placement; reopen it when the user cancels.
    uiBus.on('placement_confirmed', () => this.close());
    uiBus.on('placement_cancelled', () => this.open());
  }

  open(): void {
    this._refreshButtons();
    this.el.classList.remove('hidden');
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildButtons(): void {
    this.itemGrid.innerHTML = '';
    for (const t of OBJ_TYPES) {
      const def = GC.getDef(t);
      const b   = document.createElement('button');
      b.className            = 'build-item-btn';
      b.dataset['type']      = String(t);
      b.onclick              = () => this._onItemClick(t, def);

      // Thumbnail canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'build-thumb';
      canvas.width  = THUMB_PX;
      canvas.height = THUMB_PX;
      const ctx = canvas.getContext('2d');
      if (ctx) paintThumb(ctx, t, THUMB_PX, THUMB_PX);
      b.appendChild(canvas);

      // Label + cost lines (text node held in a <span> we'll update on refresh)
      const meta = document.createElement('span');
      meta.className = 'build-meta';
      b.appendChild(meta);

      this.itemGrid.appendChild(b);
    }
    this._refreshButtons();
  }

  private _refreshButtons(): void {
    const gs = gameState;
    for (const b of Array.from(this.itemGrid.children) as HTMLButtonElement[]) {
      const t   = Number(b.dataset['type']) as GC.ObjType;
      const def = GC.getDef(t);
      const unaffordable = gs.cash < def.cost;
      const atLimit      = t === GC.ObjType.BAR && gs.barExists;

      b.disabled = unaffordable || atLimit;

      const meta = b.querySelector('.build-meta') as HTMLElement | null;
      if (meta) {
        if (atLimit) {
          meta.textContent = `${def.label}\nAlready built`;
        } else {
          meta.textContent = `${def.label}\n${_sizeLabel(def)}\n${def.cost} 💰`;
        }
      }
    }
  }

  private _onItemClick(t: GC.ObjType, def: GC.ObjDef): void {
    if (def.variants.length > 0) {
      this._showVariantPicker(t, def.variants);
    } else {
      uiBus.emit('start_placement', { type: t, variant: '' });
      // Panel stays open so user can see demolish; grid mode is active
      this.el.classList.add('hidden'); // hide panel while placing
    }
  }

  private _showVariantPicker(t: GC.ObjType, variants: string[]): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay interactive';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const title = document.createElement('div');
    title.className   = 'modal-title';
    title.textContent = 'Choose table type';
    card.appendChild(title);

    for (const v of variants) {
      const b = document.createElement('button');
      b.className   = 'modal-btn';
      b.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      b.onclick = () => {
        overlay.remove();
        uiBus.emit('start_placement', { type: t, variant: v });
        this.el.classList.add('hidden');
      };
      card.appendChild(b);
    }

    const cancel = document.createElement('button');
    cancel.className   = 'modal-btn';
    cancel.textContent = 'Cancel';
    cancel.style.color = '#888';
    cancel.onclick     = () => overlay.remove();
    card.appendChild(cancel);

    overlay.appendChild(card);
    this.el.parentElement!.appendChild(overlay);
  }

}

function _sizeLabel(def: GC.ObjDef): string {
  return def.is_wall ? `${def.fw}×1 wall` : `${def.fw}×${def.fh}`;
}
