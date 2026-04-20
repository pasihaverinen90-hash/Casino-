# Casino Resort Manager — Godot 4 Setup Instructions

## Project Setup

1. Create a new Godot 4 project (GDScript, Forward+/Mobile renderer)
2. Project Settings → Display → Window:
   - Width: 390, Height: 844 (iPhone 14 portrait)
   - Mode: Viewport, Aspect: keep
3. Copy all script files into the folder structure below

---

## Folder Structure

```
res://
├── autoloads/
│   └── GameState.gd
├── logic/
│   ├── GameConstants.gd
│   ├── Simulation.gd
│   └── PlacementValidator.gd
└── scripts/
    ├── Main.gd
    ├── CasinoGrid.gd
    ├── TopHUD.gd
    ├── GoalTicker.gd
    ├── BottomBar.gd
    ├── BuildPanel.gd
    ├── HotelPanel.gd
    ├── StatsPanel.gd
    ├── GoalsPanel.gd
    ├── ChartCard.gd
    └── Toast.gd
```

---

## Autoload Registration

Project Settings → Autoload → Add:
- Path: `res://autoloads/GameState.gd`  Name: `GameState`

---

## Main Scene (Main.tscn)

Build this node tree manually in the Godot editor:

```
Main (Control) [script: Main.gd] [anchors: full rect]
│
├── TopHUD (HBoxContainer) [script: TopHUD.gd]
│   │  [Anchor: Top, H-Fill, height 56px]
│   ├── LblRating  (Label) ["★ 1.8"]
│   ├── LblGuests  (Label) ["👥 0/day"]
│   ├── LblCash    (Label) ["💰 7,500"]
│   └── LblDay     (Label) ["Day 1"]
│
├── GridArea (Control) [anchors: fill remaining space between HUD and GoalTicker]
│   └── CasinoGrid (Control) [script: CasinoGrid.gd] [full rect, clip contents ON]
│       [Inspector: tile_size = 18]
│
├── GoalTicker (Button) [script: GoalTicker.gd]
│   [Anchor: sits above BottomBar, height 40px, H-fill]
│   [Text: "▶  First Machines — Build 3 slots"]
│
├── BottomBar (HBoxContainer) [script: BottomBar.gd]
│   [Anchor: Bottom, H-Fill, height 80px]
│   ├── BtnBuild (Button) ["🔨 Build"]  [size flags: expand+fill]
│   ├── BtnHotel (Button) ["🏨 Hotel"]  [size flags: expand+fill]
│   ├── BtnStats (Button) ["📊 Stats"]  [size flags: expand+fill]
│   └── BtnDay   (Button) ["▶ Day"]     [size flags: expand+fill]
│       [Modulate: Color(0.3, 0.8, 0.4) — green tint]
│
├── Panels (Control) [No rect clip, z-index: 10]
│   │
│   ├── BuildPanel (PanelContainer) [script: BuildPanel.gd]
│   │   [Anchor: Bottom, H-Fill, height 360px, hidden]
│   │   └── VBox (VBoxContainer)
│   │       ├── TitleRow (HBoxContainer)
│   │       │   ├── Label ["BUILD"]  [expand]
│   │       │   ├── BtnDemolish (Button) ["🗑 Demolish"]
│   │       │   └── BtnClose (Button) ["✕"]
│   │       └── ScrollContainer
│   │           └── ItemGrid (GridContainer) [columns: 3]
│   │               [Object buttons added dynamically by script]
│   │
│   ├── HotelPanel (PanelContainer) [script: HotelPanel.gd]
│   │   [Anchor: Bottom, H-Fill, height 400px, hidden]
│   │   └── VBox (VBoxContainer)
│   │       ├── TitleRow (HBoxContainer)
│   │       │   ├── Label ["HOTEL"]  [expand]
│   │       │   └── BtnClose (Button) ["✕"]
│   │       ├── InfoSection (VBoxContainer)
│   │       │   ├── LblRooms     (Label)
│   │       │   ├── LblQuality   (Label)
│   │       │   ├── LblBooked    (Label)
│   │       │   └── LblIncome    (Label)
│   │       ├── HSeparator
│   │       ├── RoomSection (VBoxContainer)
│   │       │   ├── Label ["ADD ROOMS"]
│   │       │   ├── BtnRooms2 (Button)
│   │       │   ├── BtnRooms4 (Button)
│   │       │   └── BtnRooms8 (Button)
│   │       ├── HSeparator
│   │       └── QualitySection (VBoxContainer)
│   │           ├── Label ["UPGRADE QUALITY"]
│   │           ├── BtnUpgrade (Button)
│   │           └── LblUpgrade (Label)
│   │
│   ├── StatsPanel (Control) [script: StatsPanel.gd]
│   │   [Anchor: Full Rect, hidden]
│   │   └── VBox (VBoxContainer) [full rect]
│   │       ├── TitleRow (HBoxContainer)
│   │       │   ├── Label ["STATS"]  [expand]
│   │       │   └── BtnClose (Button) ["✕"]
│   │       ├── TabBar (TabBar) [tabs: "Today", "History"]
│   │       ├── TodayPanel (Control)
│   │       │   └── Scroll (ScrollContainer) [full rect]
│   │       │       └── VBox (VBoxContainer)
│   │       │           ├── LblDay       (Label)
│   │       │           ├── LblRating    (Label)
│   │       │           ├── LblGuests    (Label)
│   │       │           ├── LblWalkin    (Label)
│   │       │           ├── LblHotelG    (Label)
│   │       │           ├── LblCapacity  (Label)
│   │       │           ├── LblCrowding  (Label)
│   │       │           ├── HSeparator
│   │       │           ├── Label ["REVENUE"]
│   │       │           ├── LblSlotRev   (Label)
│   │       │           ├── LblTblRev    (Label)
│   │       │           ├── LblBarRev    (Label)
│   │       │           ├── LblHotelRev  (Label)
│   │       │           ├── HSeparator
│   │       │           ├── LblTotalRev  (Label)
│   │       │           └── LblCumul     (Label)
│   │       └── HistoryPanel (Control) [hidden by default]
│   │           └── Scroll (ScrollContainer) [full rect]
│   │               └── VBox (VBoxContainer)
│   │                   ├── ChartGuests   (Control) [script:ChartCard.gd] [min h:160]
│   │                   │   [Inspector: line_color = Color(0.3,0.8,0.5)]
│   │                   ├── ChartRevenue  (Control) [script:ChartCard.gd] [min h:160]
│   │                   │   [Inspector: line_color = Color(0.9,0.7,0.2)]
│   │                   ├── ChartRating   (Control) [script:ChartCard.gd] [min h:160]
│   │                   │   [Inspector: line_color = Color(0.9,0.4,0.2)]
│   │                   └── ChartOccupancy(Control) [script:ChartCard.gd] [min h:160]
│   │                       [Inspector: line_color = Color(0.4,0.6,0.9)]
│   │
│   └── GoalsPanel (Control) [script: GoalsPanel.gd]
│       [Anchor: Full Rect, hidden]
│       └── VBox (VBoxContainer) [full rect]
│           ├── TitleRow (HBoxContainer)
│           │   ├── Label ["GOALS"]  [expand]
│           │   └── BtnClose (Button) ["✕"]
│           └── Scroll (ScrollContainer) [expand]
│               └── GoalList (VBoxContainer) [items added dynamically]
│
├── Toast (PanelContainer) [script: Toast.gd]
│   [Anchor: Top-Centre, width 300, height 48, y offset 70, hidden]
│   └── Label  [H-align: Centre]
│
└── EndScreen (Control) [script: none, hidden]
    [Anchor: Full Rect, semi-transparent background]
    └── VBox (VBoxContainer) [centred]
        ├── LblTitle  (Label) [large font]
        ├── LblDays   (Label)
        ├── LblRating (Label)
        ├── LblEarned (Label)
        ├── LblBuilt  (Label)
        └── BtnReset  (Button) ["Play Again"]
```

