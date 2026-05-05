// GameState.ts — port of GameState.gd
// Singleton game state. Mutates data and emits events. No UI imports.
import * as GC from '../logic/GameConstants';
import * as Sim from '../logic/Simulation';
import * as PV from '../logic/PlacementValidator';
import * as OV from '../logic/OperationalValidator';
import { EventEmitter } from './EventEmitter';
import * as Slots from './SaveSlots';

// ── Save schema ───────────────────────────────────────────────────────────
// Bump SAVE_VERSION when the on-disk schema changes and add an entry to
// SAVE_MIGRATIONS that upgrades the previous version's payload to the new
// shape. `normalizeSave` then fills in any newly-introduced fields with
// safe defaults so partial / hand-edited saves still load.
const SAVE_VERSION = '1.3.0';

interface SavedObj {
  id: string; type: GC.ObjType;
  col: number; row: number;
  rotated: boolean; variant: string;
}

interface SavePayload {
  ver         : string;
  day         : number;
  objects     : SavedObj[];
  room_count  : number;
  quality     : number;
  cash        : number;
  cumul       : number;
  last_guests : number;
  prev_crowding: number;
  next_id     : number;
  active_goal : number;
  completed   : boolean[];
  stats       : GC.DayStats[];
  ch_days     : number[];
  ch_guests   : number[];
  ch_rev      : number[];
  ch_rating   : number[];
  ch_occ      : number[];
  ch_cap      : number[];
}

// Each migration upgrades a payload one version forward. New entries are
// added when SAVE_VERSION is bumped.
const SAVE_MIGRATIONS: Record<string, (d: any) => any> = {
  // 1.1.0 → 1.2.0: introduced PATH/CASHIER object types. No payload-shape
  // change; the new types simply weren't present in older saves.
  '1.1.0': (d) => ({ ...d, ver: '1.2.0' }),
  // 1.2.0 → 1.3.0: PATH removed (open floor is now the walkable surface).
  // Strip any saved path objects and remap CASHIER's enum value 6 → 5,
  // which closes the gap left by removing PATH (was 5).
  '1.2.0': (d) => {
    const objects = Array.isArray(d.objects)
      ? d.objects
          .filter((o: any) => o && o.type !== 5) // drop PATH
          .map((o: any) => o.type === 6 ? { ...o, type: 5 } : o) // CASHIER 6→5
      : [];
    return { ...d, ver: '1.3.0', objects };
  },
};

function migrateSave(d: any): any | null {
  if (d == null || typeof d !== 'object' || typeof d.ver !== 'string') return null;
  let cur = d;
  // Walk the migration chain until we hit the current version. Cap iterations
  // so a malformed/cyclic chain can't hang the loader.
  for (let steps = 0; steps < 16 && cur.ver !== SAVE_VERSION; steps++) {
    const step = SAVE_MIGRATIONS[cur.ver];
    if (!step) return null;
    cur = step(cur);
  }
  return cur.ver === SAVE_VERSION ? cur : null;
}

function normalizeSave(d: any): SavePayload {
  // Defensive defaults — saves that pre-date a field still load.
  return {
    ver         : SAVE_VERSION,
    day         : d.day ?? 1,
    objects     : Array.isArray(d.objects) ? d.objects : [],
    room_count  : d.room_count ?? 0,
    quality     : d.quality ?? 1,
    cash        : d.cash ?? GC.STARTING_CASH,
    cumul       : d.cumul ?? 0,
    last_guests : d.last_guests ?? 0,
    prev_crowding: d.prev_crowding ?? 0,
    next_id     : d.next_id ?? 0,
    active_goal : d.active_goal ?? 0,
    completed   : Array.isArray(d.completed) ? d.completed : Array(10).fill(false),
    stats       : Array.isArray(d.stats)     ? d.stats     : [],
    ch_days     : Array.isArray(d.ch_days)   ? d.ch_days   : [],
    ch_guests   : Array.isArray(d.ch_guests) ? d.ch_guests : [],
    ch_rev      : Array.isArray(d.ch_rev)    ? d.ch_rev    : [],
    ch_rating   : Array.isArray(d.ch_rating) ? d.ch_rating : [],
    ch_occ      : Array.isArray(d.ch_occ)    ? d.ch_occ    : [],
    ch_cap      : Array.isArray(d.ch_cap)    ? d.ch_cap    : [],
  };
}

