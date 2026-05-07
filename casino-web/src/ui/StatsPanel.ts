// StatsPanel.ts — full-screen overlay: Today summary + History (text report).
//
// Structure:
//   .panel.stats-panel              (flex column, fixed height)
//     .panel-title                  (shared title + close, pinned)
//     .tab-bar                      (shared tab buttons, pinned)
//     .tab-content                  (single scroll container, flex:1)
//       .tab-pane.today             (visible / hidden)
//       .tab-pane.history           (visible / hidden)
//
// History was a chart panel through 1.4.x; for the MVP it has been
// replaced with a clearer text-based Lifetime Report (summary, revenue
// breakdown by source, goals list).
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';
import { fmtCash, fmtInt, fmtPct, fmtRating } from './format';

export class StatsPanel {
  private el          : HTMLElement;
  private titleEl     : HTMLElement;
  private todayPanel  : HTMLElement;
  private historyPanel: HTMLElement;
  private tab0        : HTMLButtonElement;
  private tab1        : HTMLButtonElement;
  private currentTab  = 0;

  // RIGHT NOW rows
  private lblRating  : HTMLElement;
  private lblGuests  : HTMLElement;
  private lblWalkin  : HTMLElement;
  private lblHotelG  : HTMLElement;
  private lblCapacity: HTMLElement;
  private lblOcc     : HTMLElement;

  // YESTERDAY rows
  private yesterdayHeader: HTMLElement;
  private yesterdayBlock : HTMLElement;
  private emptyYesterday : HTMLElement;
  private lblYRev    : HTMLElement;
  private lblYSlots  : HTMLElement;
  private lblYTables : HTMLElement;
  private lblYBar    : HTMLElement;
  private lblYHotel  : HTMLElement;
  private lblYGuests : HTMLElement;
  private lblYRating : HTMLElement;

  // History — Lifetime Summary
  private lblLifeTotal     : HTMLElement;
  private lblLifeDays      : HTMLElement;
  private lblLifeGuestSum  : HTMLElement;
  private lblLifeBestDay   : HTMLElement;
  private lblLifeBestGuests: HTMLElement;
  private lblLifeBestRating: HTMLElement;

  // History — Revenue Breakdown
  private lblBrkSlots : HTMLElement;
  private lblBrkSmall : HTMLElement;
  private lblBrkLarge : HTMLElement;
  private lblBrkBar   : HTMLElement;
  private lblBrkHotel : HTMLElement;

