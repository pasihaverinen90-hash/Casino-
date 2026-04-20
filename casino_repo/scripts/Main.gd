# Main.gd
# Root scene coordinator. Wires all panels and signals together.
# Does NOT contain game logic — that lives in GameState, Simulation, etc.
extends Control

@onready var grid        : Control        = $GridArea/CasinoGrid
@onready var top_hud     : HBoxContainer  = $TopHUD
@onready var goal_ticker : Button         = $GoalTicker
@onready var bottom_bar  : HBoxContainer  = $BottomBar
@onready var build_panel : PanelContainer = $Panels/BuildPanel
@onready var hotel_panel : PanelContainer = $Panels/HotelPanel
@onready var stats_panel : Control        = $Panels/StatsPanel
@onready var goals_panel : Control        = $Panels/GoalsPanel
@onready var toast       : PanelContainer = $Toast
@onready var end_screen  : Control        = $EndScreen
@onready var btn_reset   : Button         = $EndScreen/VBox/BtnReset

func _ready() -> void:
	# Panel visibility
	build_panel.hide()
	hotel_panel.hide()
	stats_panel.hide()
	goals_panel.hide()
	end_screen.hide()

	# Bottom bar → panels
	bottom_bar.open_build.connect(_open_build)
	bottom_bar.open_hotel.connect(_open_hotel)
	bottom_bar.open_stats.connect(_open_stats)

	# Goal ticker → goals panel
	goal_ticker.open_goals_panel.connect(func(): goals_panel.open())

	# Build panel → grid placement
	build_panel.request_placement.connect(_start_placement)
	build_panel.toggle_demolish.connect(grid.toggle_demolish)

	# Grid → confirm placement
	grid.placement_confirmed.connect(_confirm_placement)

	# Game events
	GameState.game_complete.connect(_on_game_complete)

	# End screen reset
	btn_reset.pressed.connect(func():
		GameState.reset_game()
		end_screen.hide()
	)

func _open_build() -> void:
	hotel_panel.hide()
	stats_panel.hide()
	goals_panel.hide()
	build_panel.open()

func _open_hotel() -> void:
	build_panel.hide()
	stats_panel.hide()
	goals_panel.hide()
	hotel_panel.open()

func _open_stats() -> void:
	build_panel.hide()
	hotel_panel.hide()
	goals_panel.hide()
	stats_panel.open()

func _start_placement(obj_type: int, variant: String) -> void:
	grid.enter_placement_mode(obj_type, variant)

func _confirm_placement(col: int, row: int, obj_type: int, rotated: bool, variant: String) -> void:
	GameState.try_place(col, row, obj_type, rotated, variant)

func _on_game_complete() -> void:
	var gs := GameState
	var vbox: VBoxContainer = end_screen.get_node("VBox")
	vbox.get_node("LblTitle").text  = "Resort Complete!"
	vbox.get_node("LblDays").text   = "Days played: %d" % gs.day_number
	vbox.get_node("LblRating").text = "Final Rating: %.1f ★" % gs.resort_rating
	vbox.get_node("LblEarned").text = "Total Earned: %d 💰" % gs.cumulative_income
	vbox.get_node("LblBuilt").text  = "Objects Built: %d" % gs.placed_objs.size()
	end_screen.show()

func _input(event: InputEvent) -> void:
	# Escape / back button closes open panels
	if event.is_action_pressed("ui_cancel"):
		if build_panel.visible:
			build_panel.hide(); bottom_bar.close_all()
		elif hotel_panel.visible:
			hotel_panel.hide(); bottom_bar.close_all()
		elif stats_panel.visible:
			stats_panel.hide(); bottom_bar.close_all()
		elif goals_panel.visible:
			goals_panel.hide()
		elif grid.placement_active:
			grid.exit_placement_mode()
		elif grid.demolish_mode:
			grid.toggle_demolish(false)