---

## Key Inspector Settings

| Node | Property | Value |
|---|---|---|
| Main (Control) | Anchors Preset | Full Rect |
| CasinoGrid | Mouse Filter | Stop |
| CasinoGrid | Clip Contents | ON |
| CasinoGrid | tile_size | 18 |
| BuildPanel | Mouse Filter | Stop |
| Toast | Z-Index | 100 |
| Toast | Mouse Filter | Ignore |

---

## Anchor Layout Tips

Use anchors to create the four-zone layout:

```
TopHUD:     anchor_top=0, anchor_bottom=0, offset_bottom=56
GridArea:   anchor fills between HUD (56px) and GoalTicker (812px on 844 screen)
GoalTicker: anchor_bottom=1, offset_top=-80, offset_bottom=-80 (sits above BottomBar)
BottomBar:  anchor_top=1, anchor_bottom=1, offset_top=-80, offset_bottom=0
```

Panels (BuildPanel, HotelPanel) use:
```
anchor_top=1, anchor_bottom=1, offset_top=-360, offset_bottom=0
```

StatsPanel and GoalsPanel use full rect (0,0,1,1 anchors).

---

## First Run Checklist

1. [ ] GameState autoload registered and named exactly `GameState`
2. [ ] Main.tscn set as the main scene
3. [ ] All @onready paths match the node names in the scene tree exactly
4. [ ] CasinoGrid has `Mouse Filter = Stop` (required for click events)
5. [ ] Run the project — grid should render, Day button should print state to Output
6. [ ] Place a slot machine: tap Build → Slot Machine → tap a floor tile (grey)
7. [ ] Tap "▶ Day" — cash should increase, day counter increments
8. [ ] Check Output panel for any @onready null errors and fix node names

---

## Troubleshooting

**Grid is black / not rendering:**
- Check CasinoGrid has `_draw()` connected and `queue_redraw()` is called
- Confirm `Clip Contents = ON` on CasinoGrid

**Placement does nothing:**
- Check `Mouse Filter = Stop` on CasinoGrid
- Verify `GameState` autoload name is exactly `GameState`

**@onready errors:**
- Node name in scene tree must exactly match the name after `$` in the script
- Names are case-sensitive

**Save file issues:**
- Save goes to `user://save.json`; find it via Editor → Open User Data Folder
- Delete save.json to reset to a new game

---

## Expanding the Prototype

The architecture is designed for easy expansion:

- **New object types:** Add to `GameConstants.gd` (enum + `get_def()`), add colour, done.
- **New formulas:** Add static functions to `Simulation.gd`. No other file changes.
- **New panels:** Add a Panel node, write a script, wire it in `Main.gd`. No core changes.
- **New goals:** Extend `GOAL_LABELS/DESCS/REWARDS` arrays in `GameConstants.gd`, add case to `_is_goal_met()` in `GameState.gd`.
- **Costs system:** Fill in `dailyCosts` in `Simulation.run_day()`. The loop already handles it.
- **Sprites:** Replace `draw_rect` colour blocks in `CasinoGrid._draw()` with `draw_texture_rect()` calls.
