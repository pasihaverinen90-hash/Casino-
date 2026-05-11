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

// Rating V2 input — single object so call sites stay readable as the formula
// pulls in finance/hotel/capacity terms that weren't in V1's flat signature.
export interface RatingInput {
  slots            : number;
  smallTables      : number;
  largeTables      : number;
  kenoCount        : number;
  highStakesCount  : number;
  sportsbookCount  : number;
  wcCount          : number;
  cashierCount     : number;
  atmCount         : number;
  barExists        : boolean;
  buffetCount      : number;
  roomCount        : number;
  qualityLevel     : number;
  casinoCapacity   : number;
  crowdingPenalty  : number;
  // For finance + hotel-occupancy pillars. Caller passes the prior tick's
  // values (see _recomputeDerived) — lag is bounded because each pillar caps
  // at 10/100 score, and _recomputeDerived runs on every placement /
  // demolish / quality change / 6-hour tick, so the lag converges quickly.
  occupancyRate    : number;
  dailyRevenue     : number;
  cumulativeIncome : number;
}

// ── Rating V2 sub-scores ─────────────────────────────────────────────────────
// Each helper returns its category contribution, already capped at the
// category's weight. calcRating sums them and maps the 0–100 total to the
// 1.0–5.0 rating range.

function scoreVariety(s: RatingInput): number {
  let q = 0;
  if (s.slots           >= GC.VARIETY_SLOT_THRESHOLD) q++;
  if (s.smallTables     >= 1) q++;
  if (s.largeTables     >= 1) q++;
  if (s.kenoCount       >= 1) q++;
  if (s.highStakesCount >= 1) q++;
  if (s.sportsbookCount >= 1) q++;
  return (GC.RATING_WEIGHTS.variety / 6) * q;
}

function scoreComfort(s: RatingInput): number {
  const cap = s.casinoCapacity;
  const div = GC.COMFORT_TARGET_DIVISORS;
  const wcT      = Math.max(1, cap / div.wc);
  const cashierT = Math.max(1, cap / div.cashier);
  const atmT     = Math.max(1, cap / div.atm);
  const buffetT  = Math.max(1, cap / div.buffet);
  const adeq =
      clamp01(s.wcCount      / wcT)
    + clamp01(s.cashierCount / cashierT)
    + clamp01(s.atmCount     / atmT)
    + (s.barExists ? 1 : 0)
    + clamp01(s.buffetCount  / buffetT);
  return GC.RATING_WEIGHTS.comfort * (adeq / 5);
}

function scorePrestige(s: RatingInput): number {
  const c = GC.PRESTIGE_COEFF;
  const raw =
      Math.sqrt(Math.max(0, s.largeTables))     * c.largeTable
    + Math.sqrt(Math.max(0, s.kenoCount))       * c.keno
    + Math.sqrt(Math.max(0, s.highStakesCount)) * c.highStakes
    + Math.sqrt(Math.max(0, s.sportsbookCount)) * c.sportsbook
    + Math.max(0, s.qualityLevel - 1)           * c.qualityLvl;
  return Math.min(GC.RATING_WEIGHTS.prestige, raw);
}

function scoreCapacity(s: RatingInput): number {
  const scale = Math.min(1, s.casinoCapacity / GC.CAPACITY_DEMAND_BASELINE);
  const oc    = Math.max(0, 1 - 2 * s.crowdingPenalty);
  return GC.RATING_WEIGHTS.capacity * scale * oc;
}

function scoreHotel(s: RatingInput): number {
  const roomPts = Math.min(1, s.roomCount / GC.HOTEL_TARGETS.rooms) * 5;
  const qPts    = Math.max(0, s.qualityLevel - 1) * 2;
  const occPts  = clamp01(s.occupancyRate);
  return Math.min(GC.RATING_WEIGHTS.hotel, roomPts + qPts + occPts);
}

