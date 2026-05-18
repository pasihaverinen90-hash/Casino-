// StatsPanelV2.ts — V2 premium Reports panel.
//
// Mirrors V1 StatsPanel verbatim from a data perspective:
//   • Same `gameState.getDaySnapshot()` for "RIGHT NOW" + "YESTERDAY".
//   • Same `gameState.statsRecords` walk for lifetime totals + revenue
//     breakdown (Slots / Tables / Food & Drink / Services / Hotel) — the
//     groupings (keno + highstakes folded into Tables; buffet folded into
//     Food & Drink; atm + sportsbook into Services) match V1 line-for-line.
//   • Same 60-day chart arrays (gameState.chart*).
//   • Same `gameState.completedGoals` / `goalCompletedDays` / `GOAL_REWARDS`
//     / `GOAL_DESCS` for the goal status list.
//   • Read-only. No gameplay mutation.
//
// Visual chrome: right-side glass panel (mirrors HotelPanelV2/BuildPanelV2
// design language) with Today / History tabs. History contains four
// compact 60-day mini-charts (Revenue, Guests, Rating, Occupancy) plus
// lifetime totals, revenue breakdown, and the goals list.
//
// Public surface (open / close) matches V1 StatsPanel so main.ts can pick
// either via the structural-type ternary without rewiring keyboard
// shortcuts or BottomBar callbacks.
import * as GC from '../../logic/GameConstants';
import { gameState } from '../../state/GameState';
import { fmtCash, fmtInt, fmtPct, fmtRating } from '../../ui/format';

const CHART_HEIGHT_PX = 120;
const GOAL_COUNT      = 10;

interface ChartView {
  el      : HTMLElement;
  valueEl : HTMLElement;
  canvas  : HTMLCanvasElement;
  color   : string;
  fmt     : (v: number) => string;
}

export class StatsPanelV2 {
  private el      : HTMLElement;
  private titleEl : HTMLElement;
  private tabToday: HTMLButtonElement;
  private tabHist : HTMLButtonElement;
  private tabGoals: HTMLButtonElement;
  private paneToday: HTMLElement;
  private paneHist : HTMLElement;
  private paneGoals: HTMLElement;
  private body!    : HTMLElement;
  private currentTab = 0;

  // RIGHT NOW rows
  private rRating  : HTMLElement;
  private rGuests  : HTMLElement;
  private rWalkin  : HTMLElement;
  private rHotelG  : HTMLElement;
  private rCap     : HTMLElement;
  private rOcc     : HTMLElement;

  // YESTERDAY rows
  private yHeader  : HTMLElement;
  private yBlock   : HTMLElement;
  private yEmpty   : HTMLElement;
  private rYRev    : HTMLElement;
  private rYSlots  : HTMLElement;
  private rYTables : HTMLElement;
  private rYFood   : HTMLElement;
  private rYSvc    : HTMLElement;
  private rYHotel  : HTMLElement;
  private rYGuests : HTMLElement;
  private rYRating : HTMLElement;

  // LIFETIME rows
  private rLifeTotal     : HTMLElement;
  private rLifeDays      : HTMLElement;
  private rLifeGuestSum  : HTMLElement;
  private rLifeBestDay   : HTMLElement;
  private rLifeBestGuests: HTMLElement;
  private rLifeBestRating: HTMLElement;

  // Revenue breakdown rows
  private rBrkSlots  : HTMLElement;
  private rBrkTables : HTMLElement;
  private rBrkBar    : HTMLElement;
  private rBrkAtm    : HTMLElement;
  private rBrkHotel  : HTMLElement;

  // Charts
  private chartRev : ChartView;
  private chartGst : ChartView;
  private chartRat : ChartView;
  private chartOcc : ChartView;

