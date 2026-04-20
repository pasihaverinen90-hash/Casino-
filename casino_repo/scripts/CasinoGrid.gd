# CasinoGrid.gd
# Renders the tile grid and placed objects. Handles placement ghost and input.
# Attach to a SubViewportContainer > SubViewport > Node2D setup, or a plain Control.
extends Control

const GC  = preload("res://logic/GameConstants.gd")
const PV  = preload("res://logic/PlacementValidator.gd")

@export var tile_size : int = 20   # pixels per tile

# Placement mode state
var placement_active  : bool = false
var place_type        : int  = 0
var place_rotated     : bool = false
var place_variant     : String = ""
var ghost_col         : int  = -1
var ghost_row         : int  = -1
var ghost_valid       : bool = false

# Demolish mode
var demolish_mode     : bool = false

# Camera pan
var _pan_origin       : Vector2 = Vector2.ZERO
var _view_offset      : Vector2 = Vector2.ZERO
var _dragging         : bool = false
var _drag_start_mouse : Vector2 = Vector2.ZERO
var _drag_start_offset: Vector2 = Vector2.ZERO

signal object_tapped(obj_id: String)
signal placement_confirmed(col: int, row: int, obj_type: int, rotated: bool, variant: String)

func _ready() -> void:
	GameState.state_changed.connect(queue_redraw)
	set_process_input(true)
	# Default offset: center grid
	_view_offset = Vector2.ZERO

func enter_placement_mode(obj_type: int, variant: String = "") -> void:
	placement_active = true
	place_type       = obj_type
	place_variant    = variant
	place_rotated    = false
	demolish_mode    = false
	queue_redraw()

func exit_placement_mode() -> void:
	placement_active = false
	ghost_col = -1; ghost_row = -1
	queue_redraw()

func toggle_demolish(enabled: bool) -> void:
	demolish_mode    = enabled
	placement_active = false
	queue_redraw()

# ── Draw ──────────────────────────────────────────────────────────────────────
func _draw() -> void:
	var gs   := GameState
	var ts   := tile_size
	var off  := _view_offset

	# Tiles
	for row in GC.GRID_ROWS:
		for col in GC.GRID_COLS:
			var t := gs.tiles[row * GC.GRID_COLS + col]
			var colour := _tile_colour(t.tile_type)
			var rect   := Rect2(off.x + col * ts, off.y + row * ts, ts - 1, ts - 1)
			draw_rect(rect, colour)

	# Placed objects
	for obj in gs.placed_objs:
		var def    := GC.get_def(obj.type)
		var colour := GC.OBJ_COLOURS.get(obj.type, Color.GRAY)
		var rect   := Rect2(
			off.x + obj.col * ts,
			off.y + obj.row * ts,
			obj.w * ts - 1,
			obj.h * ts - 1
		)
		draw_rect(rect, colour)
		# Label
		var label_pos := Vector2(rect.position.x + 2, rect.position.y + ts * 0.6)
		var short := def.label.substr(0, 2)
		draw_string(ThemeDB.fallback_font, label_pos, short, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.WHITE)

	# Ghost
	if placement_active and ghost_col >= 0:
		var def := GC.get_def(place_type)
		var w   := def.fh if place_rotated else def.fw
		var h   := def.fw if place_rotated else def.fh
		var gc  := GC.COL_GHOST_VALID if ghost_valid else GC.COL_GHOST_INVALID
		var rect := Rect2(off.x + ghost_col * ts, off.y + ghost_row * ts, w * ts, h * ts)
		draw_rect(rect, gc)

	# Demolish overlay — highlight all objects
	if demolish_mode:
		for obj in gs.placed_objs:
			var rect := Rect2(
				off.x + obj.col * ts, off.y + obj.row * ts,
				obj.w * ts - 1, obj.h * ts - 1
			)
			draw_rect(rect, Color(1, 0.2, 0.2, 0.4))

