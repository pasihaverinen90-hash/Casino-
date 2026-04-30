// BottomBar.ts — bottom action bar: Build | Hotel | Stats | ⏸ 1× 2× | Save | Menu
import { TimeController, type Speed } from '../state/TimeController';

type PanelId = 'build' | 'hotel' | 'stats' | '';

export interface BottomBarCallbacks {
  onBuild   : () => void;
  onHotel   : () => void;
  onStats   : () => void;
  onSave    : () => void;
  onMenu    : () => void;
  onCloseAll: () => void;
}

export class BottomBar {
  private active     : PanelId = '';
  private btnBuild   : HTMLButtonElement;
  private btnHotel   : HTMLButtonElement;
  private btnStats   : HTMLButtonElement;
  private btnPause   : HTMLButtonElement;
  private btn1x      : HTMLButtonElement;
  private btn2x      : HTMLButtonElement;
  private _time      : TimeController;

  constructor(parent: HTMLElement, time: TimeController, cb: BottomBarCallbacks) {
    this._time = time;

    const el = document.createElement('div');
    el.className = 'bottom-bar interactive';

    this.btnBuild = btn('🔨 Build', 'bottom-btn', 'B');
    this.btnHotel = btn('🏨 Hotel', 'bottom-btn', 'H');
    this.btnStats = btn('📊 Stats', 'bottom-btn', 'S');

    this.btnBuild.onclick = () => this._toggle('build', cb.onBuild,    cb.onCloseAll);
    this.btnHotel.onclick = () => this._toggle('hotel', cb.onHotel,    cb.onCloseAll);
    this.btnStats.onclick = () => this._toggle('stats', cb.onStats,    cb.onCloseAll);

    // Speed segmented control
    const speedGroup = document.createElement('div');
    speedGroup.className = 'speed-group';
    this.btnPause = btn('⏸',  'speed-btn', 'Space');
    this.btn1x    = btn('1×', 'speed-btn', '1');
    this.btn2x    = btn('2×', 'speed-btn', '2');
    this.btnPause.onclick = () => time.setSpeed(0);
    this.btn1x.onclick    = () => time.setSpeed(1);
    this.btn2x.onclick    = () => time.setSpeed(2);
    speedGroup.append(this.btnPause, this.btn1x, this.btn2x);

    const btnSave = btn('💾 Save', 'bottom-btn aux', '');
    btnSave.onclick = () => cb.onSave();
    const btnMenu = btn('🏠 Menu', 'bottom-btn aux', '');
    btnMenu.onclick = () => cb.onMenu();

    el.append(this.btnBuild, this.btnHotel, this.btnStats, speedGroup, btnSave, btnMenu);
    parent.appendChild(el);

    time.onChange = () => this._refreshSpeed();
    this._refreshSpeed();
  }

  pressButton(id: 'build' | 'hotel' | 'stats'): void {
    ({ build: this.btnBuild, hotel: this.btnHotel, stats: this.btnStats }[id]).click();
  }

  closeAll(onCloseAll?: () => void): void {
    this.active = '';
    this._highlight();
    onCloseAll?.();
  }

  private _toggle(id: PanelId, open: () => void, closeAll: () => void): void {
    if (this.active === id) {
      this.closeAll(closeAll);
    } else {
      this.active = id;
      this._highlight();
      open();
    }
  }

  private _highlight(): void {
    this.btnBuild.classList.toggle('active', this.active === 'build');
    this.btnHotel.classList.toggle('active', this.active === 'hotel');
    this.btnStats.classList.toggle('active', this.active === 'stats');
  }

  private _refreshSpeed(): void {
    const s: Speed = this._time.speed;
    this.btnPause.classList.toggle('active', s === 0);
    this.btn1x.classList.toggle   ('active', s === 1);
    this.btn2x.classList.toggle   ('active', s === 2);
  }
}

function btn(text: string, cls: string, shortcut: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className   = cls;
  b.textContent = text;
  b.title       = `${text}  [${shortcut}]`;
  return b;
}
