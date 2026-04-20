# PlacementValidator.gd
# Static validation functions. No UI, no state mutation.
class_name PlacementValidator

const GC = preload("res://logic/GameConstants.gd")

# ── Main entry point ──────────────────────────────────────────────────────────
static func validate(req: Dictionary, tiles: Array, placed: Array,
					  cash: int, bar_exists: bool) -> int:
	# req: { type, col, row, rotated }
	var def := GC.get_def(req.type)
	var w   := def.fh if req.rotated else def.fw
	var h   := def.fw if req.rotated else def.fh

	# 1. Instance limit
	if def.max == 1 and bar_exists:
		return GC.ValResult.FAIL_LIMIT

	# 2. Affordability
	if cash < def.cost:
		return GC.ValResult.FAIL_AFFORD

	# 3. Bounds
	if req.col < 0 or req.row < 0 or req.col + w > GC.GRID_COLS or req.row + h > GC.GRID_ROWS:
		return GC.ValResult.FAIL_OUT_OF_BOUNDS

	var footprint := compute_footprint(req.col, req.row, w, h)

	# 4. Zone check
	for coord in footprint:
		var t := get_tile(tiles, coord.x, coord.y)
		if t.tile_type != GC.TileType.FLOOR:
			return GC.ValResult.FAIL_WRONG_ZONE

	# 5. Collision check
	for coord in footprint:
		var t := get_tile(tiles, coord.x, coord.y)
		if t.obj_id != "":
			return GC.ValResult.FAIL_COLLISION

	# 6 & 7. Wall objects
	if def.is_wall:
		var wall_dir := detect_wall_dir(req.col, req.row, w, h, tiles)
		if wall_dir == "":
			return GC.ValResult.FAIL_WALL_INVALID
		var doors := get_door_tiles(req, w, h)
		for door in doors:
			var inward := get_inward(door, wall_dir)
			if not is_free_floor(tiles, inward.x, inward.y):
				return GC.ValResult.FAIL_DOOR_BLOCKED

	# 8. Floor access
	if not def.is_wall:
		if req.type == GC.ObjType.SLOT_MACHINE:
			if count_free_neighbours(tiles, req.col, req.row) == 0:
				return GC.ValResult.FAIL_NO_ACCESS
		elif req.type in [GC.ObjType.SMALL_TABLE, GC.ObjType.LARGE_TABLE]:
			if count_accessible_sides(tiles, req.col, req.row, w, h) < 2:
				return GC.ValResult.FAIL_NO_ACCESS

	return GC.ValResult.VALID

# ── Footprint ─────────────────────────────────────────────────────────────────
static func compute_footprint(col: int, row: int, w: int, h: int) -> Array:
	var result := []
	for r in range(row, row + h):
		for c in range(col, col + w):
			result.append(Vector2i(c, r))
	return result

# ── Tile lookup ───────────────────────────────────────────────────────────────
static func get_tile(tiles: Array, col: int, row: int) -> Dictionary:
	if col < 0 or col >= GC.GRID_COLS or row < 0 or row >= GC.GRID_ROWS:
		return { "tile_type": GC.TileType.WALL, "obj_id": "blocked" }
	return tiles[row * GC.GRID_COLS + col]

static func is_free_floor(tiles: Array, col: int, row: int) -> bool:
	if col < 0 or col >= GC.GRID_COLS or row < 0 or row >= GC.GRID_ROWS:
		return false
	var t := tiles[row * GC.GRID_COLS + col]
	return t.tile_type == GC.TileType.FLOOR and t.obj_id == ""

# ── Wall detection ────────────────────────────────────────────────────────────
static func detect_wall_dir(col: int, row: int, w: int, h: int, tiles: Array) -> String:
	# Top
	if row > 0 and _is_valid_wall_run(tiles, col, row - 1, w, true):
		return "top"
	# Bottom
	if row + h < GC.GRID_ROWS and _is_valid_wall_run(tiles, col, row + h, w, true):
		return "bottom"
	# Left
	if col > 0 and _is_valid_wall_run(tiles, col - 1, row, h, false):
		return "left"
	# Right
	if col + w < GC.GRID_COLS and _is_valid_wall_run(tiles, col + w, row, h, false):
		return "right"
	return ""

static func _is_valid_wall_run(tiles: Array, sc: int, sr: int, length: int, horiz: bool) -> bool:
	for i in range(length):
		var c := sc + i if horiz else sc
		var r := sr if horiz else sr + i
		if c < 0 or c >= GC.GRID_COLS or r < 0 or r >= GC.GRID_ROWS:
			return false
		var t := tiles[r * GC.GRID_COLS + c]
		if t.tile_type != GC.TileType.WALL:
			return false
		# Reject lobby strip walls
		if c == GC.LOBBY_START_COL or c == GC.LOBBY_END_COL:
			return false
	return true

# ── Door tiles ────────────────────────────────────────────────────────────────
static func get_door_tiles(req: Dictionary, w: int, h: int) -> Array:
	var col: int = req.col
	var row: int = req.row
	var horizontal: bool = w >= h

	match req.type:
		GC.ObjType.WC:
			if horizontal:
				return [Vector2i(col + 1, row)]
			else:
				return [Vector2i(col, row + 1)]
		GC.ObjType.BAR:
			if horizontal:
				return [Vector2i(col + 3, row), Vector2i(col + 4, row)]
			else:
				return [Vector2i(col, row + 3), Vector2i(col, row + 4)]
	return []

static func get_inward(door: Vector2i, wall_dir: String) -> Vector2i:
	match wall_dir:
		"top":    return Vector2i(door.x, door.y + 1)
		"bottom": return Vector2i(door.x, door.y - 1)
		"left":   return Vector2i(door.x + 1, door.y)
		"right":  return Vector2i(door.x - 1, door.y)
	return door

# ── Access checks ─────────────────────────────────────────────────────────────
static func count_free_neighbours(tiles: Array, col: int, row: int) -> int:
	var count := 0
	for d in [Vector2i(-1,0), Vector2i(1,0), Vector2i(0,-1), Vector2i(0,1)]:
		if is_free_floor(tiles, col + d.x, row + d.y):
			count += 1
	return count

static func count_accessible_sides(tiles: Array, col: int, row: int, w: int, h: int) -> int:
	var sides := 0
	# Top
	for c in range(col, col + w):
		if is_free_floor(tiles, c, row - 1):
			sides += 1; break
	# Bottom
	for c in range(col, col + w):
		if is_free_floor(tiles, c, row + h):
			sides += 1; break
	# Left
	for r in range(row, row + h):
		if is_free_floor(tiles, col - 1, r):
			sides += 1; break
	# Right
	for r in range(row, row + h):
		if is_free_floor(tiles, col + w, r):
			sides += 1; break
	return sides
