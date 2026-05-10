// Simulation.ts — pure formula functions, direct port of Simulation.gd
import * as GC from './GameConstants';

export function calcCapacity(
  slots: number, smallTables: number, largeTables: number,
  kenoCount: number = 0, highStakesCount: number = 0,
): number {
  return slots
       + 4 * smallTables
       + 6 * largeTables
       + 8 * kenoCount
       + 6 * highStakesCount;
}

export function calcCrowding(lastGuests: number, capacity: number, prevPenalty: number): number {
  if (capacity <= 0 || lastGuests <= 0) {
    return lerp(prevPenalty, 0.0, GC.CROWDING_SMOOTH);
  }
  const ratio = lastGuests / capacity;
  const raw   = Math.max(0.0, (ratio - 1.0) * 0.5);
  return GC.CROWDING_SMOOTH * raw + (1.0 - GC.CROWDING_SMOOTH) * prevPenalty;
}

export function calcRating(
  slots: number, smallTables: number, largeTables: number,
  wcCount: number, barExists: boolean,
  roomCount: number, qualityLevel: number,
  crowdingPenalty: number,
  cashierCount: number = 0,
  atmCount: number = 0,
  buffetCount: number = 0,
  sportsbookCount: number = 0,
  kenoCount: number = 0,
  highStakesCount: number = 0,
): number {
  const raw = GC.RATING_BASE
    + 0.01 * slots
    + 0.14 * smallTables
    + 0.25 * largeTables
    + 0.20 * wcCount
    + (barExists ? 0.35 : 0.0)
    + 0.03 * roomCount
    + 0.18 * qualityLevel
    + 0.18 * cashierCount
    + 0.10 * atmCount
    + 0.22 * buffetCount
    + 0.18 * sportsbookCount
    + 0.20 * kenoCount
    + 0.30 * highStakesCount
    - crowdingPenalty;
  return clamp(raw, GC.RATING_MIN, GC.RATING_MAX);
}

export function calcUpkeep(
  slots: number, smallTables: number, largeTables: number,
  wcCount: number, barExists: boolean, roomCount: number,
): number {
  return slots       * GC.UPKEEP_SLOT
       + smallTables * GC.UPKEEP_SMALL_TABLE
       + largeTables * GC.UPKEEP_LARGE_TABLE
       + wcCount     * GC.UPKEEP_WC
       + (barExists  ? GC.UPKEEP_BAR : 0)
       + roomCount   * GC.UPKEEP_PER_ROOM;
}

export function calcOccupancy(
  roomCount: number, qualityLevel: number, rating: number,
): { rate: number; booked: number; hotel_guests: number } {
  if (roomCount <= 0) return { rate: 0.0, booked: 0, hotel_guests: 0 };
  const rate        = Math.min(1.0, 0.35 + 0.10 * rating + 0.08 * qualityLevel);
  const booked      = Math.floor(roomCount * rate);
  const hotel_guests = Math.round(booked * 0.9);
  return { rate, booked, hotel_guests };
}

export function calcWalkin(capacity: number, rating: number): number {
  if (capacity <= 0) return 0;
  const rm = 0.6 + rating / 5.0;
  const cm = Math.min(1.5, capacity / 30.0);
  return Math.round(GC.BASE_DEMAND * rm * cm);
}

