// BuildPanel.ts — left-side Build sidebar with grouped categories.
//
// Stays open during placement so the player can pick a different item or
// close out without re-opening the menu. Selection highlight tracks the
// active placement; placement events from GridScene clear it.
//
// Category membership is derived from ObjDef.category (Phase A2): adding a
// future object with category: 'food' will automatically slot it into the
// Food & Drink tab once its type is appended to BUILD_ITEM_TYPES below.
import * as GC from '../logic/GameConstants';
import { gameState }  from '../state/GameState';
import { uiBus }      from '../events/UIBus';
import { paintThumb } from '../game/ObjectArt';

interface BuildItem     { type: GC.ObjType; }
interface BuildCategory { id: GC.BuildCategoryId; label: string; items: BuildItem[]; }

// Visible category tabs, in display order. Labels stay here because they
// are UI strings, not object metadata.
const BUILD_CATEGORY_LABELS: Array<{ id: GC.BuildCategoryId; label: string }> = [
  { id: 'slots',    label: 'Slots' },
  { id: 'tables',   label: 'Tables' },
  { id: 'services', label: 'Services' },
  { id: 'food',     label: 'Food & Drink' },
];

// Buildable object types in their preferred display order. Grouping by
// ObjDef.category produces the per-tab item lists below; this order is
// preserved within each tab.
const BUILD_ITEM_TYPES: GC.ObjType[] = [
  GC.ObjType.SLOT_MACHINE,
  GC.ObjType.SMALL_TABLE,
  GC.ObjType.LARGE_TABLE,
  GC.ObjType.WC,
  GC.ObjType.CASHIER,
  GC.ObjType.ATM,
  GC.ObjType.BAR,
];

const BUILD_CATEGORIES: BuildCategory[] = BUILD_CATEGORY_LABELS.map(({ id, label }) => ({
  id,
  label,
  items: BUILD_ITEM_TYPES
    .filter(t => GC.getDef(t).category === id)
    .map(type => ({ type })),
}));

const THUMB_PX = 48;

export class BuildPanel {
  private el            : HTMLElement;
  private tabsEl        : HTMLElement;
  private listEl        : HTMLElement;
  private overlayHost   : HTMLElement;
  private activeCat     : string         = BUILD_CATEGORIES[0].id;
  private selectedType  : GC.ObjType | null = null;

  constructor(parent: HTMLElement, onCloseClick: () => void) {
    this.overlayHost = parent;

    this.el = document.createElement('aside');
    this.el.className = 'build-sidebar hidden interactive';

    // ── Title ──────────────────────────────────────────────────────────
    const titleRow = document.createElement('div');
    titleRow.className = 'build-sidebar-title';

    const title = document.createElement('h3');
    title.textContent = 'BUILD';

    const btnClose = document.createElement('button');
    btnClose.className   = 'panel-close';
    btnClose.textContent = '✕';
    // The X button closes the sidebar AND exits placement. Routing through
    // BottomBar keeps the Build button highlight in sync with reality.
    btnClose.onclick     = () => onCloseClick();

    titleRow.append(title, btnClose);

    // ── Category tabs ──────────────────────────────────────────────────
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'build-tabs';

    // ── Item list ──────────────────────────────────────────────────────
    this.listEl = document.createElement('div');
    this.listEl.className = 'build-list';

    this.el.append(titleRow, this.tabsEl, this.listEl);
    parent.appendChild(this.el);

    this._buildTabs();
    this._renderList();

    gameState.on('state_changed', () => this._refreshAffordability());

    // Selection highlight only applies while a placement is in progress.
    // Clear it whenever GridScene exits placement for any reason.
    uiBus.on('placement_confirmed', () => this._setSelected(null));
    uiBus.on('placement_cancelled', () => this._setSelected(null));
    uiBus.on('exit_placement',      () => this._setSelected(null));
  }

  open(): void {
    this.el.classList.remove('hidden');
    this._refreshAffordability();
  }

  close(): void {
    this.el.classList.add('hidden');
    this._setSelected(null);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildTabs(): void {
    this.tabsEl.innerHTML = '';
    for (const cat of BUILD_CATEGORIES) {
      const t = document.createElement('button');
      t.className       = 'build-tab';
      t.textContent     = cat.label;
      t.dataset['id']   = cat.id;
      t.onclick = () => {
        if (this.activeCat === cat.id) return;
        this.activeCat = cat.id;
        this._renderList();
        this._refreshTabHighlight();
      };
      this.tabsEl.appendChild(t);
    }
    this._refreshTabHighlight();
  }

  private _refreshTabHighlight(): void {
    for (const t of Array.from(this.tabsEl.children) as HTMLElement[]) {
      t.classList.toggle('active', t.dataset['id'] === this.activeCat);
    }
  }

  private _renderList(): void {
    this.listEl.innerHTML = '';
    const cat = BUILD_CATEGORIES.find(c => c.id === this.activeCat);
    if (!cat) return;
    for (const item of cat.items) {
      this.listEl.appendChild(this._buildCard(item.type));
    }
    this._refreshAffordability();
    this._refreshSelectionHighlight();
  }

  private _buildCard(t: GC.ObjType): HTMLButtonElement {
    const def = GC.getDef(t);

    const b = document.createElement('button');
    b.className       = 'build-item-btn';
    b.dataset['type'] = String(t);
    b.onclick         = () => this._onItemClick(t, def);

    const canvas = document.createElement('canvas');
    canvas.className = 'build-thumb';
    canvas.width  = THUMB_PX;
    canvas.height = THUMB_PX;
    const ctx = canvas.getContext('2d');
    if (ctx) paintThumb(ctx, t, THUMB_PX, THUMB_PX);

    const meta = document.createElement('div');
    meta.className = 'build-meta';

    const nameLine = document.createElement('div');
    nameLine.className = 'build-name';
    nameLine.textContent = def.label;

    const subLine = document.createElement('div');
    subLine.className = 'build-sub';

    meta.append(nameLine, subLine);
    b.append(canvas, meta);
    return b;
  }

  private _refreshAffordability(): void {
    const gs = gameState;
    for (const card of Array.from(this.listEl.children) as HTMLButtonElement[]) {
      const t   = Number(card.dataset['type']) as GC.ObjType;
      const def = GC.getDef(t);
      const unaffordable = gs.cash < def.cost;
      const atLimit      = t === GC.ObjType.BAR && gs.barExists;
      card.disabled = unaffordable || atLimit;

      const sub = card.querySelector('.build-sub') as HTMLElement | null;
      if (sub) {
        sub.textContent = atLimit
          ? 'Already built'
          : `${_sizeLabel(def)} · ${def.cost} 💰`;
      }
    }
  }

  private _refreshSelectionHighlight(): void {
    for (const card of Array.from(this.listEl.children) as HTMLButtonElement[]) {
      const t = Number(card.dataset['type']) as GC.ObjType;
      card.classList.toggle('selected', this.selectedType === t);
    }
  }

  private _setSelected(t: GC.ObjType | null): void {
    if (this.selectedType === t) return;
    this.selectedType = t;
    this._refreshSelectionHighlight();
  }

  private _onItemClick(t: GC.ObjType, def: GC.ObjDef): void {
    if (def.variants.length > 0) {
      this._showVariantPicker(t, def.variants);
    } else {
      uiBus.emit('start_placement', { type: t, variant: '' });
      this._setSelected(t);
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
        this._setSelected(t);
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
    this.overlayHost.appendChild(overlay);
  }
}

function _sizeLabel(def: GC.ObjDef): string {
  return def.is_wall ? `${def.fw}×1 wall` : `${def.fw}×${def.fh}`;
}