// UI-shaped read-only snapshot of "today". Decouples panels from internal
// field names and is the one place to add derived UI inputs (overlay data,
// variety bonus, etc.) without touching every panel.
export interface DaySnapshot {
  day              : number;
  cash             : number;
  rating           : number;
  totalGuests      : number;
  walkin           : number;
  hotelGuests      : number;
  capacity         : number;
  crowding         : number;
  occupancy        : number;
  bookedRooms      : number;
  roomCount        : number;
  qualityLevel     : number;
  cumulativeIncome : number;
  barExists        : boolean;
  lastDay          : GC.DayStats | null;
}

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
  // Physical counts — count of placed objects regardless of operational
  // status. Used by goals, BuildPanel "Already built", and placement gating.
  slotCount        = 0;
  smallTableCount  = 0;
  largeTableCount  = 0;
  wcCount          = 0;
  barExists        = false;
  cashierCount     = 0;
  // Functional counts — only objects whose open-floor adjacency passes.
  // Fed into Simulation so non-functional objects contribute nothing.
  funcSlot         = 0;
  funcSmall        = 0;
  funcLarge        = 0;
  funcWc           = 0;
  funcBarExists    = false;
  funcCashier      = 0;
  // Set of placed object ids that are currently functional. Recomputed
  // whenever placement, demolish, or load changes the world.
  functionalIds    : Set<string> = new Set();
  casinoCapacity   = 0;
  resortRating     = 1.75;
  totalGuests      = 0;
  walkinGuests     = 0;
  dailyRevenue     = 0;

  // Hourly drip plumbing. `_projection` is the full projected day given
  // current functional state, recomputed in `_recomputeDerived()`. The drip
  // pays out 1/24th of the projected daily revenue at every in-game hour
  // boundary and accumulates `_paidToday` so the day-end stats record what
  // was actually paid into cash (matches what the player saw on the HUD).
  private _projection: Sim.DayProjection | null = null;
  private _paidToday  = 0;

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

  // Active save slot (1..SLOT_COUNT). Null until the start screen picks one
  // and again after Return-to-Menu, so manual save() is a no-op outside an
  // active session.
  private _activeSlot: number | null = null;

  constructor() {
    super();
    // Build a default empty world so the grid renders behind the start screen.
    // Loading / new-game-into-slot is deferred until setActiveSlot is called.
    this._newGame();
  }

  // ── Slot lifecycle ────────────────────────────────────────────────────────

  getActiveSlot(): number | null { return this._activeSlot; }

  // Activate a slot and load its save. Returns true on success; if the slot
  // is empty or corrupt, falls back to a fresh game in that slot.
  loadSlot(slot: number): boolean {
    this._activeSlot = slot;
    Slots.setLastUsed(slot);
    const ok = this._tryLoad(Slots.slotKey(slot));
    if (!ok) this._newGame();
    this.emit('state_changed');
    return ok;
  }

  // Activate a slot and start a fresh game in it. Does not persist — the
  // slot's prior save is left in storage until the player presses Save.
  newGameInSlot(slot: number): void {
    this._activeSlot = slot;
    Slots.setLastUsed(slot);
    this._newGame();
    this.emit('state_changed');
  }

  // Manual save — wires to the current active slot. No-op before a slot
  // has been picked. Returns true on success.
  save(): boolean {
    if (this._activeSlot === null) return false;
    this._writeSave();
    return true;
  }

  // Detach the active slot without saving (used by "Return to Main Menu").
  clearActiveSlot(): void {
    this._activeSlot = null;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  private _newGame(): void {
    this.tiles = []; this.placedObjs = []; this._nextId = 0;
    this.cash = GC.STARTING_CASH; this.cumulativeIncome = 0;
    this.lastGuests = 0; this.prevCrowding = 0;
    this.slotCount = 0; this.smallTableCount = 0; this.largeTableCount = 0;
    this.wcCount = 0; this.barExists = false;
    this.cashierCount = 0;
    this.funcSlot = 0; this.funcSmall = 0; this.funcLarge = 0;
    this.funcWc = 0; this.funcBarExists = false; this.funcCashier = 0;
    this.functionalIds = new Set();
    this.casinoCapacity = 0; this.resortRating = 1.75;
    this.totalGuests = 0; this.walkinGuests = 0; this.dailyRevenue = 0;
    this.roomCount = 0; this.qualityLevel = 1;
    this.occupancyRate = 0; this.bookedRooms = 0; this.hotelGuests = 0;
    this.dayNumber = 1; this.activeGoal = 0;
    this.completedGoals = Array(10).fill(false);
    this._projection = null; this._paidToday = 0;
    this.statsRecords = [];
    this.chartDays = []; this.chartGuests = []; this.chartRevenue = [];
    this.chartRating = []; this.chartOccupancy = []; this.chartCapacity = [];
    this._buildGrid();
    this._recomputeDerived();
  }

  private _buildGrid(): void {
    // Layout:
    //   • Border walls all around.
    //   • Reception room: cols 15..20 × rows 19..22 (south end). The lobby
    //     range constants (LOBBY_START_COL / LOBBY_END_COL) still represent
    //     the columns of the south wall that contain the front entrance —
    //     wall-run validation uses them to keep the entrance from being
    //     walled off.
    //   • Two symmetric pillar clusters and one central island for floor
    //     interest. All open floor counts as walkable access space, so
    //     attractions just need at least one open-floor neighbour to work.
    this.tiles = [];
    for (let row = 0; row < GC.GRID_ROWS; row++) {
      for (let col = 0; col < GC.GRID_COLS; col++) {
        let tile_type: GC.TileType = GC.TileType.FLOOR;
        const isBorder = col === 0 || col === GC.GRID_COLS - 1
                      || row === 0 || row === GC.GRID_ROWS - 1;
        if (isBorder) {
          tile_type = GC.TileType.WALL;
        } else {
          const inLobby = col >= GC.LOBBY_START_COL && col <= GC.LOBBY_END_COL
                       && row >= 19 && row <= 22;
          if (inLobby) tile_type = GC.TileType.LOBBY;
        }
        this.tiles.push({ col, row, tile_type, obj_id: '' });
      }
    }
    // Pillar clusters and central island.
    this._markBlocked( 8, 8, 2, 2);
    this._markBlocked(26, 8, 2, 2);
    this._markBlocked(17, 11, 2, 2);
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
    const result = PV.validate(req, this.tiles, this.cash, this.barExists);
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
    this.emit('state_changed');
    return true;
  }

  // ── Hourly cash drip ──────────────────────────────────────────────────────

  // Called by TimeController at every in-game hour boundary. Pays out
  // 1/24th of the current projected daily revenue. Speed scales how often
  // hour boundaries fire, not the per-tick amount, so revenue is tied to
  // in-game time rather than wall-clock seconds. Cash stays a precise
  // number; rounding only happens for display.
  tickHour(): void {
    if (!this._projection) return;
    const inc = this._projection.revenue / 24;
    if (inc <= 0) return;
    this.cash             += inc;
    this.cumulativeIncome += inc;
    this._paidToday       += inc;
    this._checkGoals();
    this.emit('state_changed');
  }

  // ── Day rollover ──────────────────────────────────────────────────────────

  // Called by TimeController at each in-game day boundary. No cash
  // mutation here — that already happened during the drip. We only
  // bookkeep: write a stats record, update feedback terms, increment
  // dayNumber, and reset the per-day accumulator.
  endDay(): void {
    // Refresh projection so the recorded stats reflect the latest state.
    this._recomputeDerived();
    const p = this._projection!;
    // Scale the breakdown so it sums to what was actually paid this day.
    const scale = p.revenue > 0 ? this._paidToday / p.revenue : 0;
    const day_stats: GC.DayStats = {
      day          : this.dayNumber,
      total_guests : p.total_guests,
      walkin       : p.walkin,
      hotel_guests : p.hotel_guests,
      revenue      : this._paidToday,
      costs        : 0,
      net          : this._paidToday,
      cumulative   : this.cumulativeIncome,
      cash         : this.cash,
      slot_rev     : p.slot_rev  * scale,
      small_rev    : p.small_rev * scale,
      large_rev    : p.large_rev * scale,
      bar_rev      : p.bar_rev   * scale,
      hotel_rev    : p.hotel_rev * scale,
      occupancy    : p.occupancy,
      booked       : p.booked,
      capacity     : p.capacity,
      crowding     : p.crowding,
      rating       : p.rating,
    };
    this._appendStats(day_stats);

    this.lastGuests   = p.total_guests;
    this.prevCrowding = p.crowding;
    this.dailyRevenue = this._paidToday;
    this._paidToday   = 0;
    this.dayNumber++;

    // Re-project once more so subsequent drip uses fresh crowding/rating
    // feedback.
    this._recomputeDerived();
    this._checkGoals();
    this.emit('state_changed');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _updateCounts(): void {
    // Reset both physical and functional counts.
    this.slotCount = 0; this.smallTableCount = 0; this.largeTableCount = 0;
    this.wcCount = 0; this.barExists = false;
    this.cashierCount = 0;
    this.funcSlot = 0; this.funcSmall = 0; this.funcLarge = 0;
    this.funcWc = 0; this.funcBarExists = false; this.funcCashier = 0;

    this.functionalIds = OV.computeFunctionalIds(this.placedObjs, this.tiles);

    for (const obj of this.placedObjs) {
      const isFunc = this.functionalIds.has(obj.id);
      switch (obj.type) {
        case GC.ObjType.SLOT_MACHINE:
          this.slotCount++; if (isFunc) this.funcSlot++;
          break;
        case GC.ObjType.SMALL_TABLE:
          this.smallTableCount++; if (isFunc) this.funcSmall++;
          break;
        case GC.ObjType.LARGE_TABLE:
          this.largeTableCount++; if (isFunc) this.funcLarge++;
          break;
        case GC.ObjType.WC:
          this.wcCount++; if (isFunc) this.funcWc++;
          break;
        case GC.ObjType.BAR:
          this.barExists = true; if (isFunc) this.funcBarExists = true;
          break;
        case GC.ObjType.CASHIER:
          this.cashierCount++; if (isFunc) this.funcCashier++;
          break;
      }
    }
    // Capacity reflects functional attractions only — matches what the sim
    // sees and what's shown in the UI.
    this.casinoCapacity = Sim.calcCapacity(this.funcSlot, this.funcSmall, this.funcLarge);
  }

  private _recomputeDerived(): void {
    this._updateCounts();
    // Single source of truth — projectDay does crowding, rating, occupancy,
    // walk-in, and revenue in one shot. We then mirror its outputs into the
    // public fields the UI reads, and stash the projection for the drip.
    const p = Sim.projectDay({
      slots         : this.funcSlot,
      small_tables  : this.funcSmall,
      large_tables  : this.funcLarge,
      wc_count      : this.funcWc,
      bar_exists    : this.funcBarExists,
      cashier_count : this.funcCashier,
      room_count    : this.roomCount,
      quality_level : this.qualityLevel,
      last_guests   : this.lastGuests,
      prev_crowding : this.prevCrowding,
    });
    this._projection   = p;
    this.resortRating  = p.rating;
    this.occupancyRate = p.occupancy;
    this.bookedRooms   = p.booked;
    this.hotelGuests   = p.hotel_guests;
    // totalGuests/walkinGuests reflect the live projection — UI shows
    // a continuously-updating "guests/day" estimate, not a stale value.
    this.totalGuests   = p.total_guests;
    this.walkinGuests  = p.walkin;
    this.dailyRevenue  = p.revenue;
    this.casinoCapacity = p.capacity;
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

  // ── UI snapshot ───────────────────────────────────────────────────────────

  // Read-only view of "today" for UI consumption. UI code should prefer
  // this over reaching into individual fields, so adding derived values
  // (overlay inputs, variety bonus, …) requires changes in one place.
  getDaySnapshot(): DaySnapshot {
    const last = this.statsRecords.length > 0
      ? this.statsRecords[this.statsRecords.length - 1]
      : null;
    return {
      day              : this.dayNumber,
      cash             : this.cash,
      rating           : this.resortRating,
      totalGuests      : this.totalGuests,
      walkin           : this.walkinGuests,
      hotelGuests      : this.hotelGuests,
      capacity         : this.casinoCapacity,
      crowding         : this.prevCrowding,
      occupancy        : this.occupancyRate,
      bookedRooms      : this.bookedRooms,
      roomCount        : this.roomCount,
      qualityLevel     : this.qualityLevel,
      cumulativeIncome : this.cumulativeIncome,
      barExists        : this.barExists,
      lastDay          : last,
    };
  }

  // ── Save / Load ───────────────────────────────────────────────────────────

  private _serialize(): SavePayload {
    const objects: SavedObj[] = this.placedObjs.map(o => ({
      id: o.id, type: o.type, col: o.col, row: o.row,
      rotated: o.rotated, variant: o.variant,
    }));
    return {
      ver: SAVE_VERSION, day: this.dayNumber, objects,
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
  }

  private _writeSave(): void {
    if (this._activeSlot === null) return;
    try {
      localStorage.setItem(Slots.slotKey(this._activeSlot), JSON.stringify(this._serialize()));
    } catch { /* quota exceeded */ }
  }

  private _apply(d: SavePayload): void {
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
    // Costs are gone in this MVP. Rewrite historical records so the
    // displayed Net always equals Revenue, regardless of when the
    // save was created.
    for (const r of this.statsRecords) {
      r.costs = 0;
      r.net   = r.revenue;
    }
    this.chartDays      = d.ch_days;   this.chartGuests   = d.ch_guests;
    this.chartRevenue   = d.ch_rev;    this.chartRating   = d.ch_rating;
    this.chartOccupancy = d.ch_occ;    this.chartCapacity = d.ch_cap;

    for (const saved of d.objects) {
      const def = GC.getDef(saved.type);
      const w   = saved.rotated ? def.fh : def.fw;
      const h   = saved.rotated ? def.fw : def.fh;
      const fp  = PV.computeFootprint(saved.col, saved.row, w, h);
      const obj: GC.PlacedObj = {
        id: saved.id, type: saved.type,
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
  }

  private _tryLoad(key: string): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const migrated = migrateSave(parsed);
      if (!migrated) return false;
      this._apply(normalizeSave(migrated));
      return true;
    } catch {
      return false;
    }
  }

  resetGame(): void {
    if (this._activeSlot !== null) Slots.deleteSlot(this._activeSlot);
    this._newGame();
    this.emit('state_changed');
  }
}

// Singleton export
export const gameState = new GameState();
