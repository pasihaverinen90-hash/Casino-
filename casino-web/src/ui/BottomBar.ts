// BottomBar.ts — bottom action bar:
//   Build | Hotel | Stats | 🗑 Demolish | ⏸ 1× 2× 4× | Save | Menu
//
// Demolish is its own bottom-bar toggle (P3B UX fix). Activating it closes
// the panel toggles, leaves the floor visible, and asks the host to enter
// demolish mode via `onDemolish(true)`. Clicking again — or pressing Esc,
// or opening any other panel — clears it.
import { time, type Speed } from '../state/TimeController';
import { uiBus } from '../events/UIBus';

type PanelId = 'build' | 'hotel' | 'stats' | '';

export interface BottomBarCallbacks {
  onBuild   : () => void;
  onHotel   : () => void;
  onStats   : () => void;
  onDemolish: (active: boolean) => void;
  onSave    : () => void;
  onMenu    : () => void;
  onCloseAll: () => void;
}

export class BottomBar {
  private active      : PanelId = '';
  private demolishing = false;
  private btnBuild    : HTMLButtonElement;
  private btnHotel    : HTMLButtonElement;
  private btnStats    : HTMLButtonElement;
  private btnDemolish : HTMLButtonElement;
  private btnPause    : HTMLButtonElement;
  private btn1x       : HTMLButtonElement;
  private btn2x       : HTMLButtonElement;
  private btn4x       : HTMLButtonElement;

  constructor(parent: HTMLElement, cb: BottomBarCallbacks) {
    const el = document.createElement('div');
    el.className = 'bottom-bar interactive';

    this.btnBuild    = btn('🔨 Build',    'bottom-btn', 'B');
    this.btnHotel    = btn('🏨 Hotel',    'bottom-btn', 'H');
    this.btnStats    = btn('📊 Stats',    'bottom-btn', 'S');
    this.btnDemolish = btn('🗑 Demolish', 'bottom-btn', 'D');

    this.btnBuild.onclick    = () => this._toggle('build', cb.onBuild,    cb.onCloseAll);
    this.btnHotel.onclick    = () => this._toggle('hotel', cb.onHotel,    cb.onCloseAll);
    this.btnStats.onclick    = () => this._toggle('stats', cb.onStats,    cb.onCloseAll);
    this.btnDemolish.onclick = () => this._toggleDemolish(cb.onDemolish);

    // Speed segmented control: pause / 1× / 2× / 4×.
    const speedGroup = document.createElement('div');
    speedGroup.className = 'speed-group';
    this.btnPause = btn('⏸',  'speed-btn', 'Space');
    this.btn1x    = btn('1×', 'speed-btn', '1');
    this.btn2x    = btn('2×', 'speed-btn', '2');
    this.btn4x    = btn('4×', 'speed-btn', '4');
    this.btnPause.onclick = () => time.setSpeed(0);
    this.btn1x.onclick    = () => time.setSpeed(1);
    this.btn2x.onclick    = () => time.setSpeed(2);
    this.btn4x.onclick    = () => time.setSpeed(4);
    speedGroup.append(this.btnPause, this.btn1x, this.btn2x, this.btn4x);

    const btnSave = btn('💾 Save', 'bottom-btn aux', '');
    btnSave.onclick = () => cb.onSave();
    const btnMenu = btn('🏠 Menu', 'bottom-btn aux', '');
    btnMenu.onclick = () => cb.onMenu();

    el.append(
      this.btnBuild, this.btnHotel, this.btnStats, this.btnDemolish,
      speedGroup, btnSave, btnMenu,
    );
    parent.appendChild(el);

    time.on<Speed>('speed', () => this._refreshSpeed());
    this._refreshSpeed();

    // GridScene fires `demolish_cancelled` on Esc; mirror its visual state
    // so the button highlight always matches reality.
    uiBus.on('demolish_cancelled', () => {
      if (!this.demolishing) return;
      this.demolishing = false;
      this._highlight();
    });
  }

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
      // Opening a panel always exits demolish — the panel's open() callback
      // takes care of the GridScene side via uiBus.
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
    // Activating demolish hides any open panel button highlight; the host
    // callback is responsible for closing those panels and exiting placement.
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

  private _refreshSpeed(): void {
    const s: Speed = time.speed;
    this.btnPause.classList.toggle('active', s === 0);
    this.btn1x.classList.toggle   ('active', s === 1);
    this.btn2x.classList.toggle   ('active', s === 2);
    this.btn4x.classList.toggle   ('active', s === 4);
  }
}

function btn(text: string, cls: string, shortcut: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className   = cls;
  b.textContent = text;
  b.title       = shortcut ? `${text}  [${shortcut}]` : text;
  return b;
}
