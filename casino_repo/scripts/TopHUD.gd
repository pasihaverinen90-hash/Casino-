# TopHUD.gd
# Persistent top strip: Rating | Guests | Cash | Day
extends HBoxContainer

@onready var lbl_rating  : Label = $LblRating
@onready var lbl_guests  : Label = $LblGuests
@onready var lbl_cash    : Label = $LblCash
@onready var lbl_day     : Label = $LblDay

func _ready() -> void:
	GameState.state_changed.connect(_refresh)
	_refresh()

func _refresh() -> void:
	var gs := GameState
	lbl_rating.text  = "★ %.1f" % gs.resort_rating
	lbl_guests.text  = "👥 %d/day" % gs.total_guests
	lbl_cash.text    = "💰 %s" % _fmt_cash(gs.cash)
	lbl_day.text     = "Day %d" % gs.day_number

func _fmt_cash(v: int) -> String:
	if v >= 1000:
		return "%d,%03d" % [v / 1000, v % 1000]
	return str(v)
