// GoalsPanel.ts — full-screen goals list overlay.
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';

export class GoalsPanel {
  private el      : HTMLElement;
  private goalList: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel goals-panel hidden interactive';

    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';
    const title = document.createElement('h3');
    title.textContent = 'GOALS';
    const btnClose = mkClose(() => this.close());
    titleRow.append(title, btnClose);

    const scroll = document.createElement('div');
    scroll.className = 'panel-scroll';

    this.goalList = document.createElement('div');
    scroll.appendChild(this.goalList);

    this.el.append(titleRow, scroll);
    parent.appendChild(this.el);

    gameState.on('state_changed',  () => { if (!this.el.classList.contains('hidden')) this._refresh(); });
    gameState.on('goal_completed', () => { if (!this.el.classList.contains('hidden')) this._refresh(); });
  }

  open(): void { this._refresh(); this.el.classList.remove('hidden'); }
  close(): void { this.el.classList.add('hidden'); }

  private _refresh(): void {
    this.goalList.innerHTML = '';
    const gs = gameState;

    for (let i = 0; i < 10; i++) {
      const row = document.createElement('div');
      row.className = 'goal-row';

      // Status icon
      const icon = document.createElement('div');
      icon.className = 'goal-icon';
      if (gs.completedGoals[i]) {
        icon.textContent = '✓'; icon.style.color = '#4dcc80';
      } else if (i === gs.activeGoal) {
        icon.textContent = '▶'; icon.style.color = '#ffcc44';
      } else {
        icon.textContent = '○'; icon.style.color = '#555';
      }

      // Info column
      const info = document.createElement('div');
      info.style.flex = '1';

      const name = document.createElement('div');
      name.className   = 'goal-name';
      name.textContent = GC.GOAL_LABELS[i];
      if (i > gs.activeGoal && !gs.completedGoals[i]) name.style.color = '#555';

      const desc = document.createElement('div');
      desc.className   = 'goal-desc';
      desc.textContent = GC.GOAL_DESCS[i];

      info.append(name, desc);

      // Progress bar for active goal
      if (i === gs.activeGoal) {
        const pct = gs.getGoalProgress(i);
        const barWrap = document.createElement('div');
        barWrap.className = 'goal-progress';
        const fill = document.createElement('div');
        fill.className           = 'goal-progress-fill';
        fill.style.width         = `${Math.round(pct * 100)}%`;
        barWrap.appendChild(fill);
        info.appendChild(barWrap);
      }

      // Reward badge
      const reward = document.createElement('div');
      reward.style.cssText = 'font-size:11px;color:#888;white-space:nowrap;padding-top:2px';
      reward.textContent   = `+${GC.GOAL_REWARDS[i]} 💰`;

      row.append(icon, info, reward);
      this.goalList.appendChild(row);

      // Separator
      const sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid #1a1f2a;margin:0';
      this.goalList.appendChild(sep);
    }
  }
}

function mkClose(cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'panel-close'; b.textContent = '✕'; b.onclick = cb;
  return b;
}
