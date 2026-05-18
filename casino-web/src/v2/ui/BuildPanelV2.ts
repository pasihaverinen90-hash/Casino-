// BuildPanelV2.ts — V2 premium Build sidebar.
//
// Behaviour mirrors V1 BuildPanel verbatim (same items, same ordering,
// same lock / affordability / variant rules, same uiBus events):
//   • Categories derived from ObjDef.category
//   • Lock state: !gameState.isUnlocked(t) → 🔒 + goal-unlock hint
//   • Bar at-limit + unaffordable both disable the card
//   • Click handler emits uiBus 'start_placement' with the V1 payload
//   • Selection highlight tracks placement_confirmed / cancelled / exit
//
// Visually a left-side glass panel with a 2×2 category grid above a
// scrollable item list. All styling lives in styleV2.css under
// .v2-build-* class selectors.
//
// Public surface matches V1 BuildPanel so main.ts can swap between
// renderers without renaming anything in the wiring code.
import * as GC from '../../logic/GameConstants';
import { gameState } from '../../state/GameState';
import { uiBus } from '../../events/UIBus';
import { paintThumb } from '../../game/ObjectArt';

interface BuildCategoryV2 {
  id    : GC.BuildCategoryId;
  label : string;
  icon  : string;
}

// Same display ordering V1 BuildPanel uses.
const CATEGORIES: BuildCategoryV2[] = [
  { id: 'slots',    label: 'Slots',        icon: '🎰' },
  { id: 'tables',   label: 'Tables',       icon: '🎲' },
  { id: 'services', label: 'Services',     icon: '🛎' },
  { id: 'food',     label: 'Food & Drink', icon: '🍷' },
];

// Same display order V1 uses inside each category.
const ITEM_TYPES: GC.ObjType[] = [
  GC.ObjType.SLOT_MACHINE,
  GC.ObjType.SMALL_TABLE,
  GC.ObjType.LARGE_TABLE,
  GC.ObjType.KENO_LOUNGE,
  GC.ObjType.HIGH_STAKES_TABLE,
  GC.ObjType.WC,
  GC.ObjType.CASHIER,
  GC.ObjType.ATM,
  GC.ObjType.SPORTSBOOK,
  GC.ObjType.BAR,
  GC.ObjType.BUFFET,
];

// Items grouped per category, preserving the ITEM_TYPES order.
const ITEMS_BY_CATEGORY: Record<GC.BuildCategoryId, GC.ObjType[]> = (() => {
  const out: Record<GC.BuildCategoryId, GC.ObjType[]> = {
    slots: [], tables: [], services: [], food: [],
  };
  for (const t of ITEM_TYPES) out[GC.getDef(t).category].push(t);
  return out;
})();

const THUMB_PX = 48;

export class BuildPanelV2 {
  private el          : HTMLElement;
  private categoriesEl: HTMLElement;
  private listEl      : HTMLElement;
  private overlayHost : HTMLElement;
  private activeCat   : GC.BuildCategoryId = 'slots';
  private selectedType: GC.ObjType | null  = null;

