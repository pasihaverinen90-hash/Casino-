# GoalTicker.gd
# Thin persistent strip showing the active goal. Tap to open goals panel.
extends Button

const GC = preload("res://logic/GameConstants.gd")

signal open_goals_panel()

func _ready() -> void:
	GameState.state_changed.connect(_refresh)
	GameState.goal_completed.connect(_on_goal_done)
	pressed.connect(func(): emit_signal("open_goals_panel"))
	_refresh()

func _refresh() -> void:
	var gs  := GameState
	var idx := gs.active_goal
	if idx >= 10:
		text = "✓  All goals complete — view summary"
		return
	text = "▶  %s — %s" % [GC.GOAL_LABELS[idx], GC.GOAL_DESCS[idx]]

func _on_goal_done(index: int, reward: int) -> void:
	text = "✓  %s complete! +%d cash" % [GC.GOAL_LABELS[index], reward]
	# Brief flash then refresh
	await get_tree().create_timer(2.5).timeout
	_refresh()