  // History — Goals
  private goalsList: HTMLElement;
  private goalRows : HTMLElement[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel stats-panel hidden interactive';

    // Shared title row
    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';
    this.titleEl = document.createElement('h3');
    this.titleEl.textContent = 'Reports';
    const btnClose = mkClose(() => this.close());
    titleRow.append(this.titleEl, btnClose);

    // Shared tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    this.tab0 = mkTabBtn('Today',   true,  () => this._showTab(0));
    this.tab1 = mkTabBtn('History', false, () => this._showTab(1));
    tabBar.append(this.tab0, this.tab1);

    // Single scroll container so the title and tab bar stay pinned even
    // when History content is taller than the viewport.
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';

    // ── Today pane ────────────────────────────────────────────────────────
    this.todayPanel = document.createElement('div');
    this.todayPanel.className = 'tab-pane';

    this.todayPanel.appendChild(sectionHeader('RIGHT NOW'));
    this.lblRating   = this.todayPanel.appendChild(statRow());
    this.lblGuests   = this.todayPanel.appendChild(statRow());
    this.lblWalkin   = this.todayPanel.appendChild(statRow(false, true));
    this.lblHotelG   = this.todayPanel.appendChild(statRow(false, true));
    this.lblCapacity = this.todayPanel.appendChild(statRow());
    this.lblOcc      = this.todayPanel.appendChild(statRow());

    this.yesterdayHeader = this.todayPanel.appendChild(sectionHeader('YESTERDAY'));
    this.yesterdayBlock  = document.createElement('div');
    this.todayPanel.appendChild(this.yesterdayBlock);
    this.lblYRev     = this.yesterdayBlock.appendChild(statRow(true));
    this.lblYSlots   = this.yesterdayBlock.appendChild(statRow(false, true));
    this.lblYTables  = this.yesterdayBlock.appendChild(statRow(false, true));
    this.lblYBar     = this.yesterdayBlock.appendChild(statRow(false, true));
    this.lblYHotel   = this.yesterdayBlock.appendChild(statRow(false, true));
    this.lblYGuests  = this.yesterdayBlock.appendChild(statRow());
    this.lblYRating  = this.yesterdayBlock.appendChild(statRow());

    this.emptyYesterday = document.createElement('div');
    this.emptyYesterday.className = 'stats-empty';
    this.emptyYesterday.textContent =
      'First day in progress — results appear after Day 1 ends.';
    this.todayPanel.appendChild(this.emptyYesterday);

    // ── History pane ──────────────────────────────────────────────────────
    this.historyPanel = document.createElement('div');
    this.historyPanel.className = 'tab-pane';
    this.historyPanel.style.display = 'none';

    this.historyPanel.appendChild(sectionHeader('LIFETIME SUMMARY'));
    this.lblLifeTotal      = this.historyPanel.appendChild(statRow(true));
    this.lblLifeDays       = this.historyPanel.appendChild(statRow());
    this.lblLifeGuestSum   = this.historyPanel.appendChild(statRow());
    this.lblLifeBestDay    = this.historyPanel.appendChild(statRow());
    this.lblLifeBestGuests = this.historyPanel.appendChild(statRow());
    this.lblLifeBestRating = this.historyPanel.appendChild(statRow());

    this.historyPanel.appendChild(sectionHeader('REVENUE BREAKDOWN'));
    this.lblBrkSlots = this.historyPanel.appendChild(statRow());
    this.lblBrkSmall = this.historyPanel.appendChild(statRow());
    this.lblBrkLarge = this.historyPanel.appendChild(statRow());
    this.lblBrkBar   = this.historyPanel.appendChild(statRow());
    this.lblBrkHotel = this.historyPanel.appendChild(statRow());

    this.historyPanel.appendChild(sectionHeader('GOALS'));
    this.goalsList = document.createElement('div');
    this.goalsList.className = 'goals-list';
    this.historyPanel.appendChild(this.goalsList);
    for (let i = 0; i < 10; i++) {
      const row = document.createElement('div');
      row.className = 'goal-summary';
      this.goalsList.appendChild(row);
      this.goalRows.push(row);
    }

    tabContent.append(this.todayPanel, this.historyPanel);
    this.el.append(titleRow, tabBar, tabContent);
    parent.appendChild(this.el);

    gameState.on('state_changed', () => {
      if (!this.el.classList.contains('hidden')) this._refresh();
    });
  }

  open(): void {
    this._showTab(0);
    this._refresh();
    this.el.classList.remove('hidden');
  }

  close(): void { this.el.classList.add('hidden'); }

  private _showTab(idx: number): void {
    this.currentTab = idx;
    this.tab0.classList.toggle('active', idx === 0);
    this.tab1.classList.toggle('active', idx === 1);
    this.todayPanel.style.display   = idx === 0 ? '' : 'none';
    this.historyPanel.style.display = idx === 1 ? '' : 'none';
  }

  private _refresh(): void {
    this._refreshTitle();
    this._refreshToday();
    this._refreshHistory();
  }

  private _refreshTitle(): void {
    const s = gameState.getDaySnapshot();
    this.titleEl.textContent = `Reports — Day ${s.day}`;
  }

  private _refreshToday(): void {
    const s    = gameState.getDaySnapshot();
    const last = s.lastDay;

    setRow(this.lblRating,   'Rating',          `★ ${fmtRating(s.rating)}`);
    setRow(this.lblGuests,   'Guests today',    fmtInt(s.totalGuests));
    setRow(this.lblWalkin,   'Walk-in',         fmtInt(s.walkin));
    setRow(this.lblHotelG,   'Hotel',           fmtInt(s.hotelGuests));
    setRow(this.lblCapacity, 'Casino capacity', fmtInt(s.capacity));
    setRow(this.lblOcc,      'Hotel occupancy', fmtPct(s.occupancy));

    if (!last) {
      this.yesterdayHeader.textContent = 'YESTERDAY';
      this.yesterdayBlock.style.display = 'none';
      this.emptyYesterday.style.display = '';
      return;
    }

    this.yesterdayHeader.textContent = `YESTERDAY (DAY ${last.day})`;
    this.yesterdayBlock.style.display = '';
    this.emptyYesterday.style.display = 'none';

    setRow(this.lblYRev,    'Revenue',     `${fmtCash(last.revenue)} 💰`);
    setRow(this.lblYSlots,  'Slots',       `${fmtCash(last.slot_rev)} 💰`);
    setRow(this.lblYTables, 'Tables',      `${fmtCash(last.small_rev + last.large_rev)} 💰`);
    setRow(this.lblYBar,    'Bar',         `${fmtCash(last.bar_rev)} 💰`);
    setRow(this.lblYHotel,  'Hotel rooms', `${fmtCash(last.hotel_rev)} 💰`);
    setRow(this.lblYGuests, 'Guests',      fmtInt(last.total_guests));
    setRow(this.lblYRating, 'Rating',      `★ ${fmtRating(last.rating)}`);
  }

