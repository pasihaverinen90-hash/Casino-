// StatsPanel.ts — full-screen overlay: Today summary + History charts.
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';
import { ChartCard }  from './ChartCard';

export class StatsPanel {
  private el          : HTMLElement;
  private todayPanel  : HTMLElement;
  private historyPanel: HTMLElement;
  private tab0        : HTMLButtonElement;
  private tab1        : HTMLButtonElement;
  private currentTab  = 0;

  // Today labels
  private lblDay     : HTMLElement;
  private lblRating  : HTMLElement;
  private lblGuests  : HTMLElement;
  private lblWalkin  : HTMLElement;
  private lblHotelG  : HTMLElement;
  private lblCapacity: HTMLElement;
  private lblCrowding: HTMLElement;
  private lblSlotRev : HTMLElement;
  private lblTblRev  : HTMLElement;
  private lblBarRev  : HTMLElement;
  private lblHotelRev: HTMLElement;
  private lblTotalRev: HTMLElement;
  private lblUpkeep  : HTMLElement;
  private lblNet     : HTMLElement;
  private lblCumul   : HTMLElement;

  // Charts
  private chartGuests  : ChartCard;
  private chartRevenue : ChartCard;
  private chartRating  : ChartCard;
  private chartOcc     : ChartCard;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'panel stats-panel hidden interactive';

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'panel-title';
    const title = document.createElement('h3');
    title.textContent = 'STATS';
    const btnClose = mkClose(() => this.close());
    titleRow.append(title, btnClose);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    this.tab0 = mkTabBtn('Today',   true,  () => this._showTab(0));
    this.tab1 = mkTabBtn('History', false, () => this._showTab(1));
    tabBar.append(this.tab0, this.tab1);

    // Today panel
    this.todayPanel = document.createElement('div');
    this.todayPanel.className = 'panel-scroll';
    this.lblDay      = this.todayPanel.appendChild(statRow());
    this.lblRating   = this.todayPanel.appendChild(statRow());
    this.lblGuests   = this.todayPanel.appendChild(statRow());
    this.lblWalkin   = this.todayPanel.appendChild(statRow());
    this.lblHotelG   = this.todayPanel.appendChild(statRow());
    this.lblCapacity = this.todayPanel.appendChild(statRow());
    this.lblCrowding = this.todayPanel.appendChild(statRow());
    this.todayPanel.appendChild(separator());
    this.todayPanel.appendChild(sectionHeader('REVENUE'));
    this.lblSlotRev  = this.todayPanel.appendChild(statRow());
    this.lblTblRev   = this.todayPanel.appendChild(statRow());
    this.lblBarRev   = this.todayPanel.appendChild(statRow());
    this.lblHotelRev = this.todayPanel.appendChild(statRow());
    this.todayPanel.appendChild(separator());
    this.lblTotalRev = this.todayPanel.appendChild(statRow(true));
    // Upkeep row is hidden in this MVP — costs will return with real
    // staff/operations systems. Element kept so existing refresh code
    // can write into it without conditional branches.
    this.lblUpkeep   = this.todayPanel.appendChild(statRow());
    this.lblUpkeep.style.display = 'none';
    this.lblNet      = this.todayPanel.appendChild(statRow(true));
    this.lblCumul    = this.todayPanel.appendChild(statRow(true));

    // History panel — one card per daily metric. Cards record one point per
    // completed in-game day, so the panel populates as days roll over.
    this.historyPanel = document.createElement('div');
    this.historyPanel.className = 'panel-scroll';
    this.historyPanel.style.display = 'none';
    this.historyPanel.appendChild(sectionHeader('DAILY METRICS'));

    this.chartRevenue = new ChartCard(this.historyPanel, 'Revenue / Day',     '#e6b31a');
    this.chartGuests  = new ChartCard(this.historyPanel, 'Guests / Day',      '#4dcc80');
    this.chartRating  = new ChartCard(this.historyPanel, 'Resort Rating',     '#e66633');
    this.chartOcc     = new ChartCard(this.historyPanel, 'Hotel Occupancy %', '#6699e6');

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
    this._refreshToday();
    if (this.currentTab === 1) this._refreshCharts();
  }

  private _refreshToday(): void {
    const s    = gameState.getDaySnapshot();
    const last = s.lastDay;

    this.lblDay.textContent      = `Day ${s.day} Summary`;
    this.lblRating.textContent   = `Resort Rating    ${s.rating.toFixed(1)}`;
    this.lblGuests.textContent   = `Total Guests     ${s.totalGuests}/day`;
    this.lblWalkin.textContent   = `  Walk-in        ${s.walkin}`;
    this.lblHotelG.textContent   = `  Hotel          ${s.hotelGuests}`;
    this.lblCapacity.textContent = `Casino Capacity  ${s.capacity}`;
    this.lblCrowding.textContent = `Crowding         ${s.crowding.toFixed(2)}`;

    if (!last) {
      this.lblSlotRev.textContent  = 'Slots            —';
      this.lblTblRev.textContent   = 'Tables           —';
      this.lblBarRev.textContent   = 'Bar              —';
      this.lblHotelRev.textContent = 'Hotel Rooms      —';
      this.lblTotalRev.textContent = 'Total Revenue    —';
      this.lblUpkeep.textContent   = 'Upkeep           —';
      this.lblNet.textContent      = 'Net              —';
    } else {
      this.lblSlotRev.textContent  = `Slots            ${last.slot_rev} 💰`;
      this.lblTblRev.textContent   = `Tables           ${last.small_rev + last.large_rev} 💰`;
      this.lblBarRev.textContent   = `Bar              ${last.bar_rev} 💰`;
      this.lblHotelRev.textContent = `Hotel Rooms      ${last.hotel_rev} 💰`;
      this.lblTotalRev.textContent = `Total Revenue    ${last.revenue} 💰`;
      this.lblUpkeep.textContent   = `Upkeep           −${last.costs} 💰`;
      this.lblNet.textContent      = `Net              ${last.net >= 0 ? '+' : ''}${last.net} 💰`;
    }
    this.lblCumul.textContent = `Total Earned     ${s.cumulativeIncome.toLocaleString()} 💰  (goal: ${GC.GOAL_TARGETS.income.toLocaleString()})`;
  }

  private _refreshCharts(): void {
    const gs = gameState;
    this.chartGuests.draw(gs.chartGuests,                    gs.chartDays);
    this.chartRevenue.draw(gs.chartRevenue,                  gs.chartDays);
    this.chartRating.draw(gs.chartRating,                    gs.chartDays);
    this.chartOcc.draw(gs.chartOccupancy.map(v => v * 100),  gs.chartDays);
  }
}

function mkClose(cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'panel-close'; b.textContent = '✕'; b.onclick = cb;
  return b;
}
function mkTabBtn(label: string, active: boolean, cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'tab-btn' + (active ? ' active' : '');
  b.textContent = label;
  b.onclick = cb;
  return b;
}
function statRow(bold = false): HTMLElement {
  const d = document.createElement('div');
  d.className = 'stat-row';
  if (bold) d.style.fontWeight = '600';
  return d;
}
function separator(): HTMLElement {
  const hr = document.createElement('hr');
  hr.style.cssText = 'border:none;border-top:1px solid #1a1f2a;margin:8px 0';
  return hr;
}
function sectionHeader(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'stat-row header'; d.textContent = text;
  return d;
}
