// GameConstants.ts — direct port of GameConstants.gd

export const GRID_COLS       = 36;
export const GRID_ROWS       = 24;
export const LOBBY_START_COL = 15;
export const LOBBY_END_COL   = 20;

export const STARTING_CASH   = 22500;
export const HISTORY_MAX     = 60;
export const DEMOLISH_REFUND = 0.5;

export const RATING_BASE     = 1.50;
export const RATING_MIN      = 1.0;
export const RATING_MAX      = 5.0;
export const CROWDING_SMOOTH = 0.4;

// ── Rating V2 ────────────────────────────────────────────────────────────────
// Replaces V1's flat additive formula with a 0–100 internal score across six
// weighted categories, mapped to the existing 1.0–5.0 range:
//   rating = clamp(1.0 + (score / 100) × 4.0, 1.0, 5.0)
// Each category is hard-capped, so spamming a single object type can no longer
// dominate. Crowding is folded into the capacity pillar (no separate term on
// the final rating). RATING_BASE above is V1 and is no longer read by Rating
// V2; it stays exported to avoid touching unrelated callers. ObjDef.rating /
// ratingPer are likewise still on metadata but are NOT summed by V2 — the
// rules below own the full computation.
export const RATING_WEIGHTS = {
  variety  : 25,
  comfort  : 25,
  prestige : 15,
  capacity : 15,
  hotel    : 10,
  finance  : 10,
} as const;

// Slots are tiny (cap 1 each), so ≥3 are required before "slots" counts as a
// present gambling type. Every other gambling type counts at ≥1.
export const VARIETY_SLOT_THRESHOLD = 3;

// target_S = max(1, capacity / divisor_S). adequacy_S = min(1, count_S / target_S).
// Bar uses a flat target of 1 (it's max:1 anyway). Tuned so a casino at the
// BASE_DEMAND capacity (30) needs roughly 1.2 WCs / 1 cashier / 0.75 ATM /
// 0.6 buffet to saturate each service type's adequacy.
export const COMFORT_TARGET_DIVISORS = {
  wc      : 25,
  cashier : 30,
  atm     : 40,
  buffet  : 50,
} as const;

// Per-type prestige multipliers: sqrt(count) × coeff yields diminishing
// returns within a type while keeping the first unit of each one impactful.
// HS Table is highest (1 HS = +3 prestige) so late-game premium feels real.
export const PRESTIGE_COEFF = {
  largeTable : 1.5,
  keno       : 2.0,
  highStakes : 3.0,
  sportsbook : 2.0,
  qualityLvl : 1.0,
} as const;

// Finance pillar saturates at these values — full per-half pool above either.
export const FINANCE_TARGETS = {
  dailyRevenue     : 1_500,
  cumulativeIncome : 50_000,
} as const;

// Hotel pillar — room count saturates here; quality and occupancy fill rest.
export const HOTEL_TARGETS = {
  rooms : 12,
} as const;

// Capacity sub-score plateau. Same value as BASE_DEMAND below so the rating
// pillar plateau aligns with calcWalkin's capacity multiplier cap.
export const CAPACITY_DEMAND_BASELINE = 30;

// Rating V2.1 — crowding effect on the Capacity pillar. V2.0 used a 2.0
// multiplier with no floor, which let an otherwise excellent casino drop
// Capacity to near-zero once hotel-driven crowding pushed prevCrowding
// above ~0.5. V2.1 softens the slope (1.25 instead of 2.0) and adds a
// 0.35 floor so severe crowding still hurts but cannot collapse the pillar.
export const RATING_CAPACITY_CROWDING_MULTIPLIER = 1.25;
export const RATING_CAPACITY_CROWDING_FLOOR      = 0.35;

// ── Random Challenges V1 ─────────────────────────────────────────────────────
// V1 ships one manually-triggered challenge (Slot Machine Promotion) plus the
// minimal scaffolding for future random scheduling. State lives on GameState
// (activeChallenge / activeBoost) and persists across saves with safe
// defaults — old saves load with both fields null and no SAVE_VERSION bump.
export type ChallengeId = 'slot_promotion';
export type BoostId     = 'slot_revenue_boost';

export interface ActiveChallenge {
  id          : ChallengeId;
  startedDay  : number;
  // Challenge fails the first time dayNumber > deadlineDay (so completing on
  // the deadline day itself still counts).
  deadlineDay : number;
  progress    : number;
  target      : number;
}

