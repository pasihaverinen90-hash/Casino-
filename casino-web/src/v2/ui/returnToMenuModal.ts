// returnToMenuModal.ts — confirm modal shown when the player clicks the
// bottom-bar Menu button. Pauses the game while it's open and restores
// the prior speed if the player cancels.
//
// Uses V2-native class names (.v2-modal-* / .v2-modal-btn-danger).
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
  overlay.className = 'v2-modal-overlay interactive';

  const card = document.createElement('div');
  card.className = 'v2-modal-card';

  const title = document.createElement('div');
  title.className   = 'v2-modal-title';
  title.textContent = 'Return to Main Menu?';
  card.appendChild(title);

  const body = document.createElement('div');
  body.className   = 'v2-modal-body';
  body.textContent = 'Unsaved progress will be lost.';
  card.appendChild(body);

  const btnGo = document.createElement('button');
  btnGo.className   = 'v2-modal-btn v2-modal-btn-danger';
  btnGo.textContent = 'Return to Menu';
  btnGo.onclick     = () => {
    overlay.remove();
    time.setSpeed(0);
    args.onConfirm();
  };
  card.appendChild(btnGo);

  const btnCancel = document.createElement('button');
  btnCancel.className   = 'v2-modal-btn';
  btnCancel.textContent = 'Cancel';
  btnCancel.onclick     = () => {
    overlay.remove();
    time.setSpeed(prevSpeed);
  };
  card.appendChild(btnCancel);

  overlay.appendChild(card);
  args.parent.appendChild(overlay);
}
