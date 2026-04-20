# ChartCard.gd
# A single chart card: title, line chart via _draw(), day labels.
# Set "title", "values", "days" metadata before calling queue_redraw().
extends Control

@export var line_color : Color = Color(0.3, 0.8, 0.5)
@export var bg_color   : Color = Color(0.12, 0.13, 0.15)

func _draw() -> void:
	var title  : String = get_meta("title",  "")
	var values : Array  = get_meta("values", [])
	var days   : Array  = get_meta("days",   [])

	var w := size.x
	var h := size.y

	# Background
	draw_rect(Rect2(0, 0, w, h), bg_color, true)
	draw_rect(Rect2(0, 0, w, h), Color(0.3, 0.3, 0.3), false)

	# Title
	draw_string(ThemeDB.fallback_font, Vector2(8, 18), title,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.8, 0.8, 0.8))

	if values.is_empty():
		draw_string(ThemeDB.fallback_font, Vector2(w * 0.5 - 60, h * 0.55),
					"No data yet.", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.5, 0.5, 0.5))
		return

	# Current value top-right
	var cur := values[-1]
	var cur_text := "%.1f" % cur if cur < 100 else "%d" % int(cur)
	draw_string(ThemeDB.fallback_font, Vector2(w - 60, 18), cur_text,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.WHITE)

	# Chart area margins
	var margin_top    := 28.0
	var margin_bottom := 22.0
	var margin_side   := 8.0
	var chart_w := w - margin_side * 2
	var chart_h := h - margin_top - margin_bottom

	if values.size() == 1:
		# Single dot
		var cx := margin_side + chart_w * 0.5
		var cy := margin_top + chart_h * 0.5
		draw_circle(Vector2(cx, cy), 4.0, line_color)
	else:
		# Line
		var y_max := 0.0
		for v in values:
			y_max = maxf(y_max, float(v))
		y_max = maxf(y_max * 1.2, 1.0)

		var points := PackedVector2Array()
		for i in values.size():
			var nx := float(i) / float(values.size() - 1)
			var ny := 1.0 - (float(values[i]) / y_max)
			points.append(Vector2(
				margin_side + nx * chart_w,
				margin_top  + ny * chart_h
			))
		draw_polyline(points, line_color, 2.0)

	# Day labels
	if days.size() > 0:
		var font := ThemeDB.fallback_font
		var label_y := h - 6.0
		draw_string(font, Vector2(margin_side, label_y),
					"Day %d" % days[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.5,0.5,0.5))
		draw_string(font, Vector2(w - 60, label_y),
					"Day %d" % days[-1], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.5,0.5,0.5))