export function calcRevenue(
  totalGuests: number, bookedRooms: number,
  slots: number, smallTables: number, largeTables: number,
  barExists: boolean,
  atmCount: number = 0,
  buffetCount: number = 0,
  sportsbookCount: number = 0,
  kenoCount: number = 0,
  highStakesCount: number = 0,
): {
  total: number; slot_rev: number; small_rev: number;
  large_rev: number; bar_rev: number; atm_rev: number;
  buffet_rev: number; sportsbook_rev: number;
  keno_rev: number; highstakes_rev: number;
  hotel_rev: number;
} {
  const slotCap  = slots;
  const tableCap = 4 * smallTables + 6 * largeTables;
  const floorCap = slotCap + tableCap;

  let slotGuests  = 0;
  let smallGuests = 0;
  let largeGuests = 0;

  if (floorCap > 0) {
    slotGuests = Math.round(totalGuests * (slotCap / floorCap));
    const tableGuests = totalGuests - slotGuests;
    if (tableCap > 0) {
      const smallShare = (4 * smallTables) / tableCap;
      smallGuests = Math.round(tableGuests * smallShare);
      largeGuests = tableGuests - smallGuests;
    }
  }

  const barGuests = barExists ? Math.round(totalGuests * GC.BAR_DRAW_RATE) : 0;
  // ATM draw scales with count but is capped at total guests so a casino
  // with many ATMs can't exceed the realistic visit ceiling.
  const atmShare  = Math.min(1, atmCount * GC.ATM_DRAW_PER_UNIT);
  const atmGuests = atmCount > 0 ? Math.round(totalGuests * atmShare) : 0;
  // Buffet/Sportsbook follow the same capped per-unit share pattern.
  const buffetShare      = Math.min(1, buffetCount      * GC.BUFFET_DRAW_RATE);
  const buffetGuests     = buffetCount > 0
    ? Math.round(totalGuests * buffetShare) : 0;
  const sportsbookShare  = Math.min(1, sportsbookCount  * GC.SPORTSBOOK_DRAW_RATE);
  const sportsbookGuests = sportsbookCount > 0
    ? Math.round(totalGuests * sportsbookShare) : 0;
  // Keno / High-Stakes — same capped share model. Kept outside the
  // slots-vs-tables capacity partition deliberately so Phase N2 doesn't
  // re-tune existing small/large weights.
  const kenoShare        = Math.min(1, kenoCount        * GC.KENO_DRAW_RATE);
  const kenoGuests       = kenoCount > 0
    ? Math.round(totalGuests * kenoShare) : 0;
  const highShare        = Math.min(1, highStakesCount  * GC.HIGH_STAKES_DRAW_RATE);
  const highGuests       = highStakesCount > 0
    ? Math.round(totalGuests * highShare) : 0;

  const slot_rev       = slotGuests       * GC.REV_SLOT;
  const small_rev      = smallGuests      * GC.REV_SMALL_TABLE;
  const large_rev      = largeGuests      * GC.REV_LARGE_TABLE;
  const bar_rev        = barGuests        * GC.REV_BAR;
  const atm_rev        = atmGuests        * GC.REV_ATM;
  const buffet_rev     = buffetGuests     * GC.REV_BUFFET;
  const sportsbook_rev = sportsbookGuests * GC.REV_SPORTSBOOK;
  const keno_rev       = kenoGuests       * GC.REV_KENO;
  const highstakes_rev = highGuests       * GC.REV_HIGH_STAKES;
  const hotel_rev      = bookedRooms      * GC.REV_PER_ROOM;
  const total = slot_rev + small_rev + large_rev + bar_rev
              + atm_rev + buffet_rev + sportsbook_rev
              + keno_rev + highstakes_rev + hotel_rev;

  return {
    total, slot_rev, small_rev, large_rev, bar_rev,
    atm_rev, buffet_rev, sportsbook_rev,
    keno_rev, highstakes_rev,
    hotel_rev,
  };
}

// Projection inputs — current functional counts plus the prior-day feedback
// terms (last_guests, prev_crowding) used to derive crowding and rating.
export interface ProjectInput {
  slots            : number;
  small_tables     : number;
  large_tables     : number;
  wc_count         : number;
  bar_exists       : boolean;
  cashier_count    : number;
  atm_count        : number;
  buffet_count     : number;
  sportsbook_count : number;
  keno_count       : number;
  highstakes_count : number;
  room_count       : number;
  quality_level    : number;
  last_guests      : number;
  prev_crowding    : number;
}

// Pure projection — what today's totals look like at this instant given the
// current functional state. No cash mutation. Used by both the per-second
// drip and the day-end rollup, so the two stay consistent.
export interface DayProjection {
  capacity       : number;
  crowding       : number;
  rating         : number;
  occupancy      : number;
  booked         : number;
  hotel_guests   : number;
  walkin         : number;
  total_guests   : number;
  revenue        : number;
  slot_rev       : number;
  small_rev      : number;
  large_rev      : number;
  bar_rev        : number;
  atm_rev        : number;
  buffet_rev     : number;
  sportsbook_rev : number;
  keno_rev       : number;
  highstakes_rev : number;
  hotel_rev      : number;
}

export function projectDay(s: ProjectInput): DayProjection {
  const capacity = calcCapacity(
    s.slots, s.small_tables, s.large_tables,
    s.keno_count, s.highstakes_count,
  );
  const crowding = calcCrowding(s.last_guests, capacity, s.prev_crowding);
  const rating   = calcRating(
    s.slots, s.small_tables, s.large_tables,
    s.wc_count, s.bar_exists,
    s.room_count, s.quality_level, crowding,
    s.cashier_count, s.atm_count,
    s.buffet_count, s.sportsbook_count,
    s.keno_count, s.highstakes_count,
  );
  const hotel  = calcOccupancy(s.room_count, s.quality_level, rating);
  const walkin = calcWalkin(capacity, rating);
  const total  = walkin + hotel.hotel_guests;
  const rev    = calcRevenue(
    total, hotel.booked,
    s.slots, s.small_tables, s.large_tables, s.bar_exists,
    s.atm_count, s.buffet_count, s.sportsbook_count,
    s.keno_count, s.highstakes_count,
  );
  return {
    capacity, crowding, rating,
    occupancy: hotel.rate, booked: hotel.booked,
    hotel_guests: hotel.hotel_guests,
    walkin, total_guests: total,
    revenue: rev.total,
    slot_rev: rev.slot_rev, small_rev: rev.small_rev,
    large_rev: rev.large_rev, bar_rev: rev.bar_rev,
    atm_rev: rev.atm_rev,
    buffet_rev: rev.buffet_rev,
    sportsbook_rev: rev.sportsbook_rev,
    keno_rev: rev.keno_rev,
    highstakes_rev: rev.highstakes_rev,
    hotel_rev: rev.hotel_rev,
  };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
