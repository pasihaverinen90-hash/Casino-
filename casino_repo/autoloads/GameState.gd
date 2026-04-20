# GameState.gd  — Autoload singleton
# Holds all game data. Exposes action methods and signals.
# UI reads state; UI calls actions; GameState mutates and emits signals.
extends Node

const GC  = preload("res://logic/GameConstants.gd")
const Sim = preload("res://logic/Simulation.gd")
const PV  = preload("res://logic/PlacementValidator.gd")

const SAVE_KEY := "casino_resort_v1"

# ── Signals ───────────────────────────────────────────────────────────────────
signal state_changed()                        # full UI refresh
signal goal_completed(index: int, reward: int)
signal game_complete()
signal toast_requested(message: String)
signal placement_failed(reason: String)

# ── State ─────────────────────────────────────────────────────────────────────

# Map
var tiles        : Array = []   # Array of Dictionaries
var placed_objs  : Array = []   # Array of Dictionaries
var _next_id     : int   = 0

# Economy (cached counts always derived from placed_objs)
var cash              : int   = GC.STARTING_CASH
var cumulative_income : int   = 0
var last_guests       : int   = 0
var prev_crowding     : float = 0.0
var slot_count        : int   = 0
var small_table_count : int   = 0
var large_table_count : int   = 0
var wc_count          : int   = 0
var bar_exists        : bool  = false
var casino_capacity   : int   = 0
var resort_rating     : float = 1.75
var total_guests      : int   = 0
var walkin_guests     : int   = 0
var daily_revenue     : int   = 0

# Hotel
var room_count    : int   = 0
var quality_level : int   = 1
var occupancy_rate: float = 0.0
var booked_rooms  : int   = 0
var hotel_guests  : int   = 0

# Progression
var day_number       : int  = 1
var active_goal      : int  = 0
var completed_goals  : Array = []

# Stats history
var stats_records : Array = []   # DayStats Dictionaries
var chart_days    : Array = []
var chart_guests  : Array = []
var chart_revenue : Array = []
var chart_rating  : Array = []
var chart_occupancy: Array = []
var chart_capacity : Array = []

# ── Init ──────────────────────────────────────────────────────────────────────
func _ready() -> void:
	if not _try_load():
		_new_game()

func _new_game() -> void:
	tiles       = []
	placed_objs = []
	_next_id    = 0
	cash = GC.STARTING_CASH
	cumulative_income = 0; last_guests = 0; prev_crowding = 0.0
	slot_count = 0; small_table_count = 0; large_table_count = 0
	wc_count = 0; bar_exists = false
	casino_capacity = 0; resort_rating = 1.75
	total_guests = 0; walkin_guests = 0; daily_revenue = 0
	room_count = 0; quality_level = 1
	occupancy_rate = 0.0; booked_rooms = 0; hotel_guests = 0
	day_number = 1; active_goal = 0
	completed_goals = []
	for i in 10:
		completed_goals.append(false)
	stats_records = []
	chart_days=[]; chart_guests=[]; chart_revenue=[]
	chart_rating=[]; chart_occupancy=[]; chart_capacity=[]
	_build_grid()
	_recompute_derived()

func _build_grid() -> void:
	tiles.clear()
	for row in GC.GRID_ROWS:
		for col in GC.GRID_COLS:
			var t := { "col": col, "row": row, "tile_type": GC.TileType.FLOOR, "obj_id": "" }
			# Walls
			if col == 0 or col == GC.GRID_COLS - 1 or row == 0 or row == GC.GRID_ROWS - 1:
				t.tile_type = GC.TileType.WALL
			# Lobby strip
			elif col >= GC.LOBBY_START_COL and col <= GC.LOBBY_END_COL:
				t.tile_type = GC.TileType.LOBBY
			tiles.append(t)
	# Pre-placed: hotel reception (centre lobby, rows 8-9, cols 17-19)
	_mark_blocked(17, 8, 3, 2)
	# Elevators (cols 14 row 11 and cols 21 row 11)
	_mark_blocked(14, 11, 2, 1)
	_mark_blocked(21, 11, 2, 1)
	# Entrance (cols 16-19, row 23 is already wall; mark row 22 as blocked for visual)
	_mark_blocked(16, 22, 4, 1)

func _mark_blocked(col: int, row: int, w: int, h: int) -> void:
	for r in range(row, row + h):
		for c in range(col, col + w):
			if c >= 0 and c < GC.GRID_COLS and r >= 0 and r < GC.GRID_ROWS:
				tiles[r * GC.GRID_COLS + c].tile_type = GC.TileType.BLOCKED

