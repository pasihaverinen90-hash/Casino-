// GoalCompletePopup.ts — modal popup that announces a goal completion or
// the all-goals-complete / endless-mode unlock. Listens for `goal_completed`
// and `endless_unlocked` events from GameState and queues them so multiple
// completions in the same tick (which is normal in any-order goals) show
// one card after another instead of overlapping.
//
// Time pauses while a popup is up so the player can read it without losing
// progress; the player's previous speed is restored when the queue drains.
import { gameState } from '../state/GameState';
import { time }      from '../state/TimeController';
import * as GC       from '../logic/GameConstants';

interface PopupItem {
  title : string;
  body  : string;
  reward: number;
  cta   : string;
}

export class GoalCompletePopup {
  private parent : HTMLElement;
  private queue  : PopupItem[] = [];
  // The currently-shown overlay (null when queue is idle). Tracks
  // active-state without checking the DOM.
  private active : HTMLElement | null = null;
  // Speed before the first popup of a chain — restored when the queue empties.
  private _prevSpeed: import('../state/TimeController').Speed = 0;

  constructor(parent: HTMLElement) {
    this.parent = parent;

    gameState.on<{ index: number; reward: number }>('goal_completed', ({ index, reward }) => {
      this._enqueue({
        title : `Goal Complete: ${GC.GOAL_LABELS[index]}`,
        body  : GC.GOAL_DESCS[index],
        reward,
        cta   : 'Continue',
      });
    });

    gameState.on<{ reward: number }>('endless_unlocked', ({ reward }) => {
      this._enqueue({
        title : 'All Goals Complete!',
        body  : 'You have built a successful casino. Endless Mode is now unlocked — keep playing as long as you like.',
        reward,
        cta   : 'Continue Playing',
      });
    });
  }

  private _enqueue(item: PopupItem): void {
    this.queue.push(item);
    if (!this.active) this._showNext();
  }

  private _showNext(): void {
    const item = this.queue.shift();
    if (!item) {
      // Queue drained — restore the speed the player had before the chain.
      time.setSpeed(this._prevSpeed);
      this.active = null;
      return;
    }
    if (!this.active) {
      // First popup of a chain — pause time and remember speed.
      this._prevSpeed = time.speed;
      time.setSpeed(0);
    }
    this.active = this._build(item);
    this.parent.appendChild(this.active);
  }

  private _build(item: PopupItem): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay interactive';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const title = document.createElement('div');
    title.className   = 'modal-title';
    title.textContent = item.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className   = 'modal-body';
    body.textContent = item.body;
    card.appendChild(body);

    const reward = document.createElement('div');
    reward.className   = 'modal-body';
    reward.style.color = '#4dcc80';
    reward.style.fontWeight = '600';
    reward.textContent = `Reward: +${item.reward.toLocaleString()} 💰`;
    card.appendChild(reward);

    const btn = document.createElement('button');
    btn.className   = 'modal-btn';
    btn.textContent = item.cta;
    btn.onclick     = () => {
      overlay.remove();
      this.active = null;
      this._showNext();
    };
    card.appendChild(btn);

    overlay.appendChild(card);
    return overlay;
  }
}
