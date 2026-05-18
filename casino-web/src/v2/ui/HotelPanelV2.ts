// HotelPanelV2.ts — V2 premium Hotel sidebar.
//
// Mirrors V1 HotelPanel verbatim:
//   • Same stat fields (roomCount, qualityLevel, bookedRooms, occupancyRate,
//     hotel income estimate as bookedRooms * 25 💰/day).
//   • Same ROOM_OPTIONS table (+2/1000, +4/1800, +8/3200).
//   • Same UPGRADE_COSTS [0, 2000, 4000] with L3 = max quality.
//   • Same actions: gameState.buyRooms(rooms, cost) / gameState.upgradeQuality().
//   • Same refresh pattern: subscribe to 'state_changed', re-render when open.
//
// Public surface (open / close) matches V1 HotelPanel so main.ts can pick
// either at mount time without renaming anything in the wiring code.
//
// Styling lives in styleV2.css under .v2-hotel-* class selectors.
import { gameState } from '../../state/GameState';
import { fmtCash } from '../../ui/format';

interface RoomOption {
  rooms : number;
  cost  : number;
  label : string;
}

// Same options and prices as V1 HotelPanel.ts. Kept local so the V2 panel
// reads as a self-contained unit; the gameplay rule still lives in
// gameState.buyRooms which validates cash and emits state_changed.
const ROOM_OPTIONS: RoomOption[] = [
  { rooms: 2, cost: 1000, label: '+2 rooms' },
  { rooms: 4, cost: 1800, label: '+4 rooms' },
  { rooms: 8, cost: 3200, label: '+8 rooms' },
];

// Mirrors GameState.upgradeQuality's internal cost table. Display-only —
// the actual cost check happens inside gameState.upgradeQuality.
const UPGRADE_COSTS = [0, 2000, 4000];
const MAX_QUALITY   = 3;

export class HotelPanelV2 {
  private el          : HTMLElement;
  private statRooms   : HTMLElement;
  private statOcc     : HTMLElement;
  private statQuality : HTMLElement;
  private statIncome  : HTMLElement;
  private roomBtns    : HTMLButtonElement[] = [];
  private btnUpgrade  : HTMLButtonElement;
  private metaUpgrade : HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('aside');
    this.el.className = 'v2-hotel-panel hidden interactive';

    // ── Header ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'v2-hotel-header';

    const title = document.createElement('h3');
    title.className   = 'v2-hotel-title';
    title.textContent = 'HOTEL';

    const btnClose = document.createElement('button');
    btnClose.className   = 'v2-hotel-close';
    btnClose.type        = 'button';
    btnClose.textContent = '×';
    btnClose.title       = 'Close';
    btnClose.onclick     = () => this.close();

    header.append(title, btnClose);

    // ── Stat grid (2×2) ─────────────────────────────────────────────────
    const stats = document.createElement('div');
    stats.className = 'v2-hotel-stats';

    this.statRooms   = _statCard(stats, '🏨', 'Rooms');
    this.statOcc     = _statCard(stats, '◉',  'Occupancy');
    this.statQuality = _statCard(stats, '★',  'Quality');
    this.statIncome  = _statCard(stats, '◆',  'Income / day');

    // ── Scrollable body (sections + actions) ────────────────────────────
    const body = document.createElement('div');
    body.className = 'v2-hotel-body';

    body.appendChild(_sectionLabel('ADD ROOMS'));
    for (const opt of ROOM_OPTIONS) {
      body.appendChild(this._buildRoomCard(opt));
    }

    body.appendChild(_sectionLabel('UPGRADE QUALITY'));
    const { card, btn, meta } = this._buildUpgradeCard();
    this.btnUpgrade  = btn;
    this.metaUpgrade = meta;
    body.appendChild(card);

    const note = document.createElement('div');
    note.className   = 'v2-hotel-note';
    note.textContent = 'Rooms expand hotel capacity. Higher quality lifts the resort rating and pulls more guests.';
    body.appendChild(note);

    this.el.append(header, stats, body);
    parent.appendChild(this.el);

