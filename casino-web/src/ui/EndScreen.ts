// EndScreen.ts — full-screen overlay shown when all goals are complete.
import { gameState } from '../state/GameState';

export class EndScreen {
  private el       : HTMLElement;
  private lblTitle : HTMLElement;
  private lblDays  : HTMLElement;
  private lblRating: HTMLElement;
  private lblEarned: HTMLElement;
  private lblBuilt : HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'end-screen interactive';

    const card = document.createElement('div');
    card.className = 'end-card';

    this.lblTitle  = card.appendChild(el('div', 'end-title', 'Resort Complete! 🎰'));
    this.lblDays   = card.appendChild(el('div', 'end-stat', ''));
    this.lblRating = card.appendChild(el('div', 'end-stat', ''));
    this.lblEarned = card.appendChild(el('div', 'end-stat', ''));
    this.lblBuilt  = card.appendChild(el('div', 'end-stat', ''));

    const btnReset = document.createElement('button');
    btnReset.className   = 'play-again-btn';
    btnReset.textContent = 'Play Again';
    btnReset.onclick     = () => {
      gameState.resetGame();
      this.el.classList.remove('visible');
    };
    card.appendChild(btnReset);

    this.el.appendChild(card);
    parent.appendChild(this.el);

    gameState.on('game_complete', () => this._show());
  }

  private _show(): void {
    const gs = gameState;
    this.lblDays.textContent   = `Days played: ${gs.dayNumber}`;
    this.lblRating.textContent = `Final Rating: ${gs.resortRating.toFixed(1)} ★`;
    this.lblEarned.textContent = `Total Earned: ${gs.cumulativeIncome.toLocaleString()} 💰`;
    this.lblBuilt.textContent  = `Objects Built: ${gs.placedObjs.length}`;
    this.el.classList.add('visible');
  }
}

function el(tag: string, cls: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = text;
  return e;
}
