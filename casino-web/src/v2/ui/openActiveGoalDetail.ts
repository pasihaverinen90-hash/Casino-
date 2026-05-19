// openActiveGoalDetail.ts — V2 helper that opens the shared objective
// detail modal for the single active goal. Same title + sections +
// Close panel shape as the Challenge detail flow. StatsPanelV2 → Goals
// tab still hosts the full goals list; this is the per-objective focus
// card shown when the player clicks the bottom goal ticker.
import { gameState } from '../../state/GameState';
import * as GC from '../../logic/GameConstants';
import {
  openObjectiveDetail,
  section,
  progressSection,
} from '../../ui/objectiveDetail';

export function openActiveGoalDetail(parent: HTMLElement): void {
  const idx = gameState.activeGoal;
  if (idx >= 10) {
    // All goals complete: show a small "all done" detail panel that still
    // matches the modal shape rather than silently doing nothing.
    const body = document.createElement('div');
    body.appendChild(section('Status', 'All goals complete — Endless Mode unlocked.'));
    openObjectiveDetail(parent, 'Goals Complete', body);
    return;
  }

  const done    = gameState.completedGoals[idx] === true;
  const day     = gameState.goalCompletedDays[idx];
  const reward  = GC.GOAL_REWARDS[idx];
  const desc    = GC.GOAL_DESCS[idx];
  const pct     = done ? 1 : gameState.getGoalProgress(idx);
  const status  = done
    ? (day != null ? `Completed — Day ${day}` : 'Completed')
    : 'In progress';

  const body = document.createElement('div');
  body.appendChild(section('Goal',     `${idx + 1}. ${GC.GOAL_LABELS[idx]}`));
  body.appendChild(section('Objective', desc));
  body.appendChild(progressSection('Progress', pct, `${Math.round(pct * 100)}% complete`));
  body.appendChild(section('Reward',   `+${reward.toLocaleString()} 💰`));
  body.appendChild(section('Status',   status));

  openObjectiveDetail(parent, `Goal ${idx + 1}`, body);
}