# ── Place object ──────────────────────────────────────────────────────────────
func try_place(col: int, row: int, obj_type: int, rotated: bool, variant: String = "") -> bool:
	var req := { "type": obj_type, "col": col, "row": row, "rotated": rotated }
	var result := PV.validate(req, tiles, placed_objs, cash, bar_exists)
	if result != GC.ValResult.VALID:
		emit_signal("placement_failed", GC.val_message(result))
		return false

	var def := GC.get_def(obj_type)
	var w   := def.fh if rotated else def.fw
	var h   := def.fw if rotated else def.fh
	var fp  := PV.compute_footprint(col, row, w, h)
	var id  := "obj_%d" % _next_id
	_next_id += 1

	var obj := {
		"id": id, "type": obj_type, "col": col, "row": row,
		"rotated": rotated, "variant": variant, "tiles": fp,
		"w": w, "h": h
	}
	placed_objs.append(obj)

	for coord in fp:
		tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = id

	cash -= def.cost
	_update_counts()
	_check_goals()
	_save()
	emit_signal("state_changed")
	return true

# ── Demolish ──────────────────────────────────────────────────────────────────
func demolish(obj_id: String) -> void:
	var idx := -1
	for i in placed_objs.size():
		if placed_objs[i].id == obj_id:
			idx = i; break
	if idx == -1:
		return

	var obj := placed_objs[idx]
	var def := GC.get_def(obj.type)
	var refund := int(def.cost * GC.DEMOLISH_REFUND)

	for coord in obj.tiles:
		tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = ""

	placed_objs.remove_at(idx)
	cash += refund
	_update_counts()
	_check_goals()
	_save()
	emit_signal("state_changed")
	emit_signal("toast_requested", "Demolished. +%d cash" % refund)

# ── Hotel actions ─────────────────────────────────────────────────────────────
func buy_rooms(rooms_to_add: int, cost: int) -> bool:
	if cash < cost:
		emit_signal("toast_requested", "Not enough cash.")
		return false
	cash -= cost
	room_count += rooms_to_add
	_recompute_derived()
	_check_goals()
	_save()
	emit_signal("state_changed")
	return true

func upgrade_quality() -> bool:
	if quality_level >= 3:
		return false
	var costs := [0, 2000, 4000]
	var cost  := costs[quality_level]
	if cash < cost:
		emit_signal("toast_requested", "Not enough cash.")
		return false
	cash -= cost
	quality_level += 1
	_recompute_derived()
	_check_goals()
	_save()
	emit_signal("state_changed")
	return true

# ── Advance day ───────────────────────────────────────────────────────────────
func advance_day() -> void:
	var s := {
		"slots": slot_count, "small_tables": small_table_count,
		"large_tables": large_table_count, "wc_count": wc_count,
		"bar_exists": bar_exists, "room_count": room_count,
		"quality_level": quality_level, "cash": cash,
		"cumulative_income": cumulative_income,
		"last_guests": last_guests, "prev_crowding": prev_crowding,
		"day_number": day_number
	}
	var r := Sim.run_day(s)

	cash               = r.new_cash
	cumulative_income  = r.new_cumul
	last_guests        = r.new_last_guests
	prev_crowding      = r.crowding
	resort_rating      = r.rating
	casino_capacity    = r.capacity
	total_guests       = r.total_guests
	walkin_guests      = r.walkin
	daily_revenue      = r.net
	occupancy_rate     = r.occupancy
	booked_rooms       = r.booked
	hotel_guests       = r.hotel_guests

	_append_stats(r.day_stats)
	day_number += 1

	_check_goals()
	_save()
	emit_signal("state_changed")

# ── Helpers ───────────────────────────────────────────────────────────────────
func _update_counts() -> void:
	slot_count = 0; small_table_count = 0; large_table_count = 0
	wc_count = 0;   bar_exists = false
	for obj in placed_objs:
		match obj.type:
			GC.ObjType.SLOT_MACHINE:  slot_count += 1
			GC.ObjType.SMALL_TABLE:   small_table_count += 1
			GC.ObjType.LARGE_TABLE:   large_table_count += 1
			GC.ObjType.WC:            wc_count += 1
			GC.ObjType.BAR:           bar_exists = true
	casino_capacity = Sim.calc_capacity(slot_count, small_table_count, large_table_count)

func _recompute_derived() -> void:
	_update_counts()
	var crowding := Sim.calc_crowding(last_guests, casino_capacity, prev_crowding)
	resort_rating = Sim.calc_rating(
		slot_count, small_table_count, large_table_count,
		wc_count, bar_exists, room_count, quality_level, crowding)
	var hotel := Sim.calc_occupancy(room_count, quality_level, resort_rating)
	occupancy_rate = hotel.rate
	booked_rooms   = hotel.booked
	hotel_guests   = hotel.hotel_guests

func _append_stats(ds: Dictionary) -> void:
	stats_records.append(ds)
	if stats_records.size() > GC.HISTORY_MAX:
		stats_records.pop_front()
	chart_days.append(ds.day);          _trim(chart_days)
	chart_guests.append(ds.total_guests); _trim(chart_guests)
	chart_revenue.append(ds.revenue);   _trim(chart_revenue)
	chart_rating.append(ds.rating);     _trim(chart_rating)
	chart_occupancy.append(ds.occupancy); _trim(chart_occupancy)
	chart_capacity.append(ds.capacity); _trim(chart_capacity)

