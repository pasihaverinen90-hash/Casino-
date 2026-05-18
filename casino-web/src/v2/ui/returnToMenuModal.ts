// returnToMenuModal.ts — confirm modal shown when the player clicks the
// bottom-bar Menu button. Pauses the game while it's open and restores
// the prior speed if the player cancels.
//
// Extracted from main.ts in Phase 11B. Behaviour byte-identical: same
// V1 modal class names (`.modal-overlay`, `.modal-card`, `.modal-title`,
// `.modal-body`, `.modal-btn`, `.modal-btn.danger`) — V2 chrome comes
// from `.v2-root` overrides in styleV2.css.
//
// onConfirm is the caller's "actually return to menu" hook: clears
// any session-level `started` flag in main.ts, resets the GameState
// active slot, and re-shows the start screen.
import { time } from '../../state/TimeController';

export interface ReturnToMenuArgs {
  parent    : HTMLElement;
  onConfirm : () => void;
}

export function openReturnToMenuModal(args: ReturnToMenuArgs): void {
  // Pause while the modal is up; restore the player's prior speed on cancel.
  const prevSpeed = time.speed;
  time.setSpeed(0);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay interactive';

  const card = document.createElement('div');
  card.className = 'modal-card';

  const title = document.createElement('div');
  title.className   = 'modal-title';
  title.textContent = 'Return to Main Menu?';
  card.appendChild(title);

  const body = document.createElement('div');
  body.className   = 'modal-body';
  body.textContent = 'Unsaved progress will be lost.';
  card.appendChild(body);

  const btnGo = document.createElement('button');
  btnGo.className   = 'modal-btn danger';
  btnGo.textContent = 'Return to Menu';
  btnGo.onclick     = () => {
    overlay.remove();
    time.setSpeed(0);
    args.onConfirm();
  };
  card.appendChild(btnGo);

  const btnCancel = document.createElement('button');
  btnCancel.className   = 'modal-btn';
  btnCancel.textContent = 'Cancel';
  btnCancel.onclick     = () => {
    overlay.remove();
    time.setSpeed(prevSpeed);
  };
  card.appendChild(btnCancel);

  overlay.appendChild(card);
  args.parent.appendChild(overlay);
}
