// objectiveDetail.ts — shared "tap an active objective, see details" modal.
//
// Emits V2-native class names (.v2-modal-* / .v2-event-section-*).
// Use sites:
//   • ChallengeTicker._showDetails  — challenge + boost details
//   • V2 GoalTicker callback (openActiveGoalDetail) — single active-goal detail

/** Open a detail modal. Click-outside dismisses; Close button dismisses. */
export function openObjectiveDetail(host: HTMLElement, title: string, body: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'v2-modal-overlay interactive';

  const card = document.createElement('div');
  card.className = 'v2-modal-card';

  const titleEl = document.createElement('div');
  titleEl.className   = 'v2-modal-title';
  titleEl.textContent = title;
  card.appendChild(titleEl);

  body.classList.add('v2-modal-body', 'v2-modal-body-detail');
  card.appendChild(body);

  const btnClose = document.createElement('button');
  btnClose.className   = 'v2-modal-btn';
  btnClose.textContent = 'Close';
  btnClose.onclick     = () => overlay.remove();
  card.appendChild(btnClose);

  // Click outside the card dismisses; clicking the card itself does not.
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.appendChild(card);
  host.appendChild(overlay);
}

/** Label + single-line text section. */
export function section(label: string, text: string): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'v2-event-section';
  const l = document.createElement('div');
  l.className   = 'v2-event-section-label';
  l.textContent = label;
  const t = document.createElement('div');
  t.className   = 'v2-event-section-text';
  t.textContent = text;
  sec.append(l, t);
  return sec;
}

/** Label + bulleted list section. */
export function listSection(label: string, items: string[]): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'v2-event-section';
  const l = document.createElement('div');
  l.className   = 'v2-event-section-label';
  l.textContent = label;
  const ul = document.createElement('ul');
  ul.className = 'v2-event-section-list';
  for (const i of items) {
    const li = document.createElement('li');
    li.textContent = i;
    ul.appendChild(li);
  }
  sec.append(l, ul);
  return sec;
}

/** Label + a thin progress bar. `pct` is clamped 0..1. */
export function progressSection(label: string, pct: number, valueText?: string): HTMLElement {
  const clamped = Math.max(0, Math.min(1, pct));
  const sec = document.createElement('div');
  sec.className = 'v2-event-section';

  const l = document.createElement('div');
  l.className   = 'v2-event-section-label';
  l.textContent = label;
  sec.appendChild(l);

  if (valueText) {
    const t = document.createElement('div');
    t.className   = 'v2-event-section-text';
    t.textContent = valueText;
    sec.appendChild(t);
  }

  const bar = document.createElement('div');
  bar.className = 'v2-event-section-progress';
  const fill = document.createElement('div');
  fill.className     = 'v2-event-section-progress-fill';
  fill.style.width   = `${Math.round(clamped * 100)}%`;
  bar.appendChild(fill);
  sec.appendChild(bar);

  return sec;
}
