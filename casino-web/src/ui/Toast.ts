// Toast.ts — brief pop-up notification, auto-hides after 2.5 s.
import { gameState } from '../state/GameState';

export class Toast {
  private el   : HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    parent.appendChild(this.el);

    gameState.on<string>('toast_requested', msg => this.show(msg));
    // Goal completion is handled by GoalCompletePopup — no toast here, the
    // modal popup is the canonical "goal done" feedback.
    gameState.on<string>('placement_failed', reason => this.show(reason));
  }

  show(msg: string): void {
    this.el.textContent = msg;
    this.el.classList.add('visible');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.el.classList.remove('visible');
      this.timer = null;
    }, 2500);
  }
}