function scoreFinance(s: RatingInput): number {
  const rev = clamp01(s.dailyRevenue     / GC.FINANCE_TARGETS.dailyRevenue)     * 5;
  const cum = clamp01(s.cumulativeIncome / GC.FINANCE_TARGETS.cumulativeIncome) * 5;
  return rev + cum;
}

// Per-category breakdown alongside the final score and rating. Used by the
// hidden Ctrl+Shift+R dev shortcut to inspect which pillar is limiting the
// current rating during tuning. Numbers are the raw post-cap contributions,
// not the maxes — pair with RATING_WEIGHTS to render "x / max" lines.
export interface RatingBreakdown {
  variety  : number;
  comfort  : number;
  prestige : number;
  capacity : number;
  hotel    : number;
  finance  : number;
  score    : number;
  rating   : number;
}

// Rating V2 breakdown — runs the same six score helpers calcRating uses and
// returns each category plus the rolled-up score and final rating. This is
// the single source of truth: calcRating below is a thin wrapper.
export function calcRatingBreakdown(s: RatingInput): RatingBreakdown {
  const variety  = scoreVariety(s);
  const comfort  = scoreComfort(s);
  const prestige = scorePrestige(s);
  const capacity = scoreCapacity(s);
  const hotel    = scoreHotel(s);
  const finance  = scoreFinance(s);
  const score    = variety + comfort + prestige + capacity + hotel + finance;
  const rating   = clamp(1.0 + (score / 100) * 4.0, GC.RATING_MIN, GC.RATING_MAX);
  return { variety, comfort, prestige, capacity, hotel, finance, score, rating };
}

// Rating V2 — six-category 0–100 score, mapped to the 1.0–5.0 rating range.
// Replaces V1's flat additive formula. Crowding lives inside scoreCapacity
// (no standalone "- crowdingPenalty" term), so the final rating is purely
// the score-to-range mapping. See GameConstants.RATING_WEIGHTS for caps.
export function calcRating(s: RatingInput): number {
  return calcRatingBreakdown(s).rating;
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
// Rating V2 added prev_occupancy / prev_revenue / cumulative_income for the
// hotel-occupancy and finance pillars; see RatingInput for the lag note.
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
  // Rating V2 — caller passes the prior tick's projection values for the
  // hotel-occupancy and finance pillars. Lag converges in ≤1 _recomputeDerived
  // call (≤1.4 rating-points worst case across the two pillars combined).
  prev_occupancy    : number;
  prev_revenue      : number;
  cumulative_income : number;
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
  // The exact RatingInput passed to calcRating this tick. Exposed so the
  // debug breakdown can recompute the per-category split against the same
  // inputs the live rating saw — no need to capture / mirror prior-tick
  // values on GameState.
  rating_input   : RatingInput;
}

export function projectDay(s: ProjectInput): DayProjection {
  const capacity = calcCapacity(
    s.slots, s.small_tables, s.large_tables,
    s.keno_count, s.highstakes_count,
  );
  const crowding = calcCrowding(s.last_guests, capacity, s.prev_crowding);
  // Build the RatingInput once, then reuse it on the projection so the debug
  // breakdown sees the exact same values the live rating was computed from.
  const ratingInput: RatingInput = {
    slots            : s.slots,
    smallTables      : s.small_tables,
    largeTables      : s.large_tables,
    kenoCount        : s.keno_count,
    highStakesCount  : s.highstakes_count,
    sportsbookCount  : s.sportsbook_count,
    wcCount          : s.wc_count,
    cashierCount     : s.cashier_count,
    atmCount         : s.atm_count,
    barExists        : s.bar_exists,
    buffetCount      : s.buffet_count,
    roomCount        : s.room_count,
    qualityLevel     : s.quality_level,
    casinoCapacity   : capacity,
    crowdingPenalty  : crowding,
    occupancyRate    : s.prev_occupancy,
    dailyRevenue     : s.prev_revenue,
    cumulativeIncome : s.cumulative_income,
  };
  const rating   = calcRating(ratingInput);
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
    rating_input: ratingInput,
  };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function clamp01(v: number): number { return v <= 0 ? 0 : v >= 1 ? 1 : v; }
