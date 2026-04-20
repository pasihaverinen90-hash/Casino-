// HotelPanel.ts — room purchases and quality upgrades.
import { gameState } from '../state/GameState';

const ROOM_OPTIONS = [
  { rooms: 2, cost: 1000, label: '+2 rooms' },
  { rooms: 4, cost: 1800, label: '+4 rooms' },
  { rooms: 8, cost: 3200, label: '+8 rooms' },
];
const UPGRADE_COSTS = [0, 2000, 4000];

export class HotelPanel {
  private el         : HTMLElement;
  private lblRooms   : HTMLElement;
  private lblQuality : HTMLElement;
  private lblBooked  : HTMLElement;
  private lblIncome  : HTMLElement;
  private roomBtns   : HTMLButtonElement[] = [];
  private btnUpgrade : HTMLButtonElement;
  private lblUpgrade : HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel hidden interactive';
    this.el.style.height = '400px';

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';
    const title = document.createElement('h3');
    title.textContent = 'HOTEL';
    const btnClose = mkClose(() => this.close());
    titleRow.append(title, btnClose);

    // Scroll
    const scroll = document.createElement('div');
    scroll.className = 'panel-scroll';

    // Info section
    const info = document.createElement('div');
    info.className = 'hotel-info';
    this.lblRooms   = info.appendChild(mkP(''));
    this.lblQuality = info.appendChild(mkP(''));
    this.lblBooked  = info.appendChild(mkP(''));
    this.lblIncome  = info.appendChild(mkP(''));
    scroll.appendChild(info);

    // Rooms section
    scroll.appendChild(sectionLabel('ADD ROOMS'));
    for (const opt of ROOM_OPTIONS) {
      const b = document.createElement('button');
      b.className = 'hotel-btn';
      b.onclick   = () => gameState.buyRooms(opt.rooms, opt.cost);
      this.roomBtns.push(b);
      scroll.appendChild(b);
    }

    // Quality section
    const sep = document.createElement('hr');
    sep.style.cssText = 'border-color:#2a2f3f;margin:8px 0';
    scroll.appendChild(sep);
    scroll.appendChild(sectionLabel('UPGRADE QUALITY'));

    this.btnUpgrade = document.createElement('button');
    this.btnUpgrade.className = 'hotel-btn';
    this.btnUpgrade.onclick   = () => gameState.upgradeQuality();
    scroll.appendChild(this.btnUpgrade);

    this.lblUpgrade = document.createElement('p');
    this.lblUpgrade.style.cssText = 'color:#888;font-size:12px;margin:4px 0 0';
    scroll.appendChild(this.lblUpgrade);

    this.el.append(titleRow, scroll);
    parent.appendChild(this.el);

    gameState.on('state_changed', () => { if (!this.el.classList.contains('hidden')) this._refresh(); });
  }

  open(): void { this._refresh(); this.el.classList.remove('hidden'); }
  close(): void { this.el.classList.add('hidden'); }

  private _refresh(): void {
    const gs = gameState;
    this.lblRooms.textContent   = `Rooms: ${gs.roomCount}`;
    this.lblQuality.textContent = `Quality: ${stars(gs.qualityLevel)} (Level ${gs.qualityLevel})`;
    this.lblBooked.textContent  =
      `Booked: ${gs.bookedRooms} / ${gs.roomCount}  (${Math.round(gs.occupancyRate * 100)}%)`;
    this.lblIncome.textContent  = `Hotel income: ~${gs.bookedRooms * 25} 💰/day`;

    ROOM_OPTIONS.forEach((opt, i) => {
      const b = this.roomBtns[i];
      b.textContent = `${opt.label} — ${opt.cost} 💰`;
      b.disabled    = gs.cash < opt.cost;
    });

    if (gs.qualityLevel >= 3) {
      this.btnUpgrade.textContent = 'Maximum quality reached';
      this.btnUpgrade.disabled    = true;
      this.lblUpgrade.textContent = '';
    } else {
      const cost = UPGRADE_COSTS[gs.qualityLevel];
      this.btnUpgrade.textContent = `Upgrade to Level ${gs.qualityLevel + 1} — ${cost} 💰`;
      this.btnUpgrade.disabled    = gs.cash < cost;
      this.lblUpgrade.textContent = 'Adds +0.25 to Resort Rating';
    }
  }
}

function stars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(3 - level);
}
function mkClose(cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'panel-close'; b.textContent = '✕'; b.onclick = cb;
  return b;
}
function mkP(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.margin = '2px 0'; p.textContent = text;
  return p;
}
function sectionLabel(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'section-label'; d.textContent = text;
  return d;
}
