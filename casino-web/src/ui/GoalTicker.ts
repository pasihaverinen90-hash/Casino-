// GoalTicker.ts — thin strip showing the active goal; tap to open Goals panel.
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';
import { uiBus }     from '../events/UIBus';

export class GoalTicker {
  private el: HTMLElement;
  private _flashTimer: ReturnType<typeof setTimeout> | null = null;
  private _placing = false;
  private _placingLabel = '';

  constructor(parent: HTMLElement, onOpen: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'goal-ticker interactive';
    this.el.onclick = onOpen;
    parent.appendChild(this.el);

    gameState.on('state_changed', () => this._refresh());
    gameState.on<{ index: number; reward: number }>('goal_completed', ({ index, reward }) => {
      this._flash(`✓  ${GC.GOAL_LABELS[index]} complete! +${reward} 💰`);
    });

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
    if (this._flashTimer) return; // don't overwrite a flash
    if (this._placing) {
      this.el.textContent = this._placingLabel;
      return;
    }
    const idx = gameState.activeGoal;
    if (idx >= 10) {
      this.el.textContent = '✓  All goals complete — view summary';
      return;
    }
    this.el.textContent = `▶  ${GC.GOAL_LABELS[idx]} — ${GC.GOAL_DESCS[idx]}`;
  }

  private _flash(msg: string): void {
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this.el.textContent = msg;
    this._flashTimer = setTimeout(() => { this._flashTimer = null; this._refresh(); }, 2500);
  }
}
