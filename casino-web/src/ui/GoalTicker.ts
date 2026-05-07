// GoalTicker.ts — thin strip showing the next-up goal; tap to open Goals panel.
// Goals V2: goals can complete in any order, so `activeGoal` is the *first
// incomplete* goal (or 10 once everything is done). Completion feedback
// lives in GoalCompletePopup; the ticker just reflects current state.
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';
import { uiBus }     from '../events/UIBus';

export class GoalTicker {
  private el: HTMLElement;
  private _placing = false;
  private _placingLabel = '';

  constructor(parent: HTMLElement, onOpen: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'goal-ticker interactive';
    this.el.onclick = onOpen;
    parent.appendChild(this.el);

    gameState.on('state_changed', () => this._refresh());

    uiBus.on<{ type: number; variant: string }>('start_placement', ({ type, variant }) => {
      const def = GC.getDef(type as GC.ObjType);
      const name = variant ? `${def.label} (${variant})` : def.label;
      this._placing      = true;
      this._placingLabel = `📐 Placing ${name}  ·  R = rotate  ·  Esc = cancel`;
      this._refresh();
    });

    const _endPlacement = () => { this._placing = false; this._refresh(); };
    uiBus.on('exit_placement',      _endPlacement);
    uiBus.on('placement_confirmed', _endPlacement);
    uiBus.on('placement_cancelled', _endPlacement);

    this._refresh();
  }

  private _refresh(): void {
    if (this._placing) {
      this.el.textContent = this._placingLabel;
      return;
    }
    const idx = gameState.activeGoal;
    if (idx >= 10) {
      this.el.textContent = '✓  All goals complete — Endless Mode';
      return;
    }
    this.el.textContent = `▶  ${GC.GOAL_LABELS[idx]} — ${GC.GOAL_DESCS[idx]}`;
  }
}
