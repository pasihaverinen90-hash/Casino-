// Simulation.ts — pure formula functions, direct port of Simulation.gd
import * as GC from './GameConstants';

export function calcCapacity(slots: number, smallTables: number, largeTables: number): number {
  return slots + 4 * smallTables + 6 * largeTables;
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
): number {
  const raw = GC.RATING_BASE
    + 0.01 * slots
    + 0.14 * smallTables
    + 0.25 * largeTables
    + 0.20 * wcCount
    + (barExists ? 0.35 : 0.0)
    + 0.03 * roomCount
    + 0.18 * qualityLevel
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
): {
  total: number; slot_rev: number; small_rev: number;
  large_rev: number; bar_rev: number; hotel_rev: number;
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

  const slot_rev  = slotGuests  * GC.REV_SLOT;
  const small_rev = smallGuests * GC.REV_SMALL_TABLE;
  const large_rev = largeGuests * GC.REV_LARGE_TABLE;
  const bar_rev   = barGuests   * GC.REV_BAR;
  const hotel_rev = bookedRooms * GC.REV_PER_ROOM;
  const total     = slot_rev + small_rev + large_rev + bar_rev + hotel_rev;

  return { total, slot_rev, small_rev, large_rev, bar_rev, hotel_rev };
}

export interface DayInput {
  slots            : number;
  small_tables     : number;
  large_tables     : number;
  wc_count         : number;
  bar_exists       : boolean;
  room_count       : number;
  quality_level    : number;
  cash             : number;
  cumulative_income: number;
  last_guests      : number;
  prev_crowding    : number;
  day_number       : number;
}

export interface DayOutput {
  capacity     : number;
  crowding     : number;
  rating       : number;
  occupancy    : number;
  booked       : number;
  hotel_guests : number;
  walkin       : number;
  total_guests : number;
  net          : number;
  new_cash     : number;
  new_cumul    : number;
  new_last_guests: number;
  day_stats    : GC.DayStats;
}

export function runDay(s: DayInput): DayOutput {
  const capacity    = calcCapacity(s.slots, s.small_tables, s.large_tables);
  const crowding    = calcCrowding(s.last_guests, capacity, s.prev_crowding);
  const rating      = calcRating(s.slots, s.small_tables, s.large_tables,
                                  s.wc_count, s.bar_exists,
                                  s.room_count, s.quality_level, crowding);
  const hotel       = calcOccupancy(s.room_count, s.quality_level, rating);
  const walkin      = calcWalkin(capacity, rating);
  const total       = walkin + hotel.hotel_guests;
  const rev         = calcRevenue(total, hotel.booked,
                                   s.slots, s.small_tables, s.large_tables, s.bar_exists);
  const upkeep      = calcUpkeep(s.slots, s.small_tables, s.large_tables,
                                  s.wc_count, s.bar_exists, s.room_count);
  const net         = rev.total - upkeep;
  const new_cash    = s.cash + net;
  const new_cumul   = s.cumulative_income + rev.total; // total gross revenue earned

  const day_stats: GC.DayStats = {
    day: s.day_number, total_guests: total, walkin,
    hotel_guests: hotel.hotel_guests,
    revenue: rev.total, costs: upkeep, net,
    cumulative: new_cumul, cash: new_cash,
    slot_rev: rev.slot_rev, small_rev: rev.small_rev,
    large_rev: rev.large_rev, bar_rev: rev.bar_rev,
    hotel_rev: rev.hotel_rev,
    occupancy: hotel.rate, booked: hotel.booked,
    capacity, crowding, rating,
  };

  return {
    capacity, crowding, rating,
    occupancy: hotel.rate, booked: hotel.booked,
    hotel_guests: hotel.hotel_guests,
    walkin, total_guests: total,
    net, new_cash, new_cumul,
    new_last_guests: total,
    day_stats,
  };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
