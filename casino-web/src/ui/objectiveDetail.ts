// objectiveDetail.ts — shared "tap an active objective, see details" modal.
//
// Originally lived as private helpers inside ChallengeTicker (V1). Phase
// 8E.4 extracts the same shape so V2's GoalTicker click can reuse the
// exact panel design — title / sections / Close — without duplicating the
// modal scaffolding. Same .modal-overlay / .modal-card / .modal-title /
// .modal-btn / .event-section* CSS classes V1 used: V1 styles them via
// style.css, V2 restyles them via `.v2-root <selector>` in styleV2.css.
//
// Use sites:
//   • ChallengeTicker._showDetails  — challenge + boost details (V1 + V2)
//   • main.ts V2 GoalTicker callback — single active-goal detail (V2 only)

/** Open a detail modal. Click-outside dismisses; Close button dismisses. */
export function openObjectiveDetail(host: HTMLElement, title: string, body: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay interactive';

  const card = document.createElement('div');
  card.className = 'modal-card';

  const titleEl = document.createElement('div');
  titleEl.className   = 'modal-title';
  titleEl.textContent = title;
  card.appendChild(titleEl);

  body.classList.add('modal-body', 'event-details');
  card.appendChild(body);

  const btnClose = document.createElement('button');
  btnClose.className   = 'modal-btn';
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
  sec.className = 'event-section';
  const l = document.createElement('div');
  l.className   = 'event-section-label';
  l.textContent = label;
  const t = document.createElement('div');
  t.className   = 'event-section-text';
  t.textContent = text;
  sec.append(l, t);
  return sec;
}

/** Label + bulleted list section. */
export function listSection(label: string, items: string[]): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'event-section';
  const l = document.createElement('div');
  l.className   = 'event-section-label';
  l.textContent = label;
  const ul = document.createElement('ul');
  ul.className = 'event-section-list';
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
  sec.className = 'event-section';

  const l = document.createElement('div');
  l.className   = 'event-section-label';
  l.textContent = label;
  sec.appendChild(l);

  if (valueText) {
    const t = document.createElement('div');
    t.className   = 'event-section-text';
    t.textContent = valueText;
    sec.appendChild(t);
  }

  const bar = document.createElement('div');
  bar.className = 'event-section-progress';
  const fill = document.createElement('div');
  fill.className     = 'event-section-progress-fill';
  fill.style.width   = `${Math.round(clamped * 100)}%`;
  bar.appendChild(fill);
  sec.appendChild(bar);

  return sec;
}
