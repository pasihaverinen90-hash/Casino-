# GameConstants.gd
# Static class. All constants, enums, and object definitions live here.
# Import with: const GC = preload("res://logic/GameConstants.gd")
class_name GameConstants

# ── Grid ──────────────────────────────────────────────────────────────────────
const GRID_COLS          := 36
const GRID_ROWS          := 24
const LOBBY_START_COL    := 15
const LOBBY_END_COL      := 20

# ── Economy ───────────────────────────────────────────────────────────────────
const STARTING_CASH      := 7500
const HISTORY_MAX        := 60
const DEMOLISH_REFUND    := 0.5

# ── Rating ────────────────────────────────────────────────────────────────────
const RATING_BASE        := 1.50
const RATING_MIN         := 1.0
const RATING_MAX         := 5.0
const CROWDING_SMOOTH    := 0.4   # 1.0 = no smoothing

# ── Guests ────────────────────────────────────────────────────────────────────
const BASE_DEMAND        := 30

# ── Revenue ───────────────────────────────────────────────────────────────────
const REV_SLOT           := 12
const REV_SMALL_TABLE    := 22
const REV_LARGE_TABLE    := 30
const REV_BAR            := 8
const REV_PER_ROOM       := 25
const BAR_DRAW_RATE      := 0.15

# ── Goals ─────────────────────────────────────────────────────────────────────
const GOAL_REWARDS       := [500, 800, 600, 1200, 1000, 1500, 1000, 2000, 1500, 3000]
const GOAL_LABELS        := [
	"First Machines", "First Crowd", "Basic Amenity", "Real Gaming",
	"Rising Star", "First Profit", "Hotel Open", "Busy Floor",
	"Quality Service", "Grand Bar"
]
const GOAL_DESCS := [
	"Build 3 slot machines",
	"Reach 35 guests/day",
	"Build your first WC",
	"Build your first small table",
	"Reach Resort Rating 2.0",
	"Earn 5,000 total",
	"Expand hotel to 4 rooms",
	"Reach 60 guests/day",
	"Upgrade hotel to quality 2",
	"Build the bar"
]

# ── Tile colours (used by grid renderer) ─────────────────────────────────────
const COL_FLOOR          := Color(0.18, 0.20, 0.22)
const COL_WALL           := Color(0.12, 0.13, 0.14)
const COL_LOBBY          := Color(0.25, 0.22, 0.15)
const COL_BLOCKED        := Color(0.15, 0.18, 0.25)
const COL_GHOST_VALID    := Color(0.2, 0.9, 0.3, 0.5)
const COL_GHOST_INVALID  := Color(0.9, 0.2, 0.2, 0.5)

# ── Object colours ────────────────────────────────────────────────────────────
const OBJ_COLOURS := {
	0: Color(0.8, 0.7, 0.1),   # SLOT_MACHINE  - gold
	1: Color(0.2, 0.5, 0.9),   # SMALL_TABLE   - blue
	2: Color(0.1, 0.3, 0.8),   # LARGE_TABLE   - dark blue
	3: Color(0.3, 0.7, 0.4),   # WC            - green
	4: Color(0.8, 0.3, 0.2),   # BAR           - red
}

# ── Enums ─────────────────────────────────────────────────────────────────────
enum TileType   { FLOOR, WALL, LOBBY, BLOCKED }
enum ObjType    { SLOT_MACHINE, SMALL_TABLE, LARGE_TABLE, WC, BAR }
enum ValResult  {
	VALID,
	FAIL_LIMIT, FAIL_AFFORD, FAIL_OUT_OF_BOUNDS,
	FAIL_WRONG_ZONE, FAIL_COLLISION,
	FAIL_WALL_INVALID, FAIL_DOOR_BLOCKED, FAIL_NO_ACCESS
}

# ── Object definitions ────────────────────────────────────────────────────────
static func get_def(type: int) -> Dictionary:
	match type:
		ObjType.SLOT_MACHINE:
			return { "label":"Slot Machine", "cost":750,  "fw":1, "fh":1,
					 "cap":1,  "is_wall":false, "max":-1, "rating":0.02, "flat":false }
		ObjType.SMALL_TABLE:
			return { "label":"Small Table",  "cost":2500, "fw":2, "fh":3,
					 "cap":4,  "is_wall":false, "max":-1, "rating":0.18, "flat":false }
		ObjType.LARGE_TABLE:
			return { "label":"Large Table",  "cost":4500, "fw":2, "fh":4,
					 "cap":6,  "is_wall":false, "max":-1, "rating":0.25, "flat":false }
		ObjType.WC:
			return { "label":"WC",           "cost":1200, "fw":3, "fh":1,
					 "cap":0,  "is_wall":true,  "max":-1, "rating":0.20, "flat":false }
		ObjType.BAR:
			return { "label":"Bar",          "cost":6500, "fw":8, "fh":1,
					 "cap":0,  "is_wall":true,  "max":1,  "rating":0.35, "flat":true  }
	return {}

static func val_message(result: int) -> String:
	match result:
		ValResult.FAIL_LIMIT:           return "Only one bar can be built."
		ValResult.FAIL_AFFORD:          return "Not enough cash."
		ValResult.FAIL_OUT_OF_BOUNDS:   return "Cannot place outside the casino floor."
		ValResult.FAIL_WRONG_ZONE:      return "Cannot place here."
		ValResult.FAIL_COLLISION:       return "Something is already here."
		ValResult.FAIL_WALL_INVALID:    return "Must be placed against a wall."
		ValResult.FAIL_DOOR_BLOCKED:    return "The entrance must not be blocked."
		ValResult.FAIL_NO_ACCESS:       return "Needs at least one open approach."
	return ""
