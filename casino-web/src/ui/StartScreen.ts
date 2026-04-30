// StartScreen.ts — initial overlay shown before gameplay begins.
// Lets the user pick one of 3 save slots (continue or new game).
import { gameState } from '../state/GameState';
import * as Slots from '../state/SaveSlots';
import { fmtCash } from './TopHUD';

export class StartScreen {
  private el: HTMLElement;
  private slotList: HTMLElement;
  private onPicked: () => void;

  constructor(parent: HTMLElement, onPicked: () => void) {
    this.onPicked = onPicked;

    this.el = document.createElement('div');
    this.el.className = 'start-screen interactive';

    const card = document.createElement('div');
    card.className = 'start-card';

    const title = document.createElement('div');
    title.className   = 'start-title';
    title.textContent = 'Casino Resort Manager';
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className   = 'start-subtitle';
    subtitle.textContent = 'Select a save slot';
    card.appendChild(subtitle);

    this.slotList = document.createElement('div');
    this.slotList.className = 'slot-list';
    card.appendChild(this.slotList);

    this.el.appendChild(card);
    parent.appendChild(this.el);
  }

  // Rebuild slot rows on every show so summaries reflect the latest saves.
  show(): void {
    this.slotList.replaceChildren();
    for (let i = 1; i <= Slots.SLOT_COUNT; i++) {
      this.slotList.appendChild(this._buildSlotRow(i));
    }
    this.el.classList.add('visible');
  }

  hide(): void { this.el.classList.remove('visible'); }

  private _buildSlotRow(slot: number): HTMLElement {
    const summary = Slots.getSummary(slot);
    const row = document.createElement('div');
    row.className = 'slot-row';

    const left = document.createElement('div');
    left.className = 'slot-left';

    const head = document.createElement('div');
    head.className   = 'slot-head';
    head.textContent = `Slot ${slot}`;
    left.appendChild(head);

    const meta = document.createElement('div');
    meta.className = 'slot-meta';
    if (summary.empty) {
      meta.textContent = '— Empty —';
      meta.classList.add('empty');
    } else {
      const rating = summary.rating !== undefined
        ? `★ ${summary.rating.toFixed(1)}` : '★ —';
      const guests = summary.guests !== undefined
        ? `👥 ${summary.guests}/day` : '👥 —';
      meta.textContent =
        `Day ${summary.day ?? 1} · 💰 ${fmtCash(summary.cash ?? 0)} · ${rating} · ${guests}`;
    }
    left.appendChild(meta);

    row.appendChild(left);

    const actions = document.createElement('div');
    actions.className = 'slot-actions';

    if (!summary.empty) {
      const btnContinue = document.createElement('button');
      btnContinue.className   = 'slot-btn primary';
      btnContinue.textContent = 'Continue';
      btnContinue.onclick     = () => this._pickSlot(slot, /*fresh*/ false);
      actions.appendChild(btnContinue);
    }

    const btnNew = document.createElement('button');
    btnNew.className   = 'slot-btn';
    btnNew.textContent = 'New Game';
    btnNew.onclick     = () => {
      if (summary.empty) {
        this._pickSlot(slot, /*fresh*/ true);
      } else {
        this._confirmOverwrite(slot, () => {
          this._pickSlot(slot, /*fresh*/ true);
        });
      }
    };
    actions.appendChild(btnNew);

    row.appendChild(actions);
    return row;
  }

  private _pickSlot(slot: number, fresh: boolean): void {
    if (fresh) gameState.newGameInSlot(slot);
    else       gameState.loadSlot(slot);
    this.hide();
    this.onPicked();
  }

  private _confirmOverwrite(slot: number, onConfirm: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay interactive';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const title = document.createElement('div');
    title.className   = 'modal-title';
    title.textContent = `Overwrite Slot ${slot}?`;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className   = 'modal-body';
    body.textContent = 'Existing save will be lost.';
    card.appendChild(body);

    const btnOverwrite = document.createElement('button');
    btnOverwrite.className   = 'modal-btn danger';
    btnOverwrite.textContent = 'Start New Game';
    btnOverwrite.onclick     = () => {
      overlay.remove();
      onConfirm();
    };
    card.appendChild(btnOverwrite);

    const btnCancel = document.createElement('button');
    btnCancel.className   = 'modal-btn';
    btnCancel.textContent = 'Cancel';
    btnCancel.onclick     = () => overlay.remove();
    card.appendChild(btnCancel);

    overlay.appendChild(card);
    this.el.appendChild(overlay);
  }
}