    // Same refresh contract as V1 HotelPanel: only repaint while visible.
    gameState.on('state_changed', () => {
      if (!this.el.classList.contains('hidden')) this._refresh();
    });
  }

  open(): void {
    this.el.classList.remove('hidden');
    this._refresh();
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _buildRoomCard(opt: RoomOption): HTMLButtonElement {
    const b = document.createElement('button');
    b.className       = 'v2-hotel-action';
    b.type            = 'button';
    b.dataset['cost'] = String(opt.cost);
    b.dataset['rooms'] = String(opt.rooms);
    // Actual cash check lives in gameState.buyRooms — this just dispatches.
    b.onclick = () => gameState.buyRooms(opt.rooms, opt.cost);

    const badge = document.createElement('div');
    badge.className   = 'v2-hotel-action-badge';
    badge.textContent = `+${opt.rooms}`;

    const meta = document.createElement('div');
    meta.className = 'v2-hotel-action-meta';

    const name = document.createElement('div');
    name.className   = 'v2-hotel-action-name';
    name.textContent = opt.label;

    const sub = document.createElement('div');
    sub.className   = 'v2-hotel-action-sub';
    sub.textContent = `${fmtCash(opt.cost)} 💰`;

    meta.append(name, sub);
    b.append(badge, meta);
    this.roomBtns.push(b);
    return b;
  }

  private _buildUpgradeCard(): { card: HTMLButtonElement; btn: HTMLButtonElement; meta: HTMLElement } {
    const card = document.createElement('button');
    card.className = 'v2-hotel-action v2-hotel-action-upgrade';
    card.type      = 'button';
    // gameState.upgradeQuality handles maxed + affordability itself.
    card.onclick = () => gameState.upgradeQuality();

    const badge = document.createElement('div');
    badge.className   = 'v2-hotel-action-badge';
    badge.textContent = '★';

    const meta = document.createElement('div');
    meta.className = 'v2-hotel-action-meta';

    const name = document.createElement('div');
    name.className = 'v2-hotel-action-name';

    const sub = document.createElement('div');
    sub.className = 'v2-hotel-action-sub';

    meta.append(name, sub);
    card.append(badge, meta);

    return { card, btn: card, meta: sub };
  }

  private _refresh(): void {
    const gs = gameState;

    // ── Stat cards ──────────────────────────────────────────────────────
    this.statRooms.textContent   = String(gs.roomCount);
    this.statOcc.textContent     =
      `${gs.bookedRooms} / ${Math.max(1, gs.roomCount)}  ·  ${Math.round(gs.occupancyRate * 100)}%`;
    this.statQuality.textContent = `${_stars(gs.qualityLevel)}  L${gs.qualityLevel}`;
    this.statIncome.textContent  = `${fmtCash(gs.bookedRooms * 25)} 💰`;

    // ── Room buttons ────────────────────────────────────────────────────
    ROOM_OPTIONS.forEach((opt, i) => {
      const b = this.roomBtns[i];
      const sub = b.querySelector('.v2-hotel-action-sub') as HTMLElement | null;
      if (sub) sub.textContent = `${fmtCash(opt.cost)} 💰`;
      b.disabled = gs.cash < opt.cost;
    });

    // ── Upgrade card ────────────────────────────────────────────────────
    const nameEl = this.btnUpgrade.querySelector('.v2-hotel-action-name') as HTMLElement | null;
    if (gs.qualityLevel >= MAX_QUALITY) {
      if (nameEl) nameEl.textContent = 'Maximum quality reached';
      this.metaUpgrade.textContent = `${_stars(MAX_QUALITY)}  L${MAX_QUALITY}`;
      this.btnUpgrade.disabled     = true;
      this.btnUpgrade.classList.add('maxed');
    } else {
      const cost = UPGRADE_COSTS[gs.qualityLevel];
      if (nameEl) nameEl.textContent = `Upgrade to Level ${gs.qualityLevel + 1}`;
      this.metaUpgrade.textContent = `${fmtCash(cost)} 💰  ·  +0.25 Rating`;
      this.btnUpgrade.disabled     = gs.cash < cost;
      this.btnUpgrade.classList.remove('maxed');
    }
  }
}

// ── Local helpers ─────────────────────────────────────────────────────────

function _statCard(parent: HTMLElement, icon: string, label: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'v2-hotel-stat-card';

  const iconEl = document.createElement('div');
  iconEl.className   = 'v2-hotel-stat-icon';
  iconEl.textContent = icon;

  const labelEl = document.createElement('div');
  labelEl.className   = 'v2-hotel-stat-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = 'v2-hotel-stat-value';

  card.append(iconEl, labelEl, valueEl);
  parent.appendChild(card);
  return valueEl;
}

function _sectionLabel(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className   = 'v2-hotel-section';
  d.textContent = text;
  return d;
}

function _stars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(MAX_QUALITY - level);
}
