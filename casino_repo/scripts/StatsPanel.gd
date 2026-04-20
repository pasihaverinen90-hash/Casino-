# StatsPanel.gd
# Full-screen overlay: Today summary + History charts (tabs).
extends Control

@onready var tab_bar      : TabBar    = $VBox/TabBar
@onready var today_panel  : Control   = $VBox/TodayPanel
@onready var history_panel: Control   = $VBox/HistoryPanel
@onready var btn_close    : Button    = $VBox/TitleRow/BtnClose

# Today labels
@onready var lbl_day      : Label    = $VBox/TodayPanel/Scroll/VBox/LblDay
@onready var lbl_rating   : Label    = $VBox/TodayPanel/Scroll/VBox/LblRating
@onready var lbl_guests   : Label    = $VBox/TodayPanel/Scroll/VBox/LblGuests
@onready var lbl_walkin   : Label    = $VBox/TodayPanel/Scroll/VBox/LblWalkin
@onready var lbl_hguests  : Label    = $VBox/TodayPanel/Scroll/VBox/LblHotelG
@onready var lbl_capacity : Label    = $VBox/TodayPanel/Scroll/VBox/LblCapacity
@onready var lbl_crowding : Label    = $VBox/TodayPanel/Scroll/VBox/LblCrowding
@onready var lbl_slot_rev : Label    = $VBox/TodayPanel/Scroll/VBox/LblSlotRev
@onready var lbl_tbl_rev  : Label    = $VBox/TodayPanel/Scroll/VBox/LblTblRev
@onready var lbl_bar_rev  : Label    = $VBox/TodayPanel/Scroll/VBox/LblBarRev
@onready var lbl_hotel_rev: Label    = $VBox/TodayPanel/Scroll/VBox/LblHotelRev
@onready var lbl_total_rev: Label    = $VBox/TodayPanel/Scroll/VBox/LblTotalRev
@onready var lbl_cumul    : Label    = $VBox/TodayPanel/Scroll/VBox/LblCumul

# History charts
@onready var chart_guests  : Control = $VBox/HistoryPanel/Scroll/VBox/ChartGuests
@onready var chart_revenue : Control = $VBox/HistoryPanel/Scroll/VBox/ChartRevenue
@onready var chart_rating  : Control = $VBox/HistoryPanel/Scroll/VBox/ChartRating
@onready var chart_occ     : Control = $VBox/HistoryPanel/Scroll/VBox/ChartOccupancy

func _ready() -> void:
	btn_close.pressed.connect(func(): hide())
	tab_bar.tab_changed.connect(_on_tab_changed)
	GameState.state_changed.connect(func():
		if visible: _refresh()
	)
	_refresh()

func _on_tab_changed(tab: int) -> void:
	today_panel.visible   = (tab == 0)
	history_panel.visible = (tab == 1)
	if tab == 1:
		_refresh_charts()

func _refresh() -> void:
	_refresh_today()
	if history_panel.visible:
		_refresh_charts()

func _refresh_today() -> void:
	var gs := GameState
	var last_stats: Dictionary = {}
	if gs.stats_records.size() > 0:
		last_stats = gs.stats_records[-1]

	lbl_day.text      = "Day %d Summary" % gs.day_number
	lbl_rating.text   = "Resort Rating    %.1f" % gs.resort_rating
	lbl_guests.text   = "Total Guests     %d/day" % gs.total_guests
	lbl_walkin.text   = "  Walk-in        %d" % gs.walkin_guests
	lbl_hguests.text  = "  Hotel          %d" % gs.hotel_guests
	lbl_capacity.text = "Casino Capacity  %d" % gs.casino_capacity
	lbl_crowding.text = "Crowding         %.2f" % gs.prev_crowding

	if last_stats.is_empty():
		lbl_slot_rev.text  = "Slots            —"
		lbl_tbl_rev.text   = "Tables           —"
		lbl_bar_rev.text   = "Bar              —"
		lbl_hotel_rev.text = "Hotel Rooms      —"
		lbl_total_rev.text = "Total Revenue    —"
	else:
		lbl_slot_rev.text  = "Slots            %d 💰" % last_stats.slot_rev
		lbl_tbl_rev.text   = "Tables           %d 💰" % (last_stats.small_rev + last_stats.large_rev)
		lbl_bar_rev.text   = "Bar              %d 💰" % last_stats.bar_rev
		lbl_hotel_rev.text = "Hotel Rooms      %d 💰" % last_stats.hotel_rev
		lbl_total_rev.text = "Total Revenue    %d 💰" % last_stats.revenue
	lbl_cumul.text = "Total Earned     %d 💰  (goal: 5,000)" % gs.cumulative_income

func _refresh_charts() -> void:
	var gs := GameState
	_set_chart_data(chart_guests,  "Guests / Day",  gs.chart_guests,  gs.chart_days)
	_set_chart_data(chart_revenue, "Revenue / Day", gs.chart_revenue, gs.chart_days)
	_set_chart_data(chart_rating,  "Resort Rating", gs.chart_rating,  gs.chart_days)
	_set_chart_data(chart_occ,     "Hotel Occupancy %",
		gs.chart_occupancy.map(func(v): return v * 100.0), gs.chart_days)

func _set_chart_data(chart: Control, title: String, values: Array, days: Array) -> void:
	chart.set_meta("title",  title)
	chart.set_meta("values", values)
	chart.set_meta("days",   days)
	chart.queue_redraw()

func open() -> void:
	_refresh()
	tab_bar.current_tab = 0
	today_panel.visible   = true
	history_panel.visible = false
	show()