export interface ActiveBoost {
  id         : BoostId;
  multiplier : number;
  // Boost is active while dayNumber < expiresDay. Completed on day 5 with
  // a 3-day reward → expiresDay = 8 → active during days 5, 6, 7.
  expiresDay : number;
}

// Slot Promotion tuning. The reward multiplier applies to slot revenue only;
// REV_SLOT itself stays untouched.
export const SLOT_PROMOTION_TARGET        = 5;
export const SLOT_PROMOTION_DURATION_DAYS = 3;
export const SLOT_PROMOTION_REWARD_MULT   = 1.25;
export const SLOT_PROMOTION_REWARD_DAYS   = 3;

export const BASE_DEMAND     = 30;

export const REV_SLOT        = 13;
export const REV_SMALL_TABLE = 22;
export const REV_LARGE_TABLE = 30;
export const REV_BAR         = 6;
export const REV_ATM         = 5;
export const REV_BUFFET      = 10;
export const REV_SPORTSBOOK  = 28;
export const REV_KENO        = 22;
export const REV_HIGH_STAKES = 50;
export const REV_PER_ROOM    = 24;
export const BAR_DRAW_RATE   = 0.15;
// Per-ATM share of guests who pull cash on a given day. Capped at 1.0
// total in calcRevenue so a casino with many ATMs can't generate more
// ATM visits than there are guests.
export const ATM_DRAW_PER_UNIT = 0.10;
// Per-Buffet / per-Sportsbook share of guests on a given day. Same
// capped pattern as ATM: total share is min(1, count × rate) so adding
// more units yields diminishing returns and never exceeds total guests.
export const BUFFET_DRAW_RATE     = 0.18;
export const SPORTSBOOK_DRAW_RATE = 0.10;
// Phase N2 — Keno Lounge / High-Stakes Table follow the same capped
// per-unit share model rather than feeding the slots-vs-tables capacity
// partition. Keeps the existing partition untouched while still scaling
// new content with guest traffic. High-Stakes uses the lowest rate of
// any object so single units feel premium and rare.
export const KENO_DRAW_RATE        = 0.10;
export const HIGH_STAKES_DRAW_RATE = 0.06;

// Daily upkeep per object. Disabled in this MVP — costs will return later
// once real staff/operations systems exist.
export const UPKEEP_SLOT        = 0;
export const UPKEEP_SMALL_TABLE = 0;
export const UPKEEP_LARGE_TABLE = 0;
export const UPKEEP_WC          = 0;
export const UPKEEP_BAR         = 0;
export const UPKEEP_PER_ROOM    = 0;

// Auto-progression: one in-game day = this many real seconds at speed 1×.
// 96s × 96 quarter-hour ticks = 1s per 15-minute step at 1× = 1 in-game hour
// every 4 real seconds.
export const DAY_DURATION_SEC = 96;

// Numeric thresholds for the four progression goals that use scalar targets.
// Goals 0/2/3/8/9 are presence checks and stay hard-coded in GameState.
export const GOAL_TARGETS = {
  slots         : 3,
  guests_first  : 45,
  rating        : 2.0,
  income        : 9_000,
  rooms         : 8,
  guests_busy   : 85,
  quality       : 2,
} as const;

export const GOAL_REWARDS = [500, 800, 600, 1200, 1000, 1500, 1000, 2000, 1500, 3000];
// One-shot bonus when every goal is complete and the player enters endless
// mode. Awarded exactly once per save; persisted via the endless_unlocked flag.
export const ENDLESS_BONUS = 25_000;

// Progression / Unlocks V1 — Phase U1.
// Object types that are buildable from the moment a new game starts. Anything
// outside this set is locked until a goal whose GOAL_UNLOCKS entry names it
// is completed.
//
// Unlock state is *derived* (not persisted) — see GameState.isUnlocked. Both
// inputs already round-trip through saves: STARTING_UNLOCKS is static code
// and `completedGoals` is part of the existing save payload, so adding
// unlocks did NOT require a SAVE_VERSION bump.
//
// We deliberately lock at object level (not at variant level) — variants
// have no mechanical difference in V1, so locking poker-but-not-blackjack
// would be UI noise without gameplay value.
export const STARTING_UNLOCKS: readonly ObjType[] = [
  ObjType.SLOT_MACHINE,
  ObjType.WC,
  ObjType.CASHIER,
];