  private _refreshHistory(): void {
    const records = gameState.statsRecords;
    const hasData = records.length > 0;

    // ── Lifetime Summary ─────────────────────────────────────────────────
    let total = 0, totalGuests = 0;
    let best = records[0], bestGuests = records[0], bestRating = records[0];
    for (const r of records) {
      total       += r.revenue;
      totalGuests += r.total_guests;
      if (r.revenue      > best.revenue)            best        = r;
      if (r.total_guests > bestGuests.total_guests) bestGuests  = r;
      if (r.rating       > bestRating.rating)       bestRating  = r;
    }

    setRow(this.lblLifeTotal,    'Total earned',   hasData ? `${fmtCash(total)} 💰` : '—');
    setRow(this.lblLifeDays,     'Days recorded',  hasData ? fmtInt(records.length) : '0');
    setRow(this.lblLifeGuestSum, 'Total guests served', hasData ? fmtInt(totalGuests) : '—');
    setRow(this.lblLifeBestDay,
           'Best day revenue',
           hasData ? `${fmtCash(best.revenue)} 💰  (Day ${best.day})` : '—');
    setRow(this.lblLifeBestGuests,
           'Highest guests / day',
           hasData ? `${fmtInt(bestGuests.total_guests)}  (Day ${bestGuests.day})` : '—');
    setRow(this.lblLifeBestRating,
           'Highest rating',
           hasData ? `★ ${fmtRating(bestRating.rating)}  (Day ${bestRating.day})` : '—');

    // ── Revenue Breakdown ────────────────────────────────────────────────
    let sumSlot = 0, sumSmall = 0, sumLarge = 0, sumBar = 0, sumHotel = 0;
    for (const r of records) {
      sumSlot  += r.slot_rev;
      sumSmall += r.small_rev;
      sumLarge += r.large_rev;
      sumBar   += r.bar_rev;
      sumHotel += r.hotel_rev;
    }
    setRow(this.lblBrkSlots, 'Slots',        hasData ? `${fmtCash(sumSlot)} 💰`  : '—');
    setRow(this.lblBrkSmall, 'Small tables', hasData ? `${fmtCash(sumSmall)} 💰` : '—');
    setRow(this.lblBrkLarge, 'Large tables', hasData ? `${fmtCash(sumLarge)} 💰` : '—');
    setRow(this.lblBrkBar,   'Bar',          hasData ? `${fmtCash(sumBar)} 💰`   : '—');
    setRow(this.lblBrkHotel, 'Hotel rooms',  hasData ? `${fmtCash(sumHotel)} 💰` : '—');

    // ── Goals ────────────────────────────────────────────────────────────
    for (let i = 0; i < 10; i++) {
      const row     = this.goalRows[i];
      const done    = gameState.completedGoals[i] === true;
      const day     = gameState.goalCompletedDays[i];
      const reward  = GC.GOAL_REWARDS[i];
      const desc    = GC.GOAL_DESCS[i];
      row.classList.toggle('done', done);
      row.classList.toggle('open', !done);

      const status = done
        ? (day != null ? `Day ${day}` : 'Completed')
        : 'Not completed';

      row.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'goal-summary-icon';
      icon.textContent = done ? '✓' : '○';
      const name = document.createElement('span');
      name.className = 'goal-summary-name';
      name.textContent = `${i + 1}. ${desc}`;
      const meta = document.createElement('span');
      meta.className = 'goal-summary-meta';
      meta.textContent = `${status} — +${fmtCash(reward)} 💰`;
      row.append(icon, name, meta);
    }
  }
}

function mkClose(cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'panel-close'; b.textContent = '✕'; b.onclick = cb;
  b.setAttribute('aria-label', 'Close');
  return b;
}
function mkTabBtn(label: string, active: boolean, cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'tab-btn' + (active ? ' active' : '');
  b.textContent = label;
  b.onclick = cb;
  return b;
}
function statRow(bold = false, indent = false): HTMLElement {
  const d = document.createElement('div');
  d.className = 'stat-row' + (bold ? ' bold' : '') + (indent ? ' indent' : '');
  return d;
}
function sectionHeader(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'stat-row header'; d.textContent = text;
  return d;
}
function setRow(row: HTMLElement, label: string, value: string): void {
  row.innerHTML = '';
  const l = document.createElement('span'); l.className = 'k'; l.textContent = label;
  const v = document.createElement('span'); v.className = 'v'; v.textContent = value;
  row.append(l, v);
}