  // Goals
  private goalRows: HTMLElement[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('aside');
    this.el.className = 'v2-stats-panel hidden interactive';

    // ── Header ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'v2-stats-header';

    this.titleEl = document.createElement('h3');
    this.titleEl.className   = 'v2-stats-title';
    this.titleEl.textContent = 'REPORTS';

    const btnClose = document.createElement('button');
    btnClose.className   = 'v2-stats-close';
    btnClose.type        = 'button';
    btnClose.textContent = '×';
    btnClose.title       = 'Close';
    btnClose.onclick     = () => this.close();

    header.append(this.titleEl, btnClose);

    // ── Tab bar ─────────────────────────────────────────────────────────
    const tabs = document.createElement('div');
    tabs.className = 'v2-stats-tabs';

    this.tabToday = _tabBtn('Today',   true,  () => this._showTab(0));
    this.tabHist  = _tabBtn('History', false, () => this._showTab(1));
    this.tabGoals = _tabBtn('Goals',   false, () => this._showTab(2));
    tabs.append(this.tabToday, this.tabHist, this.tabGoals);

    // ── Body (scrollable) ──────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'v2-stats-body';

    // Today pane
    this.paneToday = document.createElement('div');
    this.paneToday.className = 'v2-stats-pane';

    this.paneToday.appendChild(_sectionLabel('RIGHT NOW'));
    this.rRating = _statRow(this.paneToday);
    this.rGuests = _statRow(this.paneToday);
    this.rWalkin = _statRow(this.paneToday, false, true);
    this.rHotelG = _statRow(this.paneToday, false, true);
    this.rCap    = _statRow(this.paneToday);
    this.rOcc    = _statRow(this.paneToday);

    this.yHeader = _sectionLabel('YESTERDAY');
    this.paneToday.appendChild(this.yHeader);

    this.yBlock = document.createElement('div');
    this.paneToday.appendChild(this.yBlock);
    this.rYRev    = _statRow(this.yBlock, true);
    this.rYSlots  = _statRow(this.yBlock, false, true);
    this.rYTables = _statRow(this.yBlock, false, true);
    this.rYFood   = _statRow(this.yBlock, false, true);
    this.rYSvc    = _statRow(this.yBlock, false, true);
    this.rYHotel  = _statRow(this.yBlock, false, true);
    this.rYGuests = _statRow(this.yBlock);
    this.rYRating = _statRow(this.yBlock);

    this.yEmpty = document.createElement('div');
    this.yEmpty.className   = 'v2-stats-empty';
    this.yEmpty.textContent = 'First day in progress — results appear after Day 1 ends.';
    this.paneToday.appendChild(this.yEmpty);

    // History pane
    this.paneHist = document.createElement('div');
    this.paneHist.className = 'v2-stats-pane';
    this.paneHist.style.display = 'none';

    this.paneHist.appendChild(_sectionLabel('LIFETIME SUMMARY'));
    this.rLifeTotal      = _statRow(this.paneHist, true);
    this.rLifeDays       = _statRow(this.paneHist);
    this.rLifeGuestSum   = _statRow(this.paneHist);
    this.rLifeBestDay    = _statRow(this.paneHist);
    this.rLifeBestGuests = _statRow(this.paneHist);
    this.rLifeBestRating = _statRow(this.paneHist);

    this.paneHist.appendChild(_sectionLabel('CHARTS — LAST 60 DAYS'));
    this.chartRev = _chartCard(this.paneHist, 'Revenue',   '#e8c462', v => `${fmtCash(v)} 💰`);
    this.chartGst = _chartCard(this.paneHist, 'Guests',    '#6ad985', v => fmtInt(v));
    this.chartRat = _chartCard(this.paneHist, 'Rating',    '#e6b31a', v => `★ ${fmtRating(v)}`);
    this.chartOcc = _chartCard(this.paneHist, 'Occupancy', '#6cdac0', v => fmtPct(v));

    this.paneHist.appendChild(_sectionLabel('REVENUE BREAKDOWN'));
    this.rBrkSlots  = _statRow(this.paneHist);
    this.rBrkTables = _statRow(this.paneHist);
    this.rBrkBar    = _statRow(this.paneHist);
    this.rBrkAtm    = _statRow(this.paneHist);
    this.rBrkHotel  = _statRow(this.paneHist);

    // Goals pane (split out of History in Phase 8E.1 — same data source).
    this.paneGoals = document.createElement('div');
    this.paneGoals.className = 'v2-stats-pane';
    this.paneGoals.style.display = 'none';

    this.paneGoals.appendChild(_sectionLabel('GOALS'));
    const goalsList = document.createElement('div');
    goalsList.className = 'v2-goals-list';
    for (let i = 0; i < GOAL_COUNT; i++) {
      const row = document.createElement('div');
      row.className = 'v2-goal-summary';
      goalsList.appendChild(row);
      this.goalRows.push(row);
    }
    this.paneGoals.appendChild(goalsList);

    body.append(this.paneToday, this.paneHist, this.paneGoals);

    // Pin header + tabs by wrapping them in a non-scrolling top container.
    // Without this, tall body content (charts + many rows) could push the
    // header out of the visible area when overflow rules race with flex
    // shrinking — the wrapper gives a hard split: top stays, body scrolls.
    const top = document.createElement('div');
    top.className = 'v2-stats-top';
    top.append(header, tabs);

    this.el.append(top, body);
    parent.appendChild(this.el);
    this.body = body;

    // Same contract as V1: only repaint while visible.
    gameState.on('state_changed', () => {
      if (!this.el.classList.contains('hidden')) this._refresh();
    });
    // Charts re-measure their width on resize so they stay sharp.
    window.addEventListener('resize', () => {
      if (!this.el.classList.contains('hidden') && this.currentTab === 1) {
        this._redrawCharts();
      }
    });
  }