  constructor(parent: HTMLElement, onCloseClick: () => void) {
    this.overlayHost = parent;

    this.el = document.createElement('aside');
    this.el.className = 'v2-build-panel hidden interactive';

    // ── Header ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'v2-build-header';

    const title = document.createElement('h3');
    title.className   = 'v2-build-title';
    title.textContent = 'BUILD';

    const btnClose = document.createElement('button');
    btnClose.className   = 'v2-build-close';
    btnClose.type        = 'button';
    btnClose.textContent = '×';
    btnClose.title       = 'Close';
    // Route through the host callback (bottomBar.closeAll(_closeAll))
    // so the BottomBarV2 Build button highlight stays in sync, the V2
    // scene exits placement, and other panels close — same flow as V1.
    btnClose.onclick = () => onCloseClick();

    header.append(title, btnClose);

    // ── Category grid (2×2) ─────────────────────────────────────────────
    this.categoriesEl = document.createElement('div');
    this.categoriesEl.className = 'v2-build-categories';

    // ── Item list ───────────────────────────────────────────────────────
    this.listEl = document.createElement('div');
    this.listEl.className = 'v2-build-list';

    this.el.append(header, this.categoriesEl, this.listEl);
    parent.appendChild(this.el);

    this._buildCategoryGrid();
    this._renderList();

    // gameState 'state_changed' fires after every place/demolish/cash
    // drip → refresh affordability + lock states. 'goal_completed' is
    // technically subsumed by state_changed but listening explicitly
    // documents the unlock → re-render relationship.
    gameState.on('state_changed', () => this._refreshAffordability());
    gameState.on('goal_completed', () => this._refreshAffordability());

    // Selection highlight clears whenever the scene exits placement
    // for any reason (commit / cancel / X button / Esc / demolish).
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

  // ── Private ─────────────────────────────────────────────────────────────

  private _buildCategoryGrid(): void {
    this.categoriesEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.className     = 'v2-build-category';
      b.type          = 'button';
      b.dataset['id'] = cat.id;

      const icon = document.createElement('span');
      icon.className   = 'v2-build-category-icon';
      icon.textContent = cat.icon;

      const label = document.createElement('span');
      label.className   = 'v2-build-category-label';
      label.textContent = cat.label;

      b.append(icon, label);

      b.onclick = () => {
        if (this.activeCat === cat.id) return;
        this.activeCat = cat.id;
        this._renderList();
        this._refreshCategoryHighlight();
      };

      this.categoriesEl.appendChild(b);
    }
    this._refreshCategoryHighlight();
  }

  private _refreshCategoryHighlight(): void {
    for (const c of Array.from(this.categoriesEl.children) as HTMLElement[]) {
      c.classList.toggle('active', c.dataset['id'] === this.activeCat);
    }
  }

  private _renderList(): void {
    this.listEl.innerHTML = '';
    const types = ITEMS_BY_CATEGORY[this.activeCat];
    for (const t of types) this.listEl.appendChild(this._buildCard(t));
    this._refreshAffordability();
    this._refreshSelectionHighlight();
  }

  private _buildCard(t: GC.ObjType): HTMLButtonElement {
    const def = GC.getDef(t);

    const b = document.createElement('button');
    b.className       = 'v2-build-item';
    b.type            = 'button';
    b.dataset['type'] = String(t);
    b.onclick         = () => this._onItemClick(t, def);

    // Thumbnail — reuse V1's paintThumb (Canvas2D, top-down). It reads
    // fine at 48×48 and avoids designing V2 sprites in this phase.
    const thumb = document.createElement('canvas');
    thumb.className = 'v2-build-item-thumb';
    thumb.width  = THUMB_PX;
    thumb.height = THUMB_PX;
    const ctx = thumb.getContext('2d');
    if (ctx) paintThumb(ctx, t, THUMB_PX, THUMB_PX);

    const meta = document.createElement('div');
    meta.className = 'v2-build-item-meta';

    const name = document.createElement('div');
    name.className   = 'v2-build-item-name';
    name.textContent = def.label;

    const sub = document.createElement('div');
    sub.className = 'v2-build-item-sub';

    meta.append(name, sub);
    b.append(thumb, meta);
    return b;
  }

  private _refreshAffordability(): void {
    for (const card of Array.from(this.listEl.children) as HTMLButtonElement[]) {
      const t   = Number(card.dataset['type']) as GC.ObjType;
      const def = GC.getDef(t);
      const locked       = !gameState.isUnlocked(t);
      const unaffordable = gameState.cash < def.cost;
      const atLimit      = t === GC.ObjType.BAR && gameState.barExists;

      // Locked cards stay clickable so the click handler can toast the
      // unlock reason. Unlocked cards disable when unaffordable / at-limit.
      card.disabled = !locked && (unaffordable || atLimit);
      card.classList.toggle('locked', locked);

      const sub = card.querySelector('.v2-build-item-sub') as HTMLElement | null;
      if (sub) {
        if (locked) {
          const i = GC.GOAL_UNLOCKS.indexOf(t);
          sub.textContent = i >= 0
            ? `🔒 Goal ${i + 1} — ${GC.GOAL_LABELS[i]}`
            : '🔒 Locked';
        } else if (atLimit) {
          sub.textContent = 'Already built';
        } else {
          sub.textContent = `${_sizeLabel(def)} · ${def.cost} 💰`;
        }
      }
    }
  }

