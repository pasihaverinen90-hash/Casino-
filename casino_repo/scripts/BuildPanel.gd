# BuildPanel.gd
# Slide-up build menu. Emits signals for placement and demolish mode.
extends PanelContainer

const GC = preload("res://logic/GameConstants.gd")

signal request_placement(obj_type: int, variant: String)
signal toggle_demolish(enabled: bool)

@onready var container    : GridContainer = $VBox/ScrollContainer/ItemGrid
@onready var btn_demolish : Button        = $VBox/TitleRow/BtnDemolish
@onready var btn_close    : Button        = $VBox/TitleRow/BtnClose

var _demolish_active := false

func _ready() -> void:
	GameState.state_changed.connect(_refresh)
	btn_demolish.pressed.connect(_toggle_demolish)
	btn_close.pressed.connect(func(): hide())
	_build_buttons()
	_refresh()

func _build_buttons() -> void:
	for child in container.get_children():
		child.queue_free()

	var types := [GC.ObjType.SLOT_MACHINE, GC.ObjType.SMALL_TABLE,
				  GC.ObjType.LARGE_TABLE, GC.ObjType.WC, GC.ObjType.BAR]

	for t in types:
		var def    := GC.get_def(t)
		var btn    := Button.new()
		btn.name   = "ObjBtn_%d" % t
		btn.text   = "%s\n%s\n%d 💰" % [def.label, _size_label(def), def.cost]
		btn.custom_minimum_size = Vector2(100, 80)
		btn.pressed.connect(_on_obj_pressed.bind(t, def))
		container.add_child(btn)

func _size_label(def: Dictionary) -> String:
	if def.is_wall:
		return "%d×1 wall" % def.fw
	return "%d×%d" % [def.fw, def.fh]

func _refresh() -> void:
	var gs := GameState
	for btn in container.get_children():
		var t := int(btn.name.replace("ObjBtn_", ""))
		var def := GC.get_def(t)
		var unaffordable := gs.cash < def.cost
		var at_limit     := (t == GC.ObjType.BAR and gs.bar_exists)
		btn.disabled = unaffordable or at_limit
		btn.modulate = Color(0.5, 0.5, 0.5) if (unaffordable or at_limit) else Color.WHITE
		if at_limit:
			btn.text = "%s\nAlready built" % def.label

func _on_obj_pressed(t: int, def: Dictionary) -> void:
	# For tables: show variant choice inline (simple dialog)
	if t == GC.ObjType.SMALL_TABLE or t == GC.ObjType.LARGE_TABLE:
		_show_variant_picker(t)
	else:
		emit_signal("request_placement", t, "")
		hide()

func _show_variant_picker(t: int) -> void:
	var variants := ["blackjack", "poker"] if t == GC.ObjType.SMALL_TABLE else ["roulette", "craps"]
	# Create a simple popup
	var popup := AcceptDialog.new()
	popup.title = "Choose type"
	var vbox   := VBoxContainer.new()
	for v in variants:
		var b := Button.new()
		b.text = v.capitalize()
		b.pressed.connect(func():
			emit_signal("request_placement", t, v)
			popup.queue_free()
			hide()
		)
		vbox.add_child(b)
	popup.add_child(vbox)
	get_tree().current_scene.add_child(popup)
	popup.popup_centered(Vector2(200, 120))

func _toggle_demolish() -> void:
	_demolish_active = not _demolish_active
	btn_demolish.modulate = Color(1, 0.3, 0.3) if _demolish_active else Color.WHITE
	emit_signal("toggle_demolish", _demolish_active)

func open() -> void:
	_demolish_active = false
	btn_demolish.modulate = Color.WHITE
	_refresh()
	show()
