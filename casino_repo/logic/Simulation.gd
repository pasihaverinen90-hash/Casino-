# Simulation.gd
# Pure formula functions. No state mutation. No UI imports.
# All functions are static — call as Simulation.function_name(...)
class_name Simulation

const GC = preload("res://logic/GameConstants.gd")

# ── Casino Capacity ───────────────────────────────────────────────────────────
static func calc_capacity(slots: int, small_tables: int, large_tables: int) -> int:
	return slots + (4 * small_tables) + (6 * large_tables)

# ── Crowding Penalty ──────────────────────────────────────────────────────────
static func calc_crowding(last_guests: int, capacity: int, prev_penalty: float) -> float:
	if capacity <= 0 or last_guests <= 0:
		return lerp(prev_penalty, 0.0, GC.CROWDING_SMOOTH)
	var ratio := float(last_guests) / float(capacity)
	var raw := maxf(0.0, (ratio - 1.0) * 0.5)
	return (GC.CROWDING_SMOOTH * raw) + ((1.0 - GC.CROWDING_SMOOTH) * prev_penalty)

# ── Resort Rating ─────────────────────────────────────────────────────────────
static func calc_rating(
		slots: int, small_tables: int, large_tables: int,
		wc_count: int, bar_exists: bool,
		room_count: int, quality_level: int,
		crowding_penalty: float) -> float:
	var raw: float = GC.RATING_BASE \
		+ (0.02 * slots) \
		+ (0.18 * small_tables) \
		+ (0.25 * large_tables) \
		+ (0.20 * wc_count) \
		+ (0.35 if bar_exists else 0.0) \
		+ (0.03 * room_count) \
		+ (0.25 * quality_level) \
		- crowding_penalty
	return clampf(raw, GC.RATING_MIN, GC.RATING_MAX)

# ── Hotel Occupancy ───────────────────────────────────────────────────────────
static func calc_occupancy(room_count: int, quality_level: int, rating: float) -> Dictionary:
	if room_count <= 0:
		return { "rate": 0.0, "booked": 0, "hotel_guests": 0 }
	var rate := minf(1.0, 0.35 + (0.10 * rating) + (0.08 * quality_level))
	var booked := floori(room_count * rate)
	var hotel_guests := roundi(booked * 0.9)
	return { "rate": rate, "booked": booked, "hotel_guests": hotel_guests }

# ── Walk-in Guests ────────────────────────────────────────────────────────────
static func calc_walkin(capacity: int, rating: float) -> int:
	if capacity <= 0:
		return 0
	var rm := 0.6 + (rating / 5.0)
	var cm := minf(1.5, float(capacity) / 30.0)
	return roundi(GC.BASE_DEMAND * rm * cm)

# ── Revenue ───────────────────────────────────────────────────────────────────
static func calc_revenue(
		total_guests: int, booked_rooms: int,
		slots: int, small_tables: int, large_tables: int,
		bar_exists: bool) -> Dictionary:

	var slot_cap   := slots
	var table_cap  := (4 * small_tables) + (6 * large_tables)
	var floor_cap  := slot_cap + table_cap

	var slot_guests := 0
	var small_guests := 0
	var large_guests := 0

	if floor_cap > 0:
		slot_guests = roundi(float(total_guests) * (float(slot_cap) / float(floor_cap)))
		var table_guests := total_guests - slot_guests
		if table_cap > 0:
			var small_share := float(4 * small_tables) / float(table_cap)
			small_guests = roundi(float(table_guests) * small_share)
			large_guests = table_guests - small_guests

	var bar_guests := roundi(total_guests * GC.BAR_DRAW_RATE) if bar_exists else 0

	var slot_rev        := slot_guests   * GC.REV_SLOT
	var small_rev       := small_guests  * GC.REV_SMALL_TABLE
	var large_rev       := large_guests  * GC.REV_LARGE_TABLE
	var bar_rev         := bar_guests    * GC.REV_BAR
	var hotel_rev       := booked_rooms  * GC.REV_PER_ROOM
	var total           := slot_rev + small_rev + large_rev + bar_rev + hotel_rev

	return {
		"total": total, "slot_rev": slot_rev, "small_rev": small_rev,
		"large_rev": large_rev, "bar_rev": bar_rev, "hotel_rev": hotel_rev,
		"slot_guests": slot_guests, "small_guests": small_guests,
		"large_guests": large_guests, "bar_guests": bar_guests
	}

# ── Full day simulation ───────────────────────────────────────────────────────
# Takes plain values in, returns a result Dictionary. Does not touch any node.
static func run_day(s: Dictionary) -> Dictionary:
	# s keys: slots, small_tables, large_tables, wc_count, bar_exists,
	#         room_count, quality_level, cash, cumulative_income,
	#         last_guests, prev_crowding, day_number

	var capacity    := calc_capacity(s.slots, s.small_tables, s.large_tables)
	var crowding    := calc_crowding(s.last_guests, capacity, s.prev_crowding)
	var rating      := calc_rating(s.slots, s.small_tables, s.large_tables,
								   s.wc_count, s.bar_exists,
								   s.room_count, s.quality_level, crowding)
	var hotel       := calc_occupancy(s.room_count, s.quality_level, rating)
	var walkin      := calc_walkin(capacity, rating)
	var total       := walkin + hotel.hotel_guests
	var rev         := calc_revenue(total, hotel.booked,
									s.slots, s.small_tables, s.large_tables, s.bar_exists)
	var net         := rev.total   # no costs in MVP
	var new_cash    := s.cash + net
	var new_cumul   := s.cumulative_income + net

	var day_stats := {
		"day": s.day_number,
		"total_guests": total,   "walkin": walkin,   "hotel_guests": hotel.hotel_guests,
		"revenue": rev.total,    "costs": 0,         "net": net,
		"cumulative": new_cumul, "cash": new_cash,
		"slot_rev": rev.slot_rev, "small_rev": rev.small_rev,
		"large_rev": rev.large_rev, "bar_rev": rev.bar_rev,
		"hotel_rev": rev.hotel_rev,
		"occupancy": hotel.rate, "booked": hotel.booked,
		"capacity": capacity,    "crowding": crowding, "rating": rating
	}

	return {
		"capacity": capacity,       "crowding": crowding,
		"rating": rating,           "occupancy": hotel.rate,
		"booked": hotel.booked,     "hotel_guests": hotel.hotel_guests,
		"walkin": walkin,           "total_guests": total,
		"net": net,                 "new_cash": new_cash,
		"new_cumul": new_cumul,     "new_last_guests": total,
		"day_stats": day_stats
	}