// Per-goal unlock reward. Length aligns with the 10-goal completedGoals[]
// array; null = goal grants no unlock (cash reward only). Order matches
// GOAL_LABELS / GOAL_REWARDS so a single goal index drives label, cash,
// AND unlock — keeping balance tweaks to one place.
export const GOAL_UNLOCKS: readonly (ObjType | null)[] = [
  ObjType.SMALL_TABLE,       // Goal 0 — First Machines
  ObjType.BAR,               // Goal 1 — First Crowd
  ObjType.ATM,               // Goal 2 — Basic Amenity
  ObjType.LARGE_TABLE,       // Goal 3 — Real Gaming
  ObjType.KENO_LOUNGE,       // Goal 4 — Rising Star
  ObjType.SPORTSBOOK,        // Goal 5 — First Profit
  ObjType.BUFFET,            // Goal 6 — Hotel Open
  ObjType.HIGH_STAKES_TABLE, // Goal 7 — Busy Floor
  null, null,
];
export const GOAL_LABELS  = [
  'First Machines', 'First Crowd', 'Basic Amenity', 'Real Gaming',
  'Rising Star',    'First Profit', 'Hotel Open',   'Busy Floor',
  'Quality Service','Grand Bar',
];
export const GOAL_DESCS = [
  `Build ${GOAL_TARGETS.slots} slot machines`,
  `Reach ${GOAL_TARGETS.guests_first} guests/day`,
  'Build your first WC',
  'Build your first small table',
  `Reach Resort Rating ${GOAL_TARGETS.rating.toFixed(1)}`,
  `Earn ${GOAL_TARGETS.income.toLocaleString()} total`,
  `Expand hotel to ${GOAL_TARGETS.rooms} rooms`,
  `Reach ${GOAL_TARGETS.guests_busy} guests/day`,
  `Upgrade hotel to quality ${GOAL_TARGETS.quality}`,
  'Build the bar',
];

// Phaser hex colours for tiles
export const COL_FLOOR   = 0x2e3438;
export const COL_WALL    = 0x1e2124;
export const COL_LOBBY   = 0x403824;
export const COL_BLOCKED = 0x262d40;

export const enum TileType { FLOOR, WALL, LOBBY, BLOCKED }
// Enum order is fixed — values are persisted in saves. Append new entries.
// (Old index 5 was PATH, removed in save 1.3.0; CASHIER moved 6 → 5 via migration.)
// ATM appended at index 6 — old saves never contained that value, so no
// migration is required. BUFFET (7) and SPORTSBOOK (8) appended for the
// same reason: legacy saves never persist those numeric values.
// KENO_LOUNGE (9) and HIGH_STAKES_TABLE (10) appended in Phase N2 —
// same precedent: append-only, no save migration required.
export const enum ObjType  {
  SLOT_MACHINE, SMALL_TABLE, LARGE_TABLE, WC, BAR, CASHIER, ATM,
  BUFFET, SPORTSBOOK,
  KENO_LOUNGE, HIGH_STAKES_TABLE,
}

// Four-direction orientation. For floor attractions (slot, tables) this is
// the *front* of the object — the side guests interact from. For wall
// services it just selects between the two axis-aligned footprint shapes
// (N/S = base, E/W = swapped); the actual wall side is detected from the
// surrounding tiles.
export type Orientation = 'N' | 'E' | 'S' | 'W';
export const enum ValResult {
  VALID,
  FAIL_LIMIT, FAIL_AFFORD, FAIL_OUT_OF_BOUNDS,
  FAIL_WRONG_ZONE, FAIL_COLLISION,
  FAIL_WALL_INVALID, FAIL_DOOR_BLOCKED, FAIL_NO_ACCESS,
  FAIL_LOCKED,
}

// accessSides: how many open floor sides a placement requires.
//   0 = no requirement (wall objects use door-inward checks instead)
//   1 = at least one open neighbour (slot machines)
//   2 = at least two open sides (tables — guests need to approach)
//
// Phase A1 metadata (additive — not yet consumed by Simulation/GameState/
// GuestSprites/BuildPanel). Centralises per-type values that today live as
// hard-codes scattered across logic + game + ui modules so future content
// (ATM, Buffet, …) and guest types can be data-driven.
//   category    — build-panel grouping
//   ratingPer   — per-instance rating contribution (matches Simulation.calcRating
//                 coefficients; bar's flat 0.35 stays in Simulation for now,
//                 so bar's ratingPer is 0)
//   revPerVisit — money per guest who uses this attraction (mirrors REV_*)
//   dwellRange  — game-seconds [min, max] a guest spends at this attraction
//   targetWeight— relative likelihood a visiting guest picks this attraction
//   accessRule  — placement/operation access geometry kind
export type BuildCategoryId = 'slots' | 'tables' | 'services' | 'food';
export type AccessRule      = 'slot' | 'table' | 'wall' | 'free';

