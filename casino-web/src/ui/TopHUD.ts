// TopHUD.ts — persistent top strip: Rating | Guests | Cash | Day
import { gameState } from '../state/GameState';

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

  private _refresh(): void {
    this.lblRating.textContent = `★ ${gameState.resortRating.toFixed(1)}`;
    this.lblGuests.textContent = `👥 ${gameState.totalGuests}/day`;
    this.lblCash.textContent   = `💰 ${fmtCash(gameState.cash)}`;
    this.lblDay.textContent    = `Day ${gameState.dayNumber}`;
  }
}

function span(text: string): HTMLElement {
  const s = document.createElement('span');
  s.textContent = text;
  return s;
}

export function fmtCash(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${Math.floor(v / 1000)},${String(v % 1000).padStart(3, '0')}`;
  return String(v);
}
