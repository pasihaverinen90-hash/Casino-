// ChallengeTicker.ts — thin strip showing the active random challenge or its
// boost. Hides when neither is active. Mirrors GoalTicker's pattern:
// subscribes to state_changed and re-renders. Text is per-id so units and
// labels match the challenge / boost in flight.
import type * as GC from '../logic/GameConstants';
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
        `Challenge: ${this._title(c.id)} — ${c.progress}/${c.target} ${this._unit(c.id)} — ${left} ${left === 1 ? 'day' : 'days'} left`;
      this.el.style.display = '';
    } else if (b) {
      const left = Math.max(0, b.expiresDay - gameState.dayNumber);
      this.el.textContent =
        `Boost: ${this._boostText(b.id, b.multiplier)} — ${left} ${left === 1 ? 'day' : 'days'} left`;
      this.el.style.display = '';
    } else {
      this.el.textContent = '';
      this.el.style.display = 'none';
    }
  }

  private _title(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': return 'Slot Promotion';
      case 'tourist_bus':    return 'Tourist Bus';
    }
  }

  private _unit(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': return 'slots';
      case 'tourist_bus':    return 'guests';
    }
  }

  private _boostText(id: GC.BoostId, mult: number): string {
    const pct = Math.round((mult - 1) * 100);
    switch (id) {
      case 'slot_revenue_boost': return `Slot revenue +${pct}%`;
      case 'walkin_boost':       return `Walk-in +${pct}%`;
    }
  }
}