export interface ObjDef {
  label       : string;
  cost        : number;
  fw          : number;
  fh          : number;
  cap         : number;
  is_wall     : boolean;
  max         : number;   // -1 = unlimited
  rating      : number;
  flat        : boolean;
  color       : number;
  accessSides : 0 | 1 | 2;
  variants    : string[]; // empty = no variant picker
  // Phase A1 metadata (see block comment above).
  category    : BuildCategoryId;
  ratingPer   : number;
  revPerVisit : number;
  dwellRange  : [number, number];
  targetWeight: number;
  accessRule  : AccessRule;
}

export const OBJ_DEFS: Record<ObjType, ObjDef> = {
  [ObjType.SLOT_MACHINE]: {
    // 1×2 footprint: one tile is the cabinet, one is the player's chair.
    // The chair tile is part of the footprint (so nothing else can be built
    // on it) but is walkable — the guest stands on it while playing.
    label: 'Slot Machine', cost: 750,  fw: 1, fh: 2, cap: 1,
    is_wall: false, max: -1, rating: 0.02, flat: false,
    color: 0xccb31a, accessSides: 1, variants: [],
    category: 'slots', ratingPer: 0.01, revPerVisit: REV_SLOT,
    // Visual dwell only — has no effect on Simulation/revenue (sim runs on
    // aggregate counts, not on per-guest visits). Bumped in Guest Behavior
    // V1 so guests visibly play a slot for ~1–2 in-game hours instead of
    // bouncing off after a few real seconds.
    dwellRange: [12, 24], targetWeight: 1, accessRule: 'slot',
  },
  [ObjType.SMALL_TABLE]: {
    // Tables require a full 1-tile walkable buffer ring on every side.
    // Seats live on the 3 non-dealer sides; facing picks the dealer side.
    label: 'Small Table',  cost: 2500, fw: 2, fh: 3, cap: 4,
    is_wall: false, max: -1, rating: 0.18, flat: false,
    color: 0x3380e6, accessSides: 2, variants: ['blackjack', 'poker'],
    category: 'tables', ratingPer: 0.14, revPerVisit: REV_SMALL_TABLE,
    dwellRange: [18, 36], targetWeight: 4, accessRule: 'table',
  },
  [ObjType.LARGE_TABLE]: {
    label: 'Large Table',  cost: 4500, fw: 2, fh: 4, cap: 6,
    is_wall: false, max: -1, rating: 0.25, flat: false,
    color: 0x1a4dcc, accessSides: 2, variants: ['roulette', 'craps'],
    category: 'tables', ratingPer: 0.25, revPerVisit: REV_LARGE_TABLE,
    dwellRange: [24, 48], targetWeight: 6, accessRule: 'table',
  },
  [ObjType.WC]: {
    label: 'WC',           cost: 1200, fw: 3, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.20, flat: false,
    color: 0x4db368, accessSides: 0, variants: [],
    category: 'services', ratingPer: 0.20, revPerVisit: 0,
    dwellRange: [4, 8], targetWeight: 0, accessRule: 'wall',
  },
  [ObjType.BAR]: {
    // Bar's rating contribution is currently a flat +0.35 in Simulation
    // (not per-instance), so ratingPer stays 0 here for Phase A1. Phase A3
    // will fold the flat term into a generalised pass.
    label: 'Bar',          cost: 6500, fw: 8, fh: 1, cap: 0,
    is_wall: true,  max: 1,  rating: 0.35, flat: true,
    color: 0xcc4d33, accessSides: 0, variants: [],
    category: 'food', ratingPer: 0, revPerVisit: REV_BAR,
    dwellRange: [12, 24], targetWeight: 0, accessRule: 'wall',
  },
  [ObjType.CASHIER]: {
    label: 'Cashier',      cost: 1500, fw: 1, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.18, flat: true,
    color: 0x4d99cc, accessSides: 0, variants: [],
    category: 'services', ratingPer: 0.18, revPerVisit: 0,
    // Cashier/ATM stays short — services are quick stops compared to games.
    dwellRange: [3, 6], targetWeight: 2, accessRule: 'wall',
  },
  [ObjType.ATM]: {
    // 1×1 wall service like Cashier, but cheaper and revenue-bearing.
    // Each functional ATM draws ATM_DRAW_PER_UNIT × totalGuests visits
    // (capped at total guests) and earns REV_ATM per visit.
    label: 'ATM',          cost: 1000, fw: 1, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.10, flat: true,
    color: 0x2d6e4d, accessSides: 0, variants: [],
    category: 'services', ratingPer: 0.10, revPerVisit: REV_ATM,
    dwellRange: [3, 6], targetWeight: 2, accessRule: 'wall',
  },
  [ObjType.BUFFET]: {
    // 4×1 wall service. Same door-pattern family as Bar (two interior
    // door tiles), but slimmer footprint. Revenue scales with guest
    // traffic via BUFFET_DRAW_RATE × count, capped at 1.0 in calcRevenue.
    label: 'Buffet',       cost: 5000, fw: 4, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.22, flat: false,
    color: 0xd4a04a, accessSides: 0, variants: [],
    category: 'food', ratingPer: 0.22, revPerVisit: REV_BUFFET,
    dwellRange: [12, 24], targetWeight: 3, accessRule: 'wall',
  },
  [ObjType.SPORTSBOOK]: {
    // 4×1 wall service. Premium per-visit yield with a lower draw rate
    // than Buffet — fewer guests come through, but they spend more.
    label: 'Sportsbook',   cost: 10000, fw: 4, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.18, flat: false,
    color: 0x33994d, accessSides: 0, variants: [],
    category: 'services', ratingPer: 0.18, revPerVisit: REV_SPORTSBOOK,
    dwellRange: [12, 24], targetWeight: 2, accessRule: 'wall',
  },
  [ObjType.KENO_LOUNGE]: {
    // 3×3 table-like floor attraction. Reuses table buffer-ring rules
    // and seat reservation via isTableLike(). Cap 8 → contributes 8 to
    // casinoCapacity. Long dwell + medium weight reads as a relaxed
    // game lounge that holds guests longer than slots.
    label: 'Keno Lounge', cost: 7500, fw: 3, fh: 3, cap: 8,
    is_wall: false, max: -1, rating: 0.20, flat: false,
    color: 0x9a4dcc, accessSides: 2, variants: [],
    category: 'tables', ratingPer: 0.20, revPerVisit: REV_KENO,
    dwellRange: [24, 48], targetWeight: 3, accessRule: 'table',
  },
  [ObjType.HIGH_STAKES_TABLE]: {
    // 3×3 premium table. Cap 6, low targetWeight (rare visits), and
    // the lowest draw rate of any object so a single instance feels
    // exclusive. Two variants swap the centerpiece motif at draw time.
    label: 'High-Stakes Table', cost: 15000, fw: 3, fh: 3, cap: 6,
    is_wall: false, max: -1, rating: 0.30, flat: false,
    color: 0x8a1a1a, accessSides: 2, variants: ['baccarat', 'high-roller'],
    category: 'tables', ratingPer: 0.30, revPerVisit: REV_HIGH_STAKES,
    dwellRange: [24, 48], targetWeight: 2, accessRule: 'table',
  },
};

