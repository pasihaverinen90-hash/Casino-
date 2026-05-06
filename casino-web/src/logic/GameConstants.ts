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

export const BASE_DEMAND     = 30;

export const REV_SLOT        = 13;
export const REV_SMALL_TABLE = 22;
export const REV_LARGE_TABLE = 30;
export const REV_BAR         = 6;
export const REV_PER_ROOM    = 24;
export const BAR_DRAW_RATE   = 0.15;

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
export const enum ObjType  { SLOT_MACHINE, SMALL_TABLE, LARGE_TABLE, WC, BAR, CASHIER }

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
}

// accessSides: how many open floor sides a placement requires.
//   0 = no requirement (wall objects use door-inward checks instead)
//   1 = at least one open neighbour (slot machines)
//   2 = at least two open sides (tables — guests need to approach)
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
}

export const OBJ_DEFS: Record<ObjType, ObjDef> = {
  [ObjType.SLOT_MACHINE]: {
    // 1×2 footprint: one tile is the cabinet, one is the player's chair.
    // The chair tile is part of the footprint (so nothing else can be built
    // on it) but is walkable — the guest stands on it while playing.
    label: 'Slot Machine', cost: 750,  fw: 1, fh: 2, cap: 1,
    is_wall: false, max: -1, rating: 0.02, flat: false,
    color: 0xccb31a, accessSides: 1, variants: [],
  },
  [ObjType.SMALL_TABLE]: {
    // Tables require a full 1-tile walkable buffer ring on every side.
    // Seats live on the 3 non-dealer sides; facing picks the dealer side.
    label: 'Small Table',  cost: 2500, fw: 2, fh: 3, cap: 4,
    is_wall: false, max: -1, rating: 0.18, flat: false,
    color: 0x3380e6, accessSides: 2, variants: ['blackjack', 'poker'],
  },
  [ObjType.LARGE_TABLE]: {
    label: 'Large Table',  cost: 4500, fw: 2, fh: 4, cap: 6,
    is_wall: false, max: -1, rating: 0.25, flat: false,
    color: 0x1a4dcc, accessSides: 2, variants: ['roulette', 'craps'],
  },
  [ObjType.WC]: {
    label: 'WC',           cost: 1200, fw: 3, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.20, flat: false,
    color: 0x4db368, accessSides: 0, variants: [],
  },
  [ObjType.BAR]: {
    label: 'Bar',          cost: 6500, fw: 8, fh: 1, cap: 0,
    is_wall: true,  max: 1,  rating: 0.35, flat: true,
    color: 0xcc4d33, accessSides: 0, variants: [],
  },
  [ObjType.CASHIER]: {
    label: 'Cashier',      cost: 1500, fw: 1, fh: 1, cap: 0,
    is_wall: true,  max: -1, rating: 0.18, flat: true,
    color: 0x4d99cc, accessSides: 0, variants: [],
  },
};

export function getDef(type: ObjType): ObjDef { return OBJ_DEFS[type]; }

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
  if (type !== ObjType.SMALL_TABLE && type !== ObjType.LARGE_TABLE) return [];
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
  hotel_rev    : number;
  occupancy    : number;
  booked       : number;
  capacity     : number;
  crowding     : number;
  rating       : number;
}
