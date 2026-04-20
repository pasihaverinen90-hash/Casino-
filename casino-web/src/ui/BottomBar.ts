// BottomBar.ts — bottom action bar: Build | Hotel | Stats | Day ▶
import { gameState } from '../state/GameState';

type PanelId = 'build' | 'hotel' | 'stats' | '';

export interface BottomBarCallbacks {
  onBuild   : () => void;
  onHotel   : () => void;
  onStats   : () => void;
  onCloseAll: () => void;
}

export class BottomBar {
  private active     : PanelId = '';
  private btnBuild   : HTMLButtonElement;
  private btnHotel   : HTMLButtonElement;
  private btnStats   : HTMLButtonElement;
  private _callbacks : BottomBarCallbacks;

  constructor(parent: HTMLElement, cb: BottomBarCallbacks) {
    this._callbacks = cb;
    const el = document.createElement('div');
    el.className = 'bottom-bar interactive';

    this.btnBuild = btn('🔨 Build', 'bottom-btn', 'B');
    this.btnHotel = btn('🏨 Hotel', 'bottom-btn', 'H');
    this.btnStats = btn('📊 Stats', 'bottom-btn', 'S');
    const btnDay  = btn('▶ Day',   'bottom-btn day-btn', 'Space');

    this.btnBuild.onclick = () => this._toggle('build', cb.onBuild,    cb.onCloseAll);
    this.btnHotel.onclick = () => this._toggle('hotel', cb.onHotel,    cb.onCloseAll);
    this.btnStats.onclick = () => this._toggle('stats', cb.onStats,    cb.onCloseAll);
    btnDay.onclick        = () => { this.closeAll(cb.onCloseAll); gameState.advanceDay(); };

    el.append(this.btnBuild, this.btnHotel, this.btnStats, btnDay);
    parent.appendChild(el);
  }

  // Simulate pressing a named button (used by keyboard shortcuts in main.ts)
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
}

function btn(text: string, cls: string, shortcut: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className   = cls;
  b.textContent = text;
  b.title       = `${text}  [${shortcut}]`;
  return b;
}
