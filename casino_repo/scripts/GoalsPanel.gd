# GoalsPanel.gd
# Full-screen goals list overlay.
extends Control

const GC = preload("res://logic/GameConstants.gd")

@onready var goal_list : VBoxContainer = $VBox/Scroll/GoalList
@onready var btn_close : Button        = $VBox/TitleRow/BtnClose

func _ready() -> void:
	btn_close.pressed.connect(func(): hide())
	GameState.state_changed.connect(func():
		if visible: _refresh()
	)
	GameState.goal_completed.connect(func(_i, _r): _refresh())

func _refresh() -> void:
	for child in goal_list.get_children():
		child.queue_free()

	var gs := GameState
	for i in 10:
		var row := HBoxContainer.new()

		# Status icon
		var icon := Label.new()
		icon.custom_minimum_size = Vector2(24, 0)
		if gs.completed_goals[i]:
			icon.text = "✓"
			icon.modulate = Color(0.4, 0.9, 0.4)
		elif i == gs.active_goal:
			icon.text = "▶"
			icon.modulate = Color(1.0, 0.9, 0.3)
		else:
			icon.text = "○"
			icon.modulate = Color(0.5, 0.5, 0.5)
		row.add_child(icon)

		# Goal info
		var info_col := VBoxContainer.new()
		info_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL

		var name_lbl := Label.new()
		name_lbl.text = GC.GOAL_LABELS[i]
		if i > gs.active_goal and not gs.completed_goals[i]:
			name_lbl.modulate = Color(0.5, 0.5, 0.5)

		var desc_lbl := Label.new()
		desc_lbl.text = GC.GOAL_DESCS[i]
		desc_lbl.modulate = Color(0.7, 0.7, 0.7)
		var font_size := desc_lbl.get_theme_font_size("font_size")
		desc_lbl.add_theme_font_size_override("font_size", 12)

		info_col.add_child(name_lbl)
		info_col.add_child(desc_lbl)

		# Progress bar for active goal
		if i == gs.active_goal:
			var bar := ProgressBar.new()
			bar.max_value = 1.0
			bar.value     = gs.get_goal_progress(i)
			bar.custom_minimum_size = Vector2(0, 12)
			info_col.add_child(bar)

		row.add_child(info_col)
		goal_list.add_child(row)

		# Separator
		var sep := HSeparator.new()
		goal_list.add_child(sep)

func open() -> void:
	_refresh()
	show()