export function getDef(type: ObjType): ObjDef { return OBJ_DEFS[type]; }

// Is this an object that uses the "table" geometry contract — full
// open-floor buffer ring, reserved cardinal-side seat tiles, dealer-side
// facing? Centralised so future table-like objects (e.g. Keno Lounge,
// High-Stakes Table planned for Phase N2) can be opted in here once,
// instead of expanding OR-chains scattered across PlacementValidator,
// OperationalValidator, GameState, and GridScene.
export function isTableLike(type: ObjType): boolean {
  return type === ObjType.SMALL_TABLE
      || type === ObjType.LARGE_TABLE
      || type === ObjType.KENO_LOUNGE
      || type === ObjType.HIGH_STAKES_TABLE;
}

// All ObjType values, in declaration order. Append here whenever a new
// ObjType is added so generic `Record<ObjType, T>` allocations cover the
// new type. Saves persist the numeric enum value, so this list also doubles
// as documentation of the on-disk type id space.
export const ALL_OBJ_TYPES: ObjType[] = [
  ObjType.SLOT_MACHINE,
  ObjType.SMALL_TABLE,
  ObjType.LARGE_TABLE,
  ObjType.WC,
  ObjType.BAR,
  ObjType.CASHIER,
  ObjType.ATM,
  ObjType.BUFFET,
  ObjType.SPORTSBOOK,
  ObjType.KENO_LOUNGE,
  ObjType.HIGH_STAKES_TABLE,
];

