# HotelPanel.gd
# Slide-up hotel panel: room purchases and quality upgrades.
extends PanelContainer

@onready var lbl_rooms     : Label  = $VBox/InfoSection/LblRooms
@onready var lbl_quality   : Label  = $VBox/InfoSection/LblQuality
@onready var lbl_booked    : Label  = $VBox/InfoSection/LblBooked
@onready var lbl_income    : Label  = $VBox/InfoSection/LblIncome
@onready var btn_rooms2    : Button = $VBox/RoomSection/BtnRooms2
@onready var btn_rooms4    : Button = $VBox/RoomSection/BtnRooms4
@onready var btn_rooms8    : Button = $VBox/RoomSection/BtnRooms8
@onready var btn_upgrade   : Button = $VBox/QualitySection/BtnUpgrade
@onready var lbl_upgrade   : Label  = $VBox/QualitySection/LblUpgrade
@onready var btn_close     : Button = $VBox/TitleRow/BtnClose

const ROOM_OPTIONS := [
	{"rooms": 2, "cost": 1000, "label": "+2 rooms"},
	{"rooms": 4, "cost": 1800, "label": "+4 rooms"},
	{"rooms": 8, "cost": 3200, "label": "+8 rooms"},
]
const UPGRADE_COSTS := [0, 2000, 4000]

func _ready() -> void:
	GameState.state_changed.connect(_refresh)
	btn_close.pressed.connect(func(): hide())
	btn_rooms2.pressed.connect(func(): GameState.buy_rooms(2, 1000))
	btn_rooms4.pressed.connect(func(): GameState.buy_rooms(4, 1800))
	btn_rooms8.pressed.connect(func(): GameState.buy_rooms(8, 3200))
	btn_upgrade.pressed.connect(func(): GameState.upgrade_quality())
	_refresh()

func _refresh() -> void:
	var gs := GameState
	lbl_rooms.text   = "Rooms: %d" % gs.room_count
	lbl_quality.text = "Quality: %s (Level %d)" % [_stars(gs.quality_level), gs.quality_level]
	lbl_booked.text  = "Booked: %d / %d  (%.0f%%)" % [gs.booked_rooms, gs.room_count, gs.occupancy_rate * 100]
	lbl_income.text  = "Hotel income: ~%d 💰/day" % (gs.booked_rooms * 25)

	# Room buttons
	var room_btns := [btn_rooms2, btn_rooms4, btn_rooms8]
	for i in 3:
		var opt    := ROOM_OPTIONS[i]
		var btn    := room_btns[i]
		btn.text     = "%s — %d 💰" % [opt.label, opt.cost]
		btn.disabled = gs.cash < opt.cost

	# Quality upgrade
	if gs.quality_level >= 3:
		btn_upgrade.text     = "Maximum quality reached"
		btn_upgrade.disabled = true
		lbl_upgrade.text     = ""
	else:
		var cost := UPGRADE_COSTS[gs.quality_level]
		btn_upgrade.text     = "Upgrade to Level %d — %d 💰" % [gs.quality_level + 1, cost]
		btn_upgrade.disabled = gs.cash < cost
		lbl_upgrade.text     = "Adds +0.25 to Resort Rating"

func _stars(level: int) -> String:
	return "★".repeat(level) + "☆".repeat(3 - level)

func open() -> void:
	_refresh()
	show()
