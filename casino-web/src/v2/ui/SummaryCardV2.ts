// SummaryCardV2.ts — bottom-right "Today" pill shown only in V2.
//
// Compact visual-only card showing the day's headline numbers:
// projected revenue, projected guests, current cash. Reads
// gameState.getDaySnapshot() and refreshes on 'state_changed'.
//
// Pointer-events disabled in CSS — clicks pass through to the canvas
// behind so the card never blocks placement / demolish.
import { gameState } from '../../state/GameState';
import { fmtCash } from '../../ui/format';

export class SummaryCardV2 {
  private el      : HTMLElement;
  private vRev    : HTMLElement;
  private vGuests : HTMLElement;
  private vCash   : HTMLElement;

  constructor(parent: HTMLElement) {
    this.el           = document.createElement('div');
    this.el.className = 'v2-summary-card';

    const title = document.createElement('div');
    title.className   = 'v2-summary-title';
    title.textContent = 'Today';
    this.el.appendChild(title);

    this.vRev    = _row(this.el, 'Revenue');
    this.vGuests = _row(this.el, 'Guests');
    this.vCash   = _row(this.el, 'Cash');

    parent.appendChild(this.el);

    gameState.on('state_changed', () => this._refresh());
    this._refresh();
  }

  private _refresh(): void {
    const s = gameState.getDaySnapshot();
    // dailyRevenue is the running projection — matches what the player
    // sees on the HUD. Show as positive (green) when non-zero.
    const rev = Math.max(0, Math.round(gameState.dailyRevenue));
    this.vRev.textContent    = fmtCash(rev);
    this.vRev.classList.toggle('pos', rev > 0);
    this.vGuests.textContent = `${s.totalGuests}/d`;
    this.vCash.textContent   = fmtCash(s.cash);
  }
}

function _row(parent: HTMLElement, label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'v2-summary-row';

  const lab = document.createElement('span');
  lab.className   = 'v2-summary-label';
  lab.textContent = label;

  const val = document.createElement('span');
  val.className = 'v2-summary-value';

  row.append(lab, val);
  parent.appendChild(row);
  return val;
}