// Build a fresh `Record<ObjType, T>` populated with `value`. Use to
// allocate per-type counters / accumulators without listing every key
// by hand. Returns a new object on every call — no shared state.
export function makeObjTypeRecord<T>(value: T): Record<ObjType, T> {
  const out = {} as Record<ObjType, T>;
  for (const t of ALL_OBJ_TYPES) out[t] = value;
  return out;
}

export function valMessage(result: ValResult): string {
  switch (result) {
    case ValResult.FAIL_LIMIT:         return 'Only one bar can be built.';
    case ValResult.FAIL_AFFORD:        return 'Not enough cash.';
    case ValResult.FAIL_OUT_OF_BOUNDS: return 'Cannot place outside the casino floor.';
    case ValResult.FAIL_WRONG_ZONE:    return 'Cannot place here.';
    case ValResult.FAIL_COLLISION:     return 'Something is already here.';
    case ValResult.FAIL_WALL_INVALID:  return 'Must be placed against a wall.';
    case ValResult.FAIL_DOOR_BLOCKED:  return 'The entrance must not be blocked.';
    case ValResult.FAIL_NO_ACCESS:     return 'Needs at least one open approach.';
    case ValResult.FAIL_LOCKED:        return 'This object is locked.';
  }
  return '';
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number; }

export interface Tile {
  col       : number;
  row       : number;
  tile_type : TileType;
  obj_id    : string;
  // True when this tile is a slot's chair tile. It is part of an object's
  // footprint (so collision rejects new builds on it) yet remains walkable
  // for guests, who stand on it while using the slot. Derived state, not
  // persisted — rebuilt from placedObjs on load.
  is_seat   : boolean;
}

// Persistent placement data — exactly what's serialized to a save.
// New per-object operational state (path-connected, broken, etc.) belongs
// on PlacedObj below, NOT here, so it stays out of the save payload.
export interface PlacedObjData {
  id      : string;
  type    : ObjType;
  col     : number;
  row     : number;
  facing  : Orientation;
  variant : string;
}

// In-memory representation: persistent data + cached spatial geometry.
// `tiles`, `seats`, `w`, `h` are derived from (type, col, row, facing) and
// rebuilt on load — never persisted.
//
//   tiles : the body footprint (slot includes the chair tile).
//   seats : reserved use-tiles outside the body (currently tables only) —
//           marked with obj_id+is_seat so other builds can't squat on
//           them and so guests have a guaranteed approach.
export interface PlacedObj extends PlacedObjData {
  tiles : Vec2[];
  seats : Vec2[];
  w     : number;
  h     : number;
}

// ── Orientation helpers ─────────────────────────────────────────────────────
// Centralised so placement, operational, and rendering code agree on what
// a given facing means.

// Footprint dimensions for a placement. N/S use base fw,fh; E/W swap them.
export function dimsFor(type: ObjType, facing: Orientation): { w: number; h: number } {
  const def = OBJ_DEFS[type];
  const horiz = facing === 'E' || facing === 'W';
  return horiz ? { w: def.fh, h: def.fw } : { w: def.fw, h: def.fh };
}

// Slot machine footprint split into its two cells. `seat` is the chair the
// guest stands on; `machine` is the cabinet. Coordinates are absolute tiles.
// (col, row) is the bounds top-left — what's stored on PlacedObj — so this
// helper is symmetric with `computeFootprint(col, row, w, h)`.
//   facing = direction the chair sits relative to the cabinet
//   N: chair north of cabinet ; S: chair south
//   E: chair east of cabinet  ; W: chair west
export function slotParts(col: number, row: number, facing: Orientation):
    { seat: Vec2; machine: Vec2 } {
  switch (facing) {
    case 'N': return { seat:    { x: col, y: row     }, machine: { x: col,     y: row + 1 } };
    case 'S': return { machine: { x: col, y: row     }, seat:    { x: col,     y: row + 1 } };
    case 'E': return { machine: { x: col, y: row     }, seat:    { x: col + 1, y: row     } };
    case 'W': return { seat:    { x: col, y: row     }, machine: { x: col + 1, y: row     } };
  }
}

