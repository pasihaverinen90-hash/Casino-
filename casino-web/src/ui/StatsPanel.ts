// StatsPanel.ts — full-screen overlay: Today summary + History charts.
import { gameState } from '../state/GameState';
import { ChartCard }  from './ChartCard';
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

  // Lifetime summary (History tab)
  private lifetimeBlock : HTMLElement;
  private lblTotalEarned: HTMLElement;
  private lblBestDay    : HTMLElement;
  private lblAvgRev     : HTMLElement;
  private lblDaysCount  : HTMLElement;
  private historyEmpty  : HTMLElement;
  private chartsWrap    : HTMLElement;

  // Charts
  private chartRevenue : ChartCard;
  private chartGuests  : ChartCard;
  private chartRating  : ChartCard;
  private chartOcc     : ChartCard;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel stats-panel hidden interactive';

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';
    this.titleEl = document.createElement('h3');
    this.titleEl.textContent = 'Reports';
    const btnClose = mkClose(() => this.close());
    titleRow.append(this.titleEl, btnClose);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    this.tab0 = mkTabBtn('Today',   true,  () => this._showTab(0));
    this.tab1 = mkTabBtn('History', false, () => this._showTab(1));
    tabBar.append(this.tab0, this.tab1);

    // ── Today panel ────────────────────────────────────────────────────────
    this.todayPanel = document.createElement('div');
    this.todayPanel.className = 'panel-scroll';

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

    // ── History panel ─────────────────────────────────────────────────────
    this.historyPanel = document.createElement('div');
    this.historyPanel.className = 'panel-scroll';
    this.historyPanel.style.display = 'none';

    this.lifetimeBlock = document.createElement('div');
    this.lifetimeBlock.appendChild(sectionHeader('LIFETIME'));
    this.lblTotalEarned = this.lifetimeBlock.appendChild(statRow(true));
    this.lblBestDay     = this.lifetimeBlock.appendChild(statRow());
    this.lblAvgRev      = this.lifetimeBlock.appendChild(statRow());
    this.lblDaysCount   = this.lifetimeBlock.appendChild(statRow());
    this.historyPanel.appendChild(this.lifetimeBlock);

    this.historyEmpty = document.createElement('div');
    this.historyEmpty.className = 'stats-empty';
    this.historyEmpty.textContent =
      'Daily charts appear after your first day ends.';
    this.historyPanel.appendChild(this.historyEmpty);

    this.chartsWrap = document.createElement('div');
    this.historyPanel.appendChild(this.chartsWrap);
    this.chartsWrap.appendChild(sectionHeader('DAILY METRICS'));

    this.chartRevenue = new ChartCard(this.chartsWrap, 'Revenue / Day',     '#e6b31a',
                                      v => `${fmtCash(v)} 💰`);
    this.chartGuests  = new ChartCard(this.chartsWrap, 'Guests / Day',      '#4dcc80',
                                      fmtInt);
    this.chartRating  = new ChartCard(this.chartsWrap, 'Resort Rating',     '#e66633',
                                      fmtRating);
    this.chartOcc     = new ChartCard(this.chartsWrap, 'Hotel Occupancy',   '#6699e6',
                                      v => `${Math.round(v)} %`);

    this.el.append(titleRow, tabBar, this.todayPanel, this.historyPanel);
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
    if (idx === 1) this._refreshCharts();
  }

  private _refresh(): void {
    this._refreshTitle();
    this._refreshToday();
    if (this.currentTab === 1) this._refreshCharts();
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

  private _refreshCharts(): void {
    const gs = gameState;
    const records = gs.statsRecords;
    const hasData = records.length > 0;

    // Lifetime summary
    if (hasData) {
      let total = 0;
      let best = records[0];
      for (const r of records) {
        total += r.revenue;
        if (r.revenue > best.revenue) best = r;
      }
      const avg = total / records.length;
      setRow(this.lblTotalEarned, 'Total earned', `${fmtCash(total)} 💰`);
      setRow(this.lblBestDay,     'Best day',     `${fmtCash(best.revenue)} 💰  (Day ${best.day})`);
      setRow(this.lblAvgRev,      'Avg revenue',  `${fmtCash(avg)} 💰 / day`);
      setRow(this.lblDaysCount,   'Days recorded', fmtInt(records.length));
    } else {
      setRow(this.lblTotalEarned, 'Total earned',  '—');
      setRow(this.lblBestDay,     'Best day',      '—');
      setRow(this.lblAvgRev,      'Avg revenue',   '—');
      setRow(this.lblDaysCount,   'Days recorded', '0');
    }

    // Empty state vs charts
    this.historyEmpty.style.display = hasData ? 'none' : '';
    this.chartsWrap.style.display   = hasData ? '' : 'none';

    if (!hasData) return;

    this.chartRevenue.draw(gs.chartRevenue,                 gs.chartDays);
    this.chartGuests.draw(gs.chartGuests,                   gs.chartDays);
    this.chartRating.draw(gs.chartRating,                   gs.chartDays);
    this.chartOcc.draw(gs.chartOccupancy.map(v => v * 100), gs.chartDays);
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