  open(): void {
    this._showTab(0);
    this._refresh();
    this.el.classList.remove('hidden');
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _showTab(idx: number): void {
    this.currentTab = idx;
    this.tabToday.classList.toggle('active', idx === 0);
    this.tabHist .classList.toggle('active', idx === 1);
    this.tabGoals.classList.toggle('active', idx === 2);
    this.paneToday.style.display = idx === 0 ? '' : 'none';
    this.paneHist .style.display = idx === 1 ? '' : 'none';
    this.paneGoals.style.display = idx === 2 ? '' : 'none';
    // Reset scroll so the player always lands at the top of the active
    // tab — keeps the section headers visible immediately under the tabs.
    if (this.body) this.body.scrollTop = 0;
    // Canvas widths read offsetWidth → must be measured while the parent
    // is visible. Defer the redraw to the next frame so layout has settled.
    if (idx === 1) requestAnimationFrame(() => this._redrawCharts());
  }

  private _refresh(): void {
    const s = gameState.getDaySnapshot();
    this.titleEl.textContent = `REPORTS — DAY ${s.day}`;
    this._refreshToday();
    this._refreshHistory();
    if (this.currentTab === 1) this._redrawCharts();
  }

  private _refreshToday(): void {
    const s    = gameState.getDaySnapshot();
    const last = s.lastDay;

    _setRow(this.rRating, 'Rating',          `★ ${fmtRating(s.rating)}`);
    _setRow(this.rGuests, 'Guests today',    fmtInt(s.totalGuests));
    _setRow(this.rWalkin, 'Walk-in',         fmtInt(s.walkin));
    _setRow(this.rHotelG, 'Hotel',           fmtInt(s.hotelGuests));
    _setRow(this.rCap,    'Casino capacity', fmtInt(s.capacity));
    _setRow(this.rOcc,    'Hotel occupancy', fmtPct(s.occupancy));

    if (!last) {
      this.yHeader.textContent = 'YESTERDAY';
      this.yBlock.style.display = 'none';
      this.yEmpty.style.display = '';
      return;
    }
    this.yHeader.textContent = `YESTERDAY (DAY ${last.day})`;
    this.yBlock.style.display = '';
    this.yEmpty.style.display = 'none';

    // Same grouping rules as V1 StatsPanel._refreshToday — Tables folds
    // small + large + keno + highstakes; Food & Drink folds bar + buffet;
    // Services folds atm + sportsbook. Legacy records may lack any of the
    // newer fields — `?? 0` covers them.
    const tables    = last.small_rev + last.large_rev
                    + (last.keno_rev       ?? 0)
                    + (last.highstakes_rev ?? 0);
    const foodDrink = last.bar_rev + (last.buffet_rev     ?? 0);
    const services  = (last.atm_rev ?? 0) + (last.sportsbook_rev ?? 0);

    _setRow(this.rYRev,    'Revenue',      `${fmtCash(last.revenue)} 💰`);
    _setRow(this.rYSlots,  'Slots',        `${fmtCash(last.slot_rev)} 💰`);
    _setRow(this.rYTables, 'Tables',       `${fmtCash(tables)} 💰`);
    _setRow(this.rYFood,   'Food & Drink', `${fmtCash(foodDrink)} 💰`);
    _setRow(this.rYSvc,    'Services',     `${fmtCash(services)} 💰`);
    _setRow(this.rYHotel,  'Hotel rooms',  `${fmtCash(last.hotel_rev)} 💰`);
    _setRow(this.rYGuests, 'Guests',       fmtInt(last.total_guests));
    _setRow(this.rYRating, 'Rating',       `★ ${fmtRating(last.rating)}`);
  }

  private _refreshHistory(): void {
    const records = gameState.statsRecords;
    const hasData = records.length > 0;

    // Lifetime totals — match V1 calculation exactly.
    let total = 0, totalGuests = 0;
    let best = records[0], bestG = records[0], bestR = records[0];
    for (const r of records) {
      total       += r.revenue;
      totalGuests += r.total_guests;
      if (r.revenue      > best.revenue)     best  = r;
      if (r.total_guests > bestG.total_guests) bestG = r;
      if (r.rating       > bestR.rating)     bestR = r;
    }

    _setRow(this.rLifeTotal,     'Total earned',         hasData ? `${fmtCash(total)} 💰` : '—');
    _setRow(this.rLifeDays,      'Days recorded',        hasData ? fmtInt(records.length) : '0');
    _setRow(this.rLifeGuestSum,  'Total guests served',  hasData ? fmtInt(totalGuests) : '—');
    _setRow(this.rLifeBestDay,
            'Best day revenue',
            hasData ? `${fmtCash(best.revenue)} 💰  (Day ${best.day})` : '—');
    _setRow(this.rLifeBestGuests,
            'Highest guests / day',
            hasData ? `${fmtInt(bestG.total_guests)}  (Day ${bestG.day})` : '—');
    _setRow(this.rLifeBestRating,
            'Highest rating',
            hasData ? `★ ${fmtRating(bestR.rating)}  (Day ${bestR.day})` : '—');

    // Revenue breakdown — same Phase N1/N2 groupings as V1.
    let sumSlot = 0, sumTables = 0, sumFood = 0, sumSvc = 0, sumHotel = 0;
    for (const r of records) {
      sumSlot   += r.slot_rev;
      sumTables += r.small_rev + r.large_rev
                 + (r.keno_rev       ?? 0)
                 + (r.highstakes_rev ?? 0);
      sumFood   += r.bar_rev + (r.buffet_rev     ?? 0);
      sumSvc    += (r.atm_rev ?? 0) + (r.sportsbook_rev ?? 0);
      sumHotel  += r.hotel_rev;
    }
    _setRow(this.rBrkSlots,  'Slots',        hasData ? `${fmtCash(sumSlot)} 💰`   : '—');
    _setRow(this.rBrkTables, 'Tables',       hasData ? `${fmtCash(sumTables)} 💰` : '—');
    _setRow(this.rBrkBar,    'Food & Drink', hasData ? `${fmtCash(sumFood)} 💰`   : '—');
    _setRow(this.rBrkAtm,    'Services',     hasData ? `${fmtCash(sumSvc)} 💰`    : '—');
    _setRow(this.rBrkHotel,  'Hotel rooms',  hasData ? `${fmtCash(sumHotel)} 💰`  : '—');

    // Goals
    for (let i = 0; i < GOAL_COUNT; i++) {
      const row    = this.goalRows[i];
      const done   = gameState.completedGoals[i] === true;
      const day    = gameState.goalCompletedDays[i];
      const reward = GC.GOAL_REWARDS[i];
      const desc   = GC.GOAL_DESCS[i];
      row.classList.toggle('done', done);
      row.classList.toggle('open', !done);
      const status = done
        ? (day != null ? `Day ${day}` : 'Completed')
        : 'Not completed';

      row.innerHTML = '';
      const icon = document.createElement('span');
      icon.className   = 'v2-goal-summary-icon';
      icon.textContent = done ? '✓' : '○';
      const name = document.createElement('span');
      name.className   = 'v2-goal-summary-name';
      name.textContent = `${i + 1}. ${desc}`;
      const meta = document.createElement('span');
      meta.className   = 'v2-goal-summary-meta';
      meta.textContent = `${status} — +${fmtCash(reward)} 💰`;
      row.append(icon, name, meta);
    }
  }

  private _redrawCharts(): void {
    const days = gameState.chartDays;
    _drawChart(this.chartRev, gameState.chartRevenue,   days);
    _drawChart(this.chartGst, gameState.chartGuests,    days);
    _drawChart(this.chartRat, gameState.chartRating,    days);
    _drawChart(this.chartOcc, gameState.chartOccupancy, days);
  }
}

// ── Local DOM helpers (V2-scoped) ─────────────────────────────────────────

function _tabBtn(label: string, active: boolean, cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type      = 'button';
  b.className = 'v2-stats-tab' + (active ? ' active' : '');
  b.textContent = label;
  b.onclick   = cb;
  return b;
}

function _sectionLabel(text: string): HTMLElement {
  const d = document.createElement('div');
  d.className   = 'v2-stats-section';
  d.textContent = text;
  return d;
}

function _statRow(parent: HTMLElement, bold = false, indent = false): HTMLElement {
  const d = document.createElement('div');
  d.className = 'v2-stats-row' + (bold ? ' bold' : '') + (indent ? ' indent' : '');
  parent.appendChild(d);
  return d;
}

function _setRow(row: HTMLElement, label: string, value: string): void {
  row.innerHTML = '';
  const k = document.createElement('span');
  k.className   = 'k';
  k.textContent = label;
  const v = document.createElement('span');
  v.className   = 'v';
  v.textContent = value;
  row.append(k, v);
}

function _chartCard(
  parent  : HTMLElement,
  label   : string,
  color   : string,
  fmt     : (v: number) => string,
): ChartView {
  const card = document.createElement('div');
  card.className = 'v2-chart-card';

  const head = document.createElement('div');
  head.className = 'v2-chart-head';

  const lbl = document.createElement('div');
  lbl.className   = 'v2-chart-label';
  lbl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className   = 'v2-chart-value';
  valueEl.textContent = '—';
  valueEl.style.color = color;

  head.append(lbl, valueEl);

  const canvas = document.createElement('canvas');
  canvas.className = 'v2-chart-canvas';
  canvas.height    = CHART_HEIGHT_PX;

  card.append(head, canvas);
  parent.appendChild(card);

  return { el: card, valueEl, canvas, color, fmt };
}

function _drawChart(view: ChartView, values: number[], days: number[]): void {
  const canvas = view.canvas;
  const ctx    = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.offsetWidth || 320;
  const h = CHART_HEIGHT_PX;
  if (canvas.width !== w) canvas.width = w;

  ctx.clearRect(0, 0, w, h);
  // Dark glass background to match V2 chrome.
  ctx.fillStyle = 'rgba(10, 8, 14, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(160, 120, 32, 0.30)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  view.valueEl.textContent = values.length > 0
    ? view.fmt(values[values.length - 1])
    : '—';

  if (values.length === 0) {
    ctx.fillStyle = 'rgba(232, 196, 98, 0.45)';
    ctx.font      = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet.', w / 2, h / 2);
    return;
  }

  const mTop    = 14;
  const mBottom = 22;
  const mSide   = 10;
  const cW      = w - mSide * 2;
  const cH      = h - mTop - mBottom;

  // Faint horizontal gridline through the middle for visual anchoring.
  ctx.strokeStyle = 'rgba(160, 120, 32, 0.15)';
  ctx.beginPath();
  ctx.moveTo(mSide, mTop + cH / 2);
  ctx.lineTo(w - mSide, mTop + cH / 2);
  ctx.stroke();

  if (values.length === 1) {
    const cx = mSide + cW / 2;
    const cy = mTop  + cH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = view.color;
    ctx.fill();
  } else {
    let yMax = Math.max(...values) * 1.2;
    if (yMax < 1) yMax = 1;

    // Glow under the line so it reads against the dark glass.
    ctx.strokeStyle = view.color;
    ctx.lineWidth   = 1.8;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    values.forEach((v, i) => {
      const nx = i / (values.length - 1);
      const ny = 1 - v / yMax;
      const x  = mSide + nx * cW;
      const y  = mTop  + ny * cH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  if (days.length > 0) {
    ctx.fillStyle = 'rgba(232, 196, 98, 0.55)';
    ctx.font      = '10px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Day ${days[0]}`, mSide, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText(`Day ${days[days.length - 1]}`, w - mSide, h - 6);
  }
}
