// GameState.ts — port of GameState.gd
// Singleton game state. Mutates data and emits events. No UI imports.
import * as GC from '../logic/GameConstants';
import * as Sim from '../logic/Simulation';
import * as PV from '../logic/PlacementValidator';
import { EventEmitter } from './EventEmitter';

const SAVE_KEY = 'casino_resort_v1';

class GameState extends EventEmitter {
  // Map
  tiles      : GC.Tile[]      = [];
  placedObjs : GC.PlacedObj[] = [];
  private _nextId = 0;

  // Economy
  cash             = GC.STARTING_CASH;
  cumulativeIncome = 0;
  lastGuests       = 0;
  prevCrowding     = 0.0;
  slotCount        = 0;
  smallTableCount  = 0;
  largeTableCount  = 0;
  wcCount          = 0;
  barExists        = false;
  casinoCapacity   = 0;
  resortRating     = 1.75;
  totalGuests      = 0;
  walkinGuests     = 0;
  dailyRevenue     = 0;

  // Hotel
  roomCount    = 0;
  qualityLevel = 1;
  occupancyRate = 0.0;
  bookedRooms  = 0;
  hotelGuests  = 0;

  // Progression
  dayNumber      = 1;
  activeGoal     = 0;
  completedGoals : boolean[] = [];

  // Stats history
  statsRecords  : GC.DayStats[] = [];
  chartDays     : number[] = [];
  chartGuests   : number[] = [];
  chartRevenue  : number[] = [];
  chartRating   : number[] = [];
  chartOccupancy: number[] = [];
  chartCapacity : number[] = [];

