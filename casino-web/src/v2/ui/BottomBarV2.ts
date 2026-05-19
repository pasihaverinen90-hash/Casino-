// BottomBarV2.ts — premium V2 bottom navigation.
//
// Public methods: pressButton / pressDemolish / closeAll. The keyboard
// shortcut module calls them by name so each shortcut maps to the same
// path as the corresponding button click.
//
// Speed controls live in TopHUDV2, not here. Save and Menu live in this
// bar to keep proximity with the build/demolish actions.
import { uiBus } from '../../events/UIBus';

type PanelId = 'build' | 'hotel' | 'stats' | '';

export interface BottomBarV2Callbacks {
  onBuild   : () => void;
  onHotel   : () => void;
  onStats   : () => void;
  onDemolish: (active: boolean) => void;
  onSave    : () => void;
  onMenu    : () => void;
  onCloseAll: () => void;
}

export class BottomBarV2 {
  private active      : PanelId = '';
  private demolishing = false;
  private btnBuild    : HTMLButtonElement;
  private btnHotel    : HTMLButtonElement;
  private btnStats    : HTMLButtonElement;
  private btnDemolish : HTMLButtonElement;

  constructor(parent: HTMLElement, cb: BottomBarV2Callbacks) {
    const el = document.createElement('div');
    el.className = 'v2-bottom-nav interactive';

    this.btnBuild    = _navBtn('🔨', 'Build',    'B');
    this.btnHotel    = _navBtn('🏨', 'Hotel',    'H');
    this.btnStats    = _navBtn('📊', 'Stats',    'S');
    this.btnDemolish = _navBtn('🗑',  'Demolish', 'D');

    this.btnBuild.onclick    = () => this._toggle('build', cb.onBuild,    cb.onCloseAll);
    this.btnHotel.onclick    = () => this._toggle('hotel', cb.onHotel,    cb.onCloseAll);
    this.btnStats.onclick    = () => this._toggle('stats', cb.onStats,    cb.onCloseAll);
    this.btnDemolish.onclick = () => this._toggleDemolish(cb.onDemolish);

    el.append(this.btnBuild, this.btnHotel, this.btnStats, this.btnDemolish);

    // Aux cluster (Save / Menu) right-aligned via .v2-nav-aux.
    const aux = document.createElement('div');
    aux.className = 'v2-nav-aux';
    const btnSave = _navBtn('💾', 'Save', 'Save');
    const btnMenu = _navBtn('🏠', 'Menu', 'Menu');
    btnSave.onclick = () => cb.onSave();
    btnMenu.onclick = () => cb.onMenu();
    aux.append(btnSave, btnMenu);
    el.appendChild(aux);

    parent.appendChild(el);

    // Mirror demolish-cancelled (Esc from the scene) so the button
    // highlight clears in sync.
    uiBus.on('demolish_cancelled', () => {
      if (!this.demolishing) return;
      this.demolishing = false;
      this._highlight();
    });
  }

  // Public methods — the keyboard shortcut module calls these directly.
  pressButton(id: 'build' | 'hotel' | 'stats'): void {
    ({ build: this.btnBuild, hotel: this.btnHotel, stats: this.btnStats }[id]).click();
  }
  pressDemolish(): void { this.btnDemolish.click(); }
  closeAll(onCloseAll?: () => void): void {
    this.active = '';
    this.demolishing = false;
    this._highlight();
    onCloseAll?.();
  }

  private _toggle(id: PanelId, open: () => void, closeAll: () => void): void {
    if (this.active === id) {
      this.closeAll(closeAll);
    } else {
      this.active = id;
      this.demolishing = false;
      this._highlight();
      open();
    }
  }

  private _toggleDemolish(onDemolish: (active: boolean) => void): void {
    if (this.demolishing) {
      this.demolishing = false;
      this._highlight();
      onDemolish(false);
      return;
    }
    this.active = '';
    this.demolishing = true;
    this._highlight();
    onDemolish(true);
  }

  private _highlight(): void {
    this.btnBuild.classList.toggle   ('active', this.active === 'build');
    this.btnHotel.classList.toggle   ('active', this.active === 'hotel');
    this.btnStats.classList.toggle   ('active', this.active === 'stats');
    this.btnDemolish.classList.toggle('active', this.demolishing);
  }
}

function _navBtn(icon: string, label: string, shortcut: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'v2-nav-btn';
  b.type      = 'button';
  b.title     = shortcut ? `${label}  [${shortcut}]` : label;

  const iconEl = document.createElement('span');
  iconEl.className   = 'v2-nav-btn-icon';
  iconEl.textContent = icon;

  const labelEl = document.createElement('span');
  labelEl.className   = 'v2-nav-btn-label';
  labelEl.textContent = label;

  b.append(iconEl, labelEl);
  return b;
}
