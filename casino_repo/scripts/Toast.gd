# Toast.gd
# Brief pop-up notification. Auto-hides after a delay.
extends PanelContainer

@onready var label : Label = $Label

func _ready() -> void:
	hide()
	GameState.toast_requested.connect(show_toast)
	GameState.goal_completed.connect(func(idx, reward):
		show_toast("✓ %s complete! +%d 💰" % [
			preload("res://logic/GameConstants.gd").GOAL_LABELS[idx], reward
		])
	)
	GameState.placement_failed.connect(show_toast)

func show_toast(message: String) -> void:
	label.text = message
	show()
	await get_tree().create_timer(2.5).timeout
	hide()