func _tile_colour(tile_type: int) -> Color:
	match tile_type:
		GC.TileType.WALL:    return GC.COL_WALL
		GC.TileType.LOBBY:   return GC.COL_LOBBY
		GC.TileType.BLOCKED: return GC.COL_BLOCKED
	return GC.COL_FLOOR

# ── Input ─────────────────────────────────────────────────────────────────────
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		_handle_mouse_button(event)
	elif event is InputEventMouseMotion:
		_handle_mouse_motion(event)
	elif event is InputEventScreenDrag:
		_handle_screen_drag(event)
	elif event is InputEventScreenTouch:
		_handle_touch(event)

func _handle_mouse_button(event: InputEventMouseButton) -> void:
	if event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_drag_start_mouse  = event.position
			_drag_start_offset = _view_offset
			_dragging          = false
		else:
			if not _dragging:
				_handle_tap(event.position)

	elif event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
		if placement_active:
			place_rotated = not place_rotated
			_update_ghost(event.position)
			queue_redraw()

func _handle_mouse_motion(event: InputEventMouseMotion) -> void:
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var delta := event.position - _drag_start_mouse
		if delta.length() > 5:
			_dragging      = true
			if placement_active:
				_update_ghost(event.position)
			else:
				_view_offset = _drag_start_offset + delta
				_clamp_offset()
			queue_redraw()
	elif placement_active:
		_update_ghost(event.position)
		queue_redraw()

func _handle_screen_drag(event: InputEventScreenDrag) -> void:
	if placement_active:
		_update_ghost(event.position)
	else:
		_view_offset += event.relative
		_clamp_offset()
	queue_redraw()

func _handle_touch(event: InputEventScreenTouch) -> void:
	if not event.pressed:
		_handle_tap(event.position)

func _handle_tap(pos: Vector2) -> void:
	var coord := _pos_to_tile(pos)
	if coord.x < 0:
		return

	if placement_active:
		# Confirm placement
		emit_signal("placement_confirmed", coord.x, coord.y, place_type, place_rotated, place_variant)
		exit_placement_mode()
		return

	if demolish_mode:
		# Find object at this tile
		var obj_id := _obj_at(coord.x, coord.y)
		if obj_id != "":
			GameState.demolish(obj_id)
		return

	# Normal tap — check for object
	var obj_id := _obj_at(coord.x, coord.y)
	if obj_id != "":
		emit_signal("object_tapped", obj_id)

# ── Helpers ───────────────────────────────────────────────────────────────────
func _update_ghost(mouse_pos: Vector2) -> void:
	var coord := _pos_to_tile(mouse_pos)
	if coord.x < 0:
		ghost_col = -1; ghost_row = -1; ghost_valid = false
		return
	ghost_col = coord.x; ghost_row = coord.y
	var req := { "type": place_type, "col": ghost_col, "row": ghost_row, "rotated": place_rotated }
	ghost_valid = (PV.validate(req, GameState.tiles, GameState.placed_objs,
								GameState.cash, GameState.bar_exists) == GC.ValResult.VALID)

func _pos_to_tile(pos: Vector2) -> Vector2i:
	var col := int((pos.x - _view_offset.x) / tile_size)
	var row := int((pos.y - _view_offset.y) / tile_size)
	if col < 0 or col >= GC.GRID_COLS or row < 0 or row >= GC.GRID_ROWS:
		return Vector2i(-1, -1)
	return Vector2i(col, row)

func _obj_at(col: int, row: int) -> String:
	return GameState.tiles[row * GC.GRID_COLS + col].obj_id

func _clamp_offset() -> void:
	var min_x := -(GC.GRID_COLS * tile_size - size.x * 0.5)
	var min_y := -(GC.GRID_ROWS * tile_size - size.y * 0.5)
	_view_offset.x = clampf(_view_offset.x, min_x, size.x * 0.5)
	_view_offset.y = clampf(_view_offset.y, min_y, size.y * 0.5)
