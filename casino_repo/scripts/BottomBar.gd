# BottomBar.gd
# Bottom action bar: Build | Hotel | Stats | Day ▶
extends HBoxContainer

signal open_build()
signal open_hotel()
signal open_stats()

@onready var btn_build : Button = $BtnBuild
@onready var btn_hotel : Button = $BtnHotel
@onready var btn_stats : Button = $BtnStats
@onready var btn_day   : Button = $BtnDay

var _active_panel := ""   # "build" | "hotel" | "stats" | ""

func _ready() -> void:
	btn_build.pressed.connect(_on_build)
	btn_hotel.pressed.connect(_on_hotel)
	btn_stats.pressed.connect(_on_stats)
	btn_day.pressed.connect(_on_day)

func _on_build() -> void:
	if _active_panel == "build":
		close_all()
	else:
		_active_panel = "build"
		_update_highlights()
		emit_signal("open_build")

func _on_hotel() -> void:
	if _active_panel == "hotel":
		close_all()
	else:
		_active_panel = "hotel"
		_update_highlights()
		emit_signal("open_hotel")

func _on_stats() -> void:
	if _active_panel == "stats":
		close_all()
	else:
		_active_panel = "stats"
		_update_highlights()
		emit_signal("open_stats")

func _on_day() -> void:
	close_all()
	GameState.advance_day()

func close_all() -> void:
	_active_panel = ""
	_update_highlights()

func _update_highlights() -> void:
	btn_build.modulate = Color(1.0, 0.9, 0.3) if _active_panel == "build" else Color.WHITE
	btn_hotel.modulate = Color(1.0, 0.9, 0.3) if _active_panel == "hotel" else Color.WHITE
	btn_stats.modulate = Color(1.0, 0.9, 0.3) if _active_panel == "stats" else Color.WHITE
