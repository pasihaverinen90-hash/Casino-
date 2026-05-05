// TopHUD.ts — persistent top strip: Rating | Guests | Cash | Day · Clock
import { gameState } from '../state/GameState';
import { fmtClock, time } from '../state/TimeController';

export class TopHUD {
  private lblRating: HTMLElement;
  private lblGuests: HTMLElement;
  private lblCash  : HTMLElement;
  private lblDay   : HTMLElement;

  constructor(parent: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'top-hud interactive';

    this.lblRating = el.appendChild(span(''));
    this.lblGuests = el.appendChild(span(''));
    this.lblCash   = el.appendChild(span(''));
    this.lblDay    = el.appendChild(span(''));

    parent.appendChild(el);
    gameState.on('state_changed', () => this._refresh());
    this._refresh();
  }

  // Called from main.ts on every half-hour tick from TimeController. Kept
  // separate from the state_changed refresh so the clock updates smoothly
  // even if the world is otherwise idle.
  setClock(_idx: number): void {
    this._refresh();
  }

  private _refresh(): void {
    const s = gameState.getDaySnapshot();
    this.lblRating.textContent = `★ ${s.rating.toFixed(1)}`;
    this.lblGuests.textContent = `👥 ${s.totalGuests}/day`;
    this.lblCash.textContent   = `💰 ${fmtCash(s.cash)}`;
    this.lblDay.textContent    = `Day ${s.day} · ${fmtClock(time.halfHourIdx)}`;
  }
}

function span(text: string): HTMLElement {
  const s = document.createElement('span');
  s.textContent = text;
  return s;
}

export function fmtCash(v: number): string {
  const n = Math.floor(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`;
  return String(n);
}
