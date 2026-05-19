// StartScreen.ts — V2 landing screen: full-bleed casino background +
// premium save-slot cards. Confirmation modals reuse the shared
// .v2-modal-* chrome so legacy modal-* CSS can stay deleted.
//
// Background image lives at `public/assets/start/start-casino-bg.jpg`;
// the URL is composed via import.meta.env.BASE_URL so dev (`/`) and
// GitHub Pages (`/Casino-hotel/`) both resolve correctly.
/// <reference types="vite/client" />
import { gameState } from '../state/GameState';
import * as Slots from '../state/SaveSlots';
import { fmtCash } from './format';

const BG_URL = `${import.meta.env.BASE_URL}assets/start/start-casino-bg.jpg`;

export class StartScreen {
  private el: HTMLElement;
  private slotList: HTMLElement;
  private onPicked: () => void;

  constructor(parent: HTMLElement, onPicked: () => void) {
    this.onPicked = onPicked;

    this.el = document.createElement('div');
    this.el.className = 'v2-start-screen interactive';
    // Layered gradient over the photo so the card stays readable on
    // top of the warm casino-room background. Gradient is left-heavy
    // so the bottom-right "© Pasi Haverinen Gaming" mark stays visible.
    this.el.style.backgroundImage =
      `linear-gradient(100deg, rgba(8,6,12,0.92) 0%, rgba(8,6,12,0.55) 48%, rgba(8,6,12,0.18) 100%), `
      + `url("${BG_URL}")`;

    const card = document.createElement('div');
    card.className = 'v2-start-card';

    const title = document.createElement('div');
    title.className   = 'v2-start-title';
    title.textContent = 'CASINO RESORT MANAGER';
    card.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className   = 'v2-start-subtitle';
    subtitle.textContent = 'Build. Manage. Expand.';
    card.appendChild(subtitle);

    this.slotList = document.createElement('div');
    this.slotList.className = 'v2-save-slot-list';
    card.appendChild(this.slotList);

    this.el.appendChild(card);
    parent.appendChild(this.el);
  }

  // Rebuild slot cards on every show so summaries reflect the latest saves.
  show(): void {
    this.slotList.replaceChildren();
    for (let i = 1; i <= Slots.SLOT_COUNT; i++) {
      this.slotList.appendChild(this._buildSlotCard(i));
    }
    this.el.classList.add('visible');
  }

  hide(): void { this.el.classList.remove('visible'); }

  private _buildSlotCard(slot: number): HTMLElement {
    const summary = Slots.getSummary(slot);
    const card = document.createElement('div');
    card.className = 'v2-save-slot-card';
    if (summary.empty) card.classList.add('empty');

    const header = document.createElement('div');
    header.className = 'v2-save-slot-header';

    const num = document.createElement('div');
    num.className   = 'v2-save-slot-num';
    num.textContent = `Slot ${slot}`;
    header.appendChild(num);

    const status = document.createElement('div');
    status.className   = 'v2-save-slot-status';
    status.textContent = summary.empty ? 'Empty' : 'In Progress';
    header.appendChild(status);

    card.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'v2-save-slot-meta';
    if (summary.empty) {
      meta.classList.add('empty');
      meta.textContent = '— No save data —';
    } else {
      const day    = `Day ${summary.day ?? 1}`;
      const cash   = `💰 ${fmtCash(summary.cash ?? 0)}`;
      const rating = summary.rating !== undefined ? `★ ${summary.rating.toFixed(1)}` : '★ —';
      const guests = summary.guests !== undefined ? `👥 ${summary.guests}/day` : '👥 —';
      meta.textContent = `${day} · ${cash} · ${rating} · ${guests}`;
    }
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'v2-save-slot-actions';

    if (!summary.empty) {
      const btnContinue = document.createElement('button');
      btnContinue.className   = 'v2-start-btn v2-start-btn-primary';
      btnContinue.textContent = 'Continue';
      btnContinue.onclick     = () => this._pickSlot(slot, /*fresh*/ false);
      actions.appendChild(btnContinue);
    }

    const btnNew = document.createElement('button');
    btnNew.className   = 'v2-start-btn';
    btnNew.textContent = summary.empty ? 'New Game' : 'Overwrite';
    btnNew.onclick     = () => {
      if (summary.empty) {
        this._pickSlot(slot, /*fresh*/ true);
      } else {
        this._confirmOverwrite(slot, () => this._pickSlot(slot, /*fresh*/ true));
      }
    };
    actions.appendChild(btnNew);

    if (!summary.empty) {
      const btnDelete = document.createElement('button');
      btnDelete.className   = 'v2-start-btn v2-start-btn-danger';
      btnDelete.textContent = 'Delete';
      btnDelete.onclick     = () => this._confirmDelete(slot, () => {
        Slots.deleteSlot(slot);
        // Re-render so the freed slot drops back to its empty state.
        this.show();
      });
      actions.appendChild(btnDelete);
    }

    card.appendChild(actions);
    return card;
  }

  private _pickSlot(slot: number, fresh: boolean): void {
    if (fresh) gameState.newGameInSlot(slot);
    else       gameState.loadSlot(slot);
    this.hide();
    this.onPicked();
  }

  private _confirmOverwrite(slot: number, onConfirm: () => void): void {
    this._showConfirm({
      title       : `Overwrite Slot ${slot}?`,
      body        : 'The existing save will be lost.',
      confirmLabel: 'Start New Game',
      onConfirm,
    });
  }

  private _confirmDelete(slot: number, onConfirm: () => void): void {
    this._showConfirm({
      title       : `Delete Slot ${slot}?`,
      body        : 'Saved progress will be permanently lost.',
      confirmLabel: 'Delete Save',
      onConfirm,
    });
  }

  private _showConfirm(opts: {
    title       : string;
    body        : string;
    confirmLabel: string;
    onConfirm   : () => void;
  }): void {
    const overlay = document.createElement('div');
    overlay.className = 'v2-modal-overlay interactive';

    const card = document.createElement('div');
    card.className = 'v2-modal-card';

    const title = document.createElement('div');
    title.className   = 'v2-modal-title';
    title.textContent = opts.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className   = 'v2-modal-body';
    body.textContent = opts.body;
    card.appendChild(body);

    const btnConfirm = document.createElement('button');
    btnConfirm.className   = 'v2-modal-btn v2-modal-btn-danger';
    btnConfirm.textContent = opts.confirmLabel;
    btnConfirm.onclick     = () => {
      overlay.remove();
      opts.onConfirm();
    };
    card.appendChild(btnConfirm);

    const btnCancel = document.createElement('button');
    btnCancel.className   = 'v2-modal-btn';
    btnCancel.textContent = 'Cancel';
    btnCancel.onclick     = () => overlay.remove();
    card.appendChild(btnCancel);

    overlay.appendChild(card);
    this.el.appendChild(overlay);
  }
}