  constructor() {
    super();
    if (!this._tryLoad()) this._newGame();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  private _newGame(): void {
    this.tiles = []; this.placedObjs = []; this._nextId = 0;
    this.cash = GC.STARTING_CASH; this.cumulativeIncome = 0;
    this.lastGuests = 0; this.prevCrowding = 0;
    this.slotCount = 0; this.smallTableCount = 0; this.largeTableCount = 0;
    this.wcCount = 0; this.barExists = false;
    this.casinoCapacity = 0; this.resortRating = 1.75;
    this.totalGuests = 0; this.walkinGuests = 0; this.dailyRevenue = 0;
    this.roomCount = 0; this.qualityLevel = 1;
    this.occupancyRate = 0; this.bookedRooms = 0; this.hotelGuests = 0;
    this.dayNumber = 1; this.activeGoal = 0;
    this.completedGoals = Array(10).fill(false);
    this.statsRecords = [];
    this.chartDays = []; this.chartGuests = []; this.chartRevenue = [];
    this.chartRating = []; this.chartOccupancy = []; this.chartCapacity = [];
    this._buildGrid();
    this._recomputeDerived();
  }

  private _buildGrid(): void {
    this.tiles = [];
    for (let row = 0; row < GC.GRID_ROWS; row++) {
      for (let col = 0; col < GC.GRID_COLS; col++) {
        let tile_type: GC.TileType = GC.TileType.FLOOR;
        if (col === 0 || col === GC.GRID_COLS - 1 || row === 0 || row === GC.GRID_ROWS - 1)
          tile_type = GC.TileType.WALL;
        else if (col >= GC.LOBBY_START_COL && col <= GC.LOBBY_END_COL)
          tile_type = GC.TileType.LOBBY;
        this.tiles.push({ col, row, tile_type, obj_id: '' });
      }
    }
    this._markBlocked(17, 8,  3, 2);
    this._markBlocked(14, 11, 2, 1);
    this._markBlocked(21, 11, 2, 1);
    this._markBlocked(16, 22, 4, 1);
  }

  private _markBlocked(col: number, row: number, w: number, h: number): void {
    for (let r = row; r < row + h; r++)
      for (let c = col; c < col + w; c++)
        if (c >= 0 && c < GC.GRID_COLS && r >= 0 && r < GC.GRID_ROWS)
          this.tiles[r * GC.GRID_COLS + c].tile_type = GC.TileType.BLOCKED;
  }

  // ── Place object ──────────────────────────────────────────────────────────

  tryPlace(col: number, row: number, objType: GC.ObjType, rotated: boolean, variant = ''): boolean {
    const req = { type: objType, col, row, rotated };
    const result = PV.validate(req, this.tiles, this.placedObjs, this.cash, this.barExists);
    if (result !== GC.ValResult.VALID) {
      this.emit('placement_failed', GC.valMessage(result));
      return false;
    }

    const def = GC.getDef(objType);
    const w   = rotated ? def.fh : def.fw;
    const h   = rotated ? def.fw : def.fh;
    const fp  = PV.computeFootprint(col, row, w, h);
    const id  = `obj_${this._nextId++}`;

    const obj: GC.PlacedObj = { id, type: objType, col, row, rotated, variant, tiles: fp, w, h };
    this.placedObjs.push(obj);
    for (const coord of fp) this.tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = id;

    this.cash -= def.cost;
    this._updateCounts();
    this._checkGoals();
    this._save();
    this.emit('state_changed');
    return true;
  }

  // ── Demolish ──────────────────────────────────────────────────────────────

  demolish(objId: string): void {
    const idx = this.placedObjs.findIndex(o => o.id === objId);
    if (idx === -1) return;

    const obj    = this.placedObjs[idx];
    const def    = GC.getDef(obj.type);
    const refund = Math.floor(def.cost * GC.DEMOLISH_REFUND);

    for (const coord of obj.tiles) this.tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = '';
    this.placedObjs.splice(idx, 1);

    this.cash += refund;
    this._updateCounts();
    this._checkGoals();
    this._save();
    this.emit('state_changed');
    this.emit('toast_requested', `Demolished. +${refund} cash`);
  }

  // ── Hotel actions ─────────────────────────────────────────────────────────

  buyRooms(roomsToAdd: number, cost: number): boolean {
    if (this.cash < cost) { this.emit('toast_requested', 'Not enough cash.'); return false; }
    this.cash -= cost;
    this.roomCount += roomsToAdd;
    this._recomputeDerived();
    this._checkGoals();
    this._save();
    this.emit('state_changed');
    return true;
  }

  upgradeQuality(): boolean {
    if (this.qualityLevel >= 3) return false;
    const costs = [0, 2000, 4000];
    const cost  = costs[this.qualityLevel];
    if (this.cash < cost) { this.emit('toast_requested', 'Not enough cash.'); return false; }
    this.cash -= cost;
    this.qualityLevel++;
    this._recomputeDerived();
    this._checkGoals();
    this._save();
    this.emit('state_changed');
    return true;
  }

  // ── Advance day ───────────────────────────────────────────────────────────

  advanceDay(): void {
    const s: Sim.DayInput = {
      slots: this.slotCount, small_tables: this.smallTableCount,
      large_tables: this.largeTableCount, wc_count: this.wcCount,
      bar_exists: this.barExists, room_count: this.roomCount,
      quality_level: this.qualityLevel, cash: this.cash,
      cumulative_income: this.cumulativeIncome,
      last_guests: this.lastGuests, prev_crowding: this.prevCrowding,
      day_number: this.dayNumber,
    };
    const r = Sim.runDay(s);

    this.cash            = r.new_cash;
    this.cumulativeIncome = r.new_cumul;
    this.lastGuests      = r.new_last_guests;
    this.prevCrowding    = r.crowding;
    this.resortRating    = r.rating;
    this.casinoCapacity  = r.capacity;
    this.totalGuests     = r.total_guests;
    this.walkinGuests    = r.walkin;
    this.dailyRevenue    = r.net;
    this.occupancyRate   = r.occupancy;
    this.bookedRooms     = r.booked;
    this.hotelGuests     = r.hotel_guests;

    this._appendStats(r.day_stats);
    this.dayNumber++;
    this._checkGoals();
    this._save();
    this.emit('state_changed');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _updateCounts(): void {
    this.slotCount = 0; this.smallTableCount = 0; this.largeTableCount = 0;
    this.wcCount = 0; this.barExists = false;
    for (const obj of this.placedObjs) {
      if      (obj.type === GC.ObjType.SLOT_MACHINE) this.slotCount++;
      else if (obj.type === GC.ObjType.SMALL_TABLE)  this.smallTableCount++;
      else if (obj.type === GC.ObjType.LARGE_TABLE)  this.largeTableCount++;
      else if (obj.type === GC.ObjType.WC)           this.wcCount++;
      else if (obj.type === GC.ObjType.BAR)          this.barExists = true;
    }
    this.casinoCapacity = Sim.calcCapacity(this.slotCount, this.smallTableCount, this.largeTableCount);
  }

  private _recomputeDerived(): void {
    this._updateCounts();
    const crowding = Sim.calcCrowding(this.lastGuests, this.casinoCapacity, this.prevCrowding);
    this.resortRating = Sim.calcRating(
      this.slotCount, this.smallTableCount, this.largeTableCount,
      this.wcCount, this.barExists,
      this.roomCount, this.qualityLevel, crowding,
    );
    const hotel = Sim.calcOccupancy(this.roomCount, this.qualityLevel, this.resortRating);
    this.occupancyRate = hotel.rate;
    this.bookedRooms   = hotel.booked;
    this.hotelGuests   = hotel.hotel_guests;
  }

  private _appendStats(ds: GC.DayStats): void {
    this.statsRecords.push(ds);
    if (this.statsRecords.length > GC.HISTORY_MAX) this.statsRecords.shift();
    const trim = (arr: number[], val: number) => { arr.push(val); if (arr.length > GC.HISTORY_MAX) arr.shift(); };
    trim(this.chartDays,      ds.day);
    trim(this.chartGuests,    ds.total_guests);
    trim(this.chartRevenue,   ds.revenue);
    trim(this.chartRating,    ds.rating);
    trim(this.chartOccupancy, ds.occupancy);
    trim(this.chartCapacity,  ds.capacity);
  }

  // ── Goal checking ─────────────────────────────────────────────────────────

  private _checkGoals(): void {
    if (this.activeGoal >= 10) return;
    if (!this._isGoalMet(this.activeGoal)) return;
    const idx    = this.activeGoal;
    this.completedGoals[idx] = true;
    this.activeGoal++;
    const reward = GC.GOAL_REWARDS[idx];
    this.cash += reward;
    this.emit('goal_completed', { index: idx, reward });
    if (this.activeGoal >= 10) this.emit('game_complete');
    else this._checkGoals(); // cascade
  }

  private _isGoalMet(idx: number): boolean {
    const T = GC.GOAL_TARGETS;
    switch (idx) {
      case 0: return this.slotCount        >= T.slots;
      case 1: return this.totalGuests      >= T.guests_first;
      case 2: return this.wcCount          >= 1;
      case 3: return this.smallTableCount  >= 1;
      case 4: return this.resortRating     >= T.rating;
      case 5: return this.cumulativeIncome >= T.income;
      case 6: return this.roomCount        >= T.rooms;
      case 7: return this.totalGuests      >= T.guests_busy;
      case 8: return this.qualityLevel     >= T.quality;
      case 9: return this.barExists;
    }
    return false;
  }

  getGoalProgress(idx: number): number {
    const T = GC.GOAL_TARGETS;
    switch (idx) {
      case 0: return Math.min(1, this.slotCount        / T.slots);
      case 1: return Math.min(1, this.totalGuests      / T.guests_first);
      case 2: return this.wcCount          >= 1 ? 1 : 0;
      case 3: return this.smallTableCount  >= 1 ? 1 : 0;
      case 4: return Math.min(1, this.resortRating     / T.rating);
      case 5: return Math.min(1, this.cumulativeIncome / T.income);
      case 6: return Math.min(1, this.roomCount        / T.rooms);
      case 7: return Math.min(1, this.totalGuests      / T.guests_busy);
      case 8: return this.qualityLevel     >= T.quality ? 1 : 0;
      case 9: return this.barExists ? 1 : 0;
    }
    return 0;
  }

  // ── Save / Load ───────────────────────────────────────────────────────────

  private _save(): void {
    const saveObjs = this.placedObjs.map(o => ({
      id: o.id, type: o.type, col: o.col, row: o.row,
      rotated: o.rotated, variant: o.variant,
    }));
    const data = {
      ver: '1.1.0', day: this.dayNumber,
      objects: saveObjs,
      room_count: this.roomCount, quality: this.qualityLevel,
      cash: this.cash, cumul: this.cumulativeIncome,
      last_guests: this.lastGuests, prev_crowding: this.prevCrowding,
      next_id: this._nextId,
      active_goal: this.activeGoal, completed: this.completedGoals,
      stats: this.statsRecords,
      ch_days: this.chartDays, ch_guests: this.chartGuests,
      ch_rev: this.chartRevenue, ch_rating: this.chartRating,
      ch_occ: this.chartOccupancy, ch_cap: this.chartCapacity,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* quota exceeded */ }
  }

  private _tryLoad(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.ver !== '1.1.0') return false;

      this._newGame();

      this.dayNumber        = d.day;
      this.roomCount        = d.room_count;
      this.qualityLevel     = d.quality;
      this.cash             = d.cash;
      this.cumulativeIncome = d.cumul;
      this.lastGuests       = d.last_guests;
      this.prevCrowding     = d.prev_crowding;
      this._nextId          = d.next_id;
      this.activeGoal       = d.active_goal;
      this.completedGoals   = d.completed;
      this.statsRecords     = d.stats;
      this.chartDays        = d.ch_days;   this.chartGuests   = d.ch_guests;
      this.chartRevenue     = d.ch_rev;    this.chartRating   = d.ch_rating;
      this.chartOccupancy   = d.ch_occ;    this.chartCapacity = d.ch_cap;

      for (const saved of d.objects) {
        const def = GC.getDef(saved.type as GC.ObjType);
        const w   = saved.rotated ? def.fh : def.fw;
        const h   = saved.rotated ? def.fw : def.fh;
        const fp  = PV.computeFootprint(saved.col, saved.row, w, h);
        const obj: GC.PlacedObj = {
          id: saved.id, type: saved.type as GC.ObjType,
          col: saved.col, row: saved.row,
          rotated: saved.rotated, variant: saved.variant,
          tiles: fp, w, h,
        };
        this.placedObjs.push(obj);
        for (const coord of fp)
          this.tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = saved.id;
      }

      this._recomputeDerived();
      this._checkGoals();
      return true;
    } catch {
      return false;
    }
  }

  resetGame(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this._newGame();
    this.emit('state_changed');
  }
}

// Singleton export
export const gameState = new GameState();
