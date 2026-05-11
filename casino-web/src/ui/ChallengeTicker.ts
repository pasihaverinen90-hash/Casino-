// ChallengeTicker.ts — thin strip showing the active random challenge or its
// post-completion boost. Hides when neither is active. Mirrors GoalTicker's
// pattern: subscribes to state_changed and re-renders.
import { gameState } from '../state/GameState';

export class ChallengeTicker {
  private el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'challenge-ticker';
    parent.appendChild(this.el);

    gameState.on('state_changed', () => this._refresh());
    this._refresh();
  }

  private _refresh(): void {
    const c = gameState.activeChallenge;
    const b = gameState.activeBoost;
    if (c) {
      const left = Math.max(0, c.deadlineDay - gameState.dayNumber);
      this.el.textContent =
        `Challenge: Slot Promotion — ${c.progress}/${c.target} slots — ${left} ${left === 1 ? 'day' : 'days'} left`;
      this.el.style.display = '';
    } else if (b) {
      const left = Math.max(0, b.expiresDay - gameState.dayNumber);
      const pct  = Math.round((b.multiplier - 1) * 100);
      this.el.textContent =
        `Boost: Slot revenue +${pct}% — ${left} ${left === 1 ? 'day' : 'days'} left`;
      this.el.style.display = '';
    } else {
      this.el.textContent = '';
      this.el.style.display = 'none';
    }
  }
}
