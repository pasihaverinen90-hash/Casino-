// GameConstants.ts — direct port of GameConstants.gd

export const GRID_COLS       = 36;
export const GRID_ROWS       = 24;
export const LOBBY_START_COL = 15;
export const LOBBY_END_COL   = 20;

export const STARTING_CASH   = 7500;
export const HISTORY_MAX     = 60;
export const DEMOLISH_REFUND = 0.5;

export const RATING_BASE     = 1.50;
export const RATING_MIN      = 1.0;
export const RATING_MAX      = 5.0;
export const CROWDING_SMOOTH = 0.4;

export const BASE_DEMAND     = 30;

export const REV_SLOT        = 12;
export const REV_SMALL_TABLE = 22;
export const REV_LARGE_TABLE = 30;
export const REV_BAR         = 8;
export const REV_PER_ROOM    = 25;
export const BAR_DRAW_RATE   = 0.15;

export const GOAL_REWARDS = [500, 800, 600, 1200, 1000, 1500, 1000, 2000, 1500, 3000];
export const GOAL_LABELS  = [
  'First Machines', 'First Crowd', 'Basic Amenity', 'Real Gaming',
  'Rising Star',    'First Profit', 'Hotel Open',   'Busy Floor',
  'Quality Service','Grand Bar',
];
export const GOAL_DESCS = [
  'Build 3 slot machines',
  'Reach 35 guests/day',
  'Build your first WC',
  'Build your first small table',
  'Reach Resort Rating 2.0',
  'Earn 5,000 total',
  'Expand hotel to 4 rooms',
  'Reach 60 guests/day',
  'Upgrade hotel to quality 2',
  'Build the bar',
];

// Phaser hex colours for tiles
export const COL_FLOOR   = 0x2e3438;
export const COL_WALL    = 0x1e2124;
export const COL_LOBBY   = 0x403824;
export const COL_BLOCKED = 0x262d40;

// Phaser hex colours for placed objects
export const OBJ_COLOURS: Record<number, number> = {
  0: 0xccb31a, // SLOT_MACHINE — gold
  1: 0x3380e6, // SMALL_TABLE  — blue
  2: 0x1a4dcc, // LARGE_TABLE  — dark blue
  3: 0x4db368, // WC           — green
  4: 0xcc4d33, // BAR          — red
};

export const enum TileType { FLOOR, WALL, LOBBY, BLOCKED }
export const enum ObjType  { SLOT_MACHINE, SMALL_TABLE, LARGE_TABLE, WC, BAR }
export const enum ValResult {
  VALID,
  FAIL_LIMIT, FAIL_AFFORD, FAIL_OUT_OF_BOUNDS,
  FAIL_WRONG_ZONE, FAIL_COLLISION,
  FAIL_WALL_INVALID, FAIL_DOOR_BLOCKED, FAIL_NO_ACCESS,
}

export interface ObjDef {
  label   : string;
  cost    : number;
  fw      : number;
  fh      : number;
  cap     : number;
  is_wall : boolean;
  max     : number;   // -1 = unlimited
  rating  : number;
  flat    : boolean;
}

export function getDef(type: ObjType): ObjDef {
  switch (type) {
    case ObjType.SLOT_MACHINE:
      return { label: 'Slot Machine', cost: 750,  fw: 1, fh: 1, cap: 1, is_wall: false, max: -1, rating: 0.02, flat: false };
    case ObjType.SMALL_TABLE:
      return { label: 'Small Table',  cost: 2500, fw: 2, fh: 3, cap: 4, is_wall: false, max: -1, rating: 0.18, flat: false };
    case ObjType.LARGE_TABLE:
      return { label: 'Large Table',  cost: 4500, fw: 2, fh: 4, cap: 6, is_wall: false, max: -1, rating: 0.25, flat: false };
    case ObjType.WC:
      return { label: 'WC',           cost: 1200, fw: 3, fh: 1, cap: 0, is_wall: true,  max: -1, rating: 0.20, flat: false };
    case ObjType.BAR:
      return { label: 'Bar',          cost: 6500, fw: 8, fh: 1, cap: 0, is_wall: true,  max: 1,  rating: 0.35, flat: true  };
  }
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
}

export interface PlacedObj {
  id      : string;
  type    : ObjType;
  col     : number;
  row     : number;
  rotated : boolean;
  variant : string;
  tiles   : Vec2[];
  w       : number;
  h       : number;
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