  private _refreshSelectionHighlight(): void {
    for (const card of Array.from(this.listEl.children) as HTMLButtonElement[]) {
      const t = Number(card.dataset['type']) as GC.ObjType;
      card.classList.toggle('active', this.selectedType === t);
    }
  }

  private _setSelected(t: GC.ObjType | null): void {
    if (this.selectedType === t) return;
    this.selectedType = t;
    this._refreshSelectionHighlight();
  }

  private _onItemClick(t: GC.ObjType, def: GC.ObjDef): void {
    if (!gameState.isUnlocked(t)) {
      const i = GC.GOAL_UNLOCKS.indexOf(t);
      const msg = i >= 0
        ? `Locked. Unlock: Goal ${i + 1} — ${GC.GOAL_LABELS[i]}.`
        : 'This object is locked.';
      gameState.emit('toast_requested', msg);
      return;
    }
    if (def.variants.length > 0) {
      this._showVariantPicker(t, def.variants);
    } else {
      uiBus.emit('start_placement', { type: t, variant: '' });
      this._setSelected(t);
    }
  }

  // Variant picker modal — V2 chrome (.v2-modal-* / .v2-variant-* / .v2-btn-*).
  // Same content shape as V1 BuildPanel._showVariantPicker: same payload,
  // same uiBus emit, same selection-highlight behaviour. Pure CSS swap.
  private _showVariantPicker(t: GC.ObjType, variants: string[]): void {
    const overlay = document.createElement('div');
    overlay.className = 'v2-modal-overlay interactive';

    const card = document.createElement('div');
    card.className = 'v2-modal-card';
    // Click on backdrop closes; click inside card does not bubble out.
    card.onclick = (e) => e.stopPropagation();

    const header = document.createElement('div');
    header.className = 'v2-modal-header';

    const title = document.createElement('div');
    title.className   = 'v2-modal-title';
    title.textContent = 'Choose table type';

    const btnX = document.createElement('button');
    btnX.type        = 'button';
    btnX.className   = 'v2-modal-close';
    btnX.title       = 'Close';
    btnX.textContent = '×';
    btnX.onclick     = () => overlay.remove();

    header.append(title, btnX);
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'v2-variant-grid';

    for (const v of variants) {
      const b = document.createElement('button');
      b.type      = 'button';
      b.className = 'v2-variant-card';

      const nameEl = document.createElement('div');
      nameEl.className   = 'v2-variant-name';
      nameEl.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      b.appendChild(nameEl);

      b.onclick = () => {
        overlay.remove();
        uiBus.emit('start_placement', { type: t, variant: v });
        this._setSelected(t);
      };
      grid.appendChild(b);
    }
    card.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'v2-modal-actions';
    const cancel = document.createElement('button');
    cancel.type        = 'button';
    cancel.className   = 'v2-btn v2-btn-secondary';
    cancel.textContent = 'Cancel';
    cancel.onclick     = () => overlay.remove();
    actions.appendChild(cancel);
    card.appendChild(actions);

    // Backdrop click = cancel. The card's onclick stops propagation so an
    // inside-card click never closes the modal accidentally.
    overlay.onclick = () => overlay.remove();

    overlay.appendChild(card);
    this.overlayHost.appendChild(overlay);
  }
}

function _sizeLabel(def: GC.ObjDef): string {
  return def.is_wall ? `${def.fw}×1 wall` : `${def.fw}×${def.fh}`;
}
