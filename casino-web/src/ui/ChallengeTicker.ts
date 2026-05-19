// ChallengeTicker.ts — thin strip showing the active random challenge or its
// boost. Hides when neither is active. Mirrors GoalTicker's pattern:
// subscribes to state_changed and re-renders. Text is per-id so units and
// labels match the challenge / boost in flight. Clicking the strip opens a
// details modal so the player can re-read objectives after the start toast
// fades — especially important for Comfort Check's five-service list.
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';
import { openObjectiveDetail, section, listSection } from './objectiveDetail';

export class ChallengeTicker {
  private el      : HTMLElement;
  private _parent : HTMLElement;

  constructor(parent: HTMLElement) {
    this._parent = parent;
    this.el = document.createElement('div');
    // 'interactive' is the project-wide class that lets pointer events
    // through and matches the cursor/hover styling used by GoalTicker.
    this.el.className = 'v2-challenge-ticker interactive';
    this.el.onclick   = () => this._showDetails();
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
        `Challenge: ${this._title(c.id)} — ${c.progress}/${c.target} ${this._unit(c.id)} — ${left} ${this._dayWord(left)} left`;
      this.el.style.display = '';
    } else if (b) {
      const left = Math.max(0, b.expiresDay - gameState.dayNumber);
      this.el.textContent =
        `Boost: ${this._boostText(b.id, b.multiplier)} — ${left} ${this._dayWord(left)} left`;
      this.el.style.display = '';
    } else {
      this.el.textContent = '';
      this.el.style.display = 'none';
    }
  }

  // ── Click handler ───────────────────────────────────────────────────────

  private _showDetails(): void {
    const c = gameState.activeChallenge;
    const b = gameState.activeBoost;
    if (c) {
      openObjectiveDetail(this._parent, this._challengeTitle(c.id), this._challengeBody(c));
    } else if (b) {
      openObjectiveDetail(this._parent, this._boostTitle(b.id), this._boostBody(b));
    }
  }

  // ── Body builders ───────────────────────────────────────────────────────
  // Shared section/listSection helpers live in objectiveDetail.ts so the
  // V2 active-goal detail flow can render the same panel shape.

  private _challengeBody(c: GC.ActiveChallenge): HTMLElement {
    const left = Math.max(0, c.deadlineDay - gameState.dayNumber);
    const root = document.createElement('div');
    root.appendChild(section('Objective', this._objectiveText(c.id)));
    if (c.id === 'comfort_check') {
      root.appendChild(listSection('Required services', [
        '2 functional WC',
        '2 functional Cashiers',
        '1 functional ATM',
        '1 functional Bar',
        '1 functional Buffet',
      ]));
    }
    root.appendChild(section('Progress', `${c.progress} / ${c.target} ${this._unit(c.id)}`));
    root.appendChild(section('Deadline', `${left} ${this._dayWord(left)} left`));
    const effect = this._effectText(c.id);
    if (effect) root.appendChild(section('Effect during event', effect));
    root.appendChild(section('Reward', this._rewardText(c.id)));
    root.appendChild(section('Failure', 'No penalty.'));
    return root;
  }

  private _boostBody(b: GC.ActiveBoost): HTMLElement {
    const left = Math.max(0, b.expiresDay - gameState.dayNumber);
    const root = document.createElement('div');
    root.appendChild(section('Effect', this._boostEffectText(b)));
    root.appendChild(section('Duration', `${left} ${this._dayWord(left)} left`));
    root.appendChild(section('Source', this._boostSourceText(b.id)));
    return root;
  }

  // ── Per-id text ─────────────────────────────────────────────────────────

  private _title(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': return 'Slot Promotion';
      case 'tourist_bus':    return 'Tourist Bus';
      case 'comfort_check':  return 'Comfort Check';
    }
  }

  private _unit(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': return 'slots';
      case 'tourist_bus':    return 'guests';
      case 'comfort_check':  return 'services';
    }
  }

  private _boostText(id: GC.BoostId, mult: number): string {
    const pct = Math.round((mult - 1) * 100);
    switch (id) {
      case 'slot_revenue_boost': return `Slot revenue +${pct}%`;
      case 'walkin_boost':       return `Walk-in +${pct}%`;
    }
  }

  private _dayWord(n: number): string { return n === 1 ? 'day' : 'days'; }

  private _challengeTitle(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': return 'Slot Machine Promotion';
      case 'tourist_bus':    return 'Tourist Bus Arrival';
      case 'comfort_check':  return 'Comfort Check';
    }
  }

  private _objectiveText(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion':
        return `Build ${GC.SLOT_PROMOTION_TARGET} new Slot Machines within ${GC.SLOT_PROMOTION_DURATION_DAYS} days.`;
      case 'tourist_bus':
        return `Serve ${GC.TOURIST_BUS_TARGET} guests during the ${GC.TOURIST_BUS_DURATION_DAYS}-day event.`;
      case 'comfort_check':
        return `Provide every required guest comfort service before the deadline.`;
    }
  }

  private _effectText(id: GC.ChallengeId): string | null {
    switch (id) {
      case 'tourist_bus': {
        const pct = Math.round((GC.TOURIST_BUS_WALKIN_MULT - 1) * 100);
        return `Walk-in demand +${pct}%`;
      }
      case 'slot_promotion':
      case 'comfort_check':
        return null;
    }
  }

  private _rewardText(id: GC.ChallengeId): string {
    switch (id) {
      case 'slot_promotion': {
        const pct = Math.round((GC.SLOT_PROMOTION_REWARD_MULT - 1) * 100);
        return `Slot revenue +${pct}% for ${GC.SLOT_PROMOTION_REWARD_DAYS} days`;
      }
      case 'tourist_bus':
        return `+$${GC.TOURIST_BUS_REWARD_CASH.toLocaleString()} cash`;
      case 'comfort_check':
        return `+$${GC.COMFORT_CHECK_REWARD_CASH.toLocaleString()} cash`;
    }
  }

  private _boostTitle(id: GC.BoostId): string {
    switch (id) {
      case 'slot_revenue_boost': return 'Slot Revenue Boost';
      case 'walkin_boost':       return 'Tourist Bus Traffic';
    }
  }

  private _boostEffectText(b: GC.ActiveBoost): string {
    const pct = Math.round((b.multiplier - 1) * 100);
    switch (b.id) {
      case 'slot_revenue_boost': return `Slot Machine revenue +${pct}%`;
      case 'walkin_boost':       return `Walk-in demand +${pct}%`;
    }
  }

  private _boostSourceText(id: GC.BoostId): string {
    switch (id) {
      case 'slot_revenue_boost': return 'Slot Machine Promotion';
      case 'walkin_boost':       return 'Tourist Bus Arrival';
    }
  }
}