// Convert a slot's cursor tile (where the player wants the *cabinet*) to
// the bounds top-left used by storage and validation. The cabinet stays
// fixed under the cursor across rotations; only the chair rotates around
// it. P2.2 anchor fix.
export function slotAnchorFromCursor(
  cursorCol: number, cursorRow: number, facing: Orientation,
): Vec2 {
  switch (facing) {
    // chair north of cabinet → bounds top-left is one tile above the cursor
    case 'N': return { x: cursorCol,     y: cursorRow - 1 };
    case 'S': return { x: cursorCol,     y: cursorRow     };
    case 'E': return { x: cursorCol,     y: cursorRow     };
    // chair west of cabinet → bounds top-left is one tile left of the cursor
    case 'W': return { x: cursorCol - 1, y: cursorRow     };
  }
}

// The three cardinal sides of a table where players sit. The fourth side
// (the `facing` direction) is the dealer side and has no player seats.
export function tablePlayerSides(facing: Orientation): Orientation[] {
  switch (facing) {
    case 'N': return ['E', 'S', 'W'];
    case 'S': return ['N', 'E', 'W'];
    case 'E': return ['N', 'S', 'W'];
    case 'W': return ['N', 'S', 'E'];
  }
}

// Cycle facing for the rotate (R) hotkey: N → E → S → W → N.
export function nextFacing(f: Orientation): Orientation {
  return f === 'N' ? 'E' : f === 'E' ? 'S' : f === 'S' ? 'W' : 'N';
}

// Cursor → bounds top-left for tables. Centres the footprint roughly
// under the cursor so rotating doesn't fling the table to one corner —
// the cursor stays inside the table across all four facings. Slots use
// their own machine-anchored helper (slotAnchorFromCursor); other types
// keep cursor == bounds top-left.
export function tableAnchorFromCursor(
  curCol: number, curRow: number, type: ObjType, facing: Orientation,
): Vec2 {
  const { w, h } = dimsFor(type, facing);
  return {
    x: curCol - Math.floor((w - 1) / 2),
    y: curRow - Math.floor((h - 1) / 2),
  };
}

// Reserved seat tiles for a table at bounds top-left (col, row) with the
// given facing. Seats are the cardinal-adjacent tiles on the 3 player
// sides (the dealer side gets none). At placement time these are marked
// is_seat=true with obj_id set, so future builds can't take them and the
// table can't lose its approach.
export function tableSeatTiles(
  col: number, row: number, type: ObjType, facing: Orientation,
): Vec2[] {
  if (!isTableLike(type)) return [];
  const { w, h } = dimsFor(type, facing);
  const playerSides = tablePlayerSides(facing);
  const out: Vec2[] = [];
  for (const side of playerSides) {
    if (side === 'N')      for (let c = col; c < col + w; c++) out.push({ x: c,         y: row - 1 });
    else if (side === 'S') for (let c = col; c < col + w; c++) out.push({ x: c,         y: row + h });
    else if (side === 'W') for (let r = row; r < row + h; r++) out.push({ x: col - 1,   y: r });
    else                   for (let r = row; r < row + h; r++) out.push({ x: col + w,   y: r });
  }
  return out;
}

export interface DayStats {
  day          : number;
  total_guests : number;
  walkin       : number;
  hotel_guests : number;
  revenue      : number;
  costs        : number;
  net          : number;
  cumulative   : number;
  cash         : number;
  slot_rev     : number;
  small_rev    : number;
  large_rev    : number;
  bar_rev      : number;
  // Added with the ATM build object. Pre-1.6 records that lack this field
  // are normalised to 0 in GameState._apply, so SAVE_VERSION did not need
  // to bump.
  atm_rev      : number;
  // Added with Phase N1 (Buffet/Sportsbook). Same defaulting pattern as
  // atm_rev — legacy records get 0 in GameState._apply; no save bump.
  buffet_rev     : number;
  sportsbook_rev : number;
  // Added with Phase N2 (Keno Lounge / High-Stakes Table). Same pattern.
  keno_rev       : number;
  highstakes_rev : number;
  hotel_rev    : number;
  occupancy    : number;
  booked       : number;
  capacity     : number;
  crowding     : number;
  rating       : number;
}
