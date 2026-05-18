// TopHUDV2.ts — premium V2 top bar.
//
// Reuses V1's data sources (gameState.getDaySnapshot, TimeController,
// format helpers) and V1's speed-control behaviour. Mounts in the same
// uiRoot V1 panels use; uses .v2-* class scoping so V1 CSS is untouched.
//
// Public surface mirrors V1 TopHUD so main.ts's `time.on('clock', idx
// => topHUD.setClock(idx))` works for either renderer without a
// renderer branch in the wiring code.
import { gameState } from '../../state/GameState';
import { time, fmtClock, type Speed } from '../../state/TimeController';
import { fmtCash } from '../../ui/format';

export class TopHUDV2 {
  private el         : HTMLElement;
  private vRating    : HTMLElement;
  private vGuests    : HTMLElement;
  private vCash      : HTMLElement;
  private vClock     : HTMLElement;
  private btnPause   : HTMLButtonElement;
  private btn1x      : HTMLButtonElement;
  private btn2x      : HTMLButtonElement;
  private btn4x      : HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.el           = document.createElement('div');
    this.el.className = 'v2-top-hud interactive';

    // Brand block.
    const brand = document.createElement('div');
    brand.className = 'v2-brand';
    const mark = document.createElement('span');
    mark.className   = 'v2-brand-mark';
    mark.textContent = '♠';
    const name = document.createElement('span');
    name.textContent = 'Casino Resort Manager';
    brand.append(mark, name);

    // Stat pills.
    this.vRating = _statPill(this.el, '★', 'rating');
    this.vGuests = _statPill(this.el, '◉', 'guests');
    this.vCash   = _statPill(this.el, '◆', 'cash');

    // Insert brand first.
    this.el.insertBefore(brand, this.el.firstChild);

    // Push the right cluster (clock + speed) to the far right.
    const spacer = document.createElement('div');
    spacer.className = 'v2-spacer';
    this.el.appendChild(spacer);

    // Clock.
    this.vClock           = document.createElement('div');
    this.vClock.className = 'v2-clock';
    this.el.appendChild(this.vClock);

    // Speed segmented control.
    const speedGroup = document.createElement('div');
    speedGroup.className = 'v2-speed-group';
    this.btnPause = _speedBtn('⏸',  'Pause / Space');
    this.btn1x    = _speedBtn('1×', '1×  [1]');
    this.btn2x    = _speedBtn('2×', '2×  [2]');
    this.btn4x    = _speedBtn('4×', '4×  [4]');
    this.btnPause.onclick = () => time.setSpeed(0);
    this.btn1x.onclick    = () => time.setSpeed(1);
    this.btn2x.onclick    = () => time.setSpeed(2);
    this.btn4x.onclick    = () => time.setSpeed(4);
    speedGroup.append(this.btnPause, this.btn1x, this.btn2x, this.btn4x);
    this.el.appendChild(speedGroup);

    parent.appendChild(this.el);

    time.on<Speed>('speed', () => this._refreshSpeed());
    gameState.on('state_changed', () => this._refresh());
    this._refresh();
    this._refreshSpeed();
  }

  // Called from main.ts on every quarter-hour tick — same contract V1
  // TopHUD uses, so the wiring code in main.ts doesn't need a branch.
  setClock(_idx: number): void {
    this._refresh();
  }

  private _refresh(): void {
    const s = gameState.getDaySnapshot();
    this.vRating.textContent = s.rating.toFixed(1);
    this.vGuests.textContent = `${s.totalGuests}/day`;
    this.vCash.textContent   = fmtCash(s.cash);
    this.vClock.textContent  = `Day ${s.day} · ${fmtClock(time.quarterHourIdx)}`;
  }

  private _refreshSpeed(): void {
    const s: Speed = time.speed;
    this.btnPause.classList.toggle('active', s === 0);
    this.btn1x   .classList.toggle('active', s === 1);
    this.btn2x   .classList.toggle('active', s === 2);
    this.btn4x   .classList.toggle('active', s === 4);
  }
}

// One stat pill: icon + value. Appends to parent and returns the value
// span so callers can update it later.
function _statPill(parent: HTMLElement, icon: string, title: string): HTMLElement {
  const pill = document.createElement('div');
  pill.className = 'v2-stat';
  pill.title     = title;

  const iconEl = document.createElement('span');
  iconEl.className   = 'v2-stat-icon';
  iconEl.textContent = icon;

  const valueEl = document.createElement('span');
  valueEl.className = 'v2-stat-value';

  pill.append(iconEl, valueEl);
  parent.appendChild(pill);
  return valueEl;
}

function _speedBtn(label: string, title: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className   = 'v2-speed-btn';
  b.textContent = label;
  b.title       = title;
  b.type        = 'button';
  return b;
}