func _trim(arr: Array) -> void:
	if arr.size() > GC.HISTORY_MAX:
		arr.pop_front()

# ── Goal checking ─────────────────────────────────────────────────────────────
func _check_goals() -> void:
	if active_goal >= 10:
		return
	if not _is_goal_met(active_goal):
		return
	var idx := active_goal
	completed_goals[idx] = true
	active_goal += 1
	var reward := GC.GOAL_REWARDS[idx]
	cash += reward
	emit_signal("goal_completed", idx, reward)
	if active_goal >= 10:
		emit_signal("game_complete")
	else:
		# Cascade: immediately check next goal in case it's already met
		_check_goals()

func _is_goal_met(idx: int) -> bool:
	match idx:
		0: return slot_count         >= 3
		1: return total_guests       >= 35
		2: return wc_count           >= 1
		3: return small_table_count  >= 1
		4: return resort_rating      >= 2.0
		5: return cumulative_income  >= 5000
		6: return room_count         >= 4
		7: return total_guests       >= 60
		8: return quality_level      >= 2
		9: return bar_exists
	return false

func get_goal_progress(idx: int) -> float:
	match idx:
		0: return minf(1.0, float(slot_count) / 3.0)
		1: return minf(1.0, float(total_guests) / 35.0)
		2: return 1.0 if wc_count >= 1 else 0.0
		3: return 1.0 if small_table_count >= 1 else 0.0
		4: return minf(1.0, resort_rating / 2.0)
		5: return minf(1.0, float(cumulative_income) / 5000.0)
		6: return minf(1.0, float(room_count) / 4.0)
		7: return minf(1.0, float(total_guests) / 60.0)
		8: return 1.0 if quality_level >= 2 else 0.0
		9: return 1.0 if bar_exists else 0.0
	return 0.0

# ── Save / Load ───────────────────────────────────────────────────────────────
func _save() -> void:
	var save_objs := []
	for obj in placed_objs:
		save_objs.append({
			"id": obj.id, "type": obj.type, "col": obj.col, "row": obj.row,
			"rotated": obj.rotated, "variant": obj.variant
		})
	var data := {
		"ver": "1.1.0", "day": day_number,
		"objects": save_objs,
		"room_count": room_count, "quality": quality_level,
		"cash": cash, "cumul": cumulative_income,
		"last_guests": last_guests, "prev_crowding": prev_crowding,
		"next_id": _next_id,
		"active_goal": active_goal, "completed": completed_goals,
		"stats": stats_records,
		"ch_days": chart_days, "ch_guests": chart_guests,
		"ch_rev": chart_revenue, "ch_rating": chart_rating,
		"ch_occ": chart_occupancy, "ch_cap": chart_capacity
	}
	var file := FileAccess.open("user://save.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

func _try_load() -> bool:
	if not FileAccess.file_exists("user://save.json"):
		return false
	var file := FileAccess.open("user://save.json", FileAccess.READ)
	if not file:
		return false
	var text := file.get_as_text()
	file.close()
	var parsed := JSON.parse_string(text)
	if not parsed is Dictionary:
		return false
	var d: Dictionary = parsed
	if d.get("ver", "") != "1.1.0":
		return false  # incompatible save — start fresh

	_new_game()   # build fresh grid, then overwrite with saved values

	day_number        = d.day
	room_count        = d.room_count
	quality_level     = d.quality
	cash              = d.cash
	cumulative_income = d.cumul
	last_guests       = d.last_guests
	prev_crowding     = d.prev_crowding
	_next_id          = d.next_id
	active_goal       = d.active_goal
	completed_goals   = d.completed
	stats_records     = d.stats
	chart_days        = d.ch_days;  chart_guests  = d.ch_guests
	chart_revenue     = d.ch_rev;   chart_rating  = d.ch_rating
	chart_occupancy   = d.ch_occ;   chart_capacity = d.ch_cap

	# Restore placed objects
	for saved in d.objects:
		var def := GC.get_def(saved.type)
		var w   := def.fh if saved.rotated else def.fw
		var h   := def.fw if saved.rotated else def.fh
		var fp  := PV.compute_footprint(saved.col, saved.row, w, h)
		var obj := {
			"id": saved.id, "type": saved.type,
			"col": saved.col, "row": saved.row,
			"rotated": saved.rotated, "variant": saved.variant,
			"tiles": fp, "w": w, "h": h
		}
		placed_objs.append(obj)
		for coord in fp:
			tiles[coord.y * GC.GRID_COLS + coord.x].obj_id = saved.id

	_recompute_derived()
	_check_goals()   # catch any goal met before save occurred
	return true

func reset_game() -> void:
	if FileAccess.file_exists("user://save.json"):
		DirAccess.remove_absolute("user://save.json")
	_new_game()
	emit_signal("state_changed")
