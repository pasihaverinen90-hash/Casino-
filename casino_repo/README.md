# Casino Resort Manager

A mobile-first casino resort management game built in **Godot 4 / GDScript**.

Place casino objects on a grid, manage your hotel, grow your Resort Rating, and work through 10 progression goals to build the ultimate resort.

---

## 🎮 Gameplay

- **Grid-based casino floor** — place slots, tables, a WC, and a bar on a 36×24 tile grid
- **Hotel system** — expand room capacity and upgrade quality through a UI panel
- **Resort Rating** — a 1.0–5.0 star score driven by what you build and how crowded the floor gets
- **Daily simulation** — advance one day at a time; earn revenue from guests
- **10 progression goals** — a guided path from 3 slots to a fully built resort

---

## 🗂️ Project Structure

```
Casino-/
├── autoloads/
│   └── GameState.gd          # Singleton — all state, actions, save/load
├── logic/
│   ├── GameConstants.gd      # All constants, enums, object definitions
│   ├── Simulation.gd         # Pure formula functions (daily tick, rating, guests)
│   └── PlacementValidator.gd # Pure placement validation (all 8 checks)
├── scripts/
│   ├── Main.gd               # Root scene coordinator
│   ├── CasinoGrid.gd         # Grid rendering + placement input
│   ├── TopHUD.gd             # Persistent top strip (rating, guests, cash, day)
│   ├── GoalTicker.gd         # Active goal strip
│   ├── BottomBar.gd          # Build / Hotel / Stats / Day buttons
│   ├── BuildPanel.gd         # Object placement menu
│   ├── HotelPanel.gd         # Room and quality upgrade panel
│   ├── StatsPanel.gd         # Today summary + history charts
│   ├── GoalsPanel.gd         # All 10 goals list
│   ├── ChartCard.gd          # Reusable line chart component
│   └── Toast.gd              # Auto-dismissing notification
└── docs/
    ├── 01_mvp_spec.md
    ├── 02_critical_review.md
    ├── 03_final_ruleset.md
    ├── 04_data_model.md
    ├── 05_object_definitions.md
    ├── 06_placement_validation.md
    ├── 07_simulation_loop.md
    ├── 08_economy_model.md
    ├── 09_rating_system.md
    ├── 10_progression_system.md
    ├── 11_ui_design.md
    ├── 12_stats_system.md
    ├── 13_architecture.md
    ├── 14_pseudocode.md
    ├── 15_godot_setup.md
    └── 16_testing_checklist.md
```

---

## ⚙️ Setup

### Requirements
- Godot 4.x (any 4.x release)

### Steps

1. Clone this repo
2. Open Godot 4 → **Import** → select the repo folder
3. Register the autoload:
   - **Project Settings → Autoload → Add**
   - Path: `res://autoloads/GameState.gd`
   - Name: `GameState`
4. Set window size: **Project Settings → Display → Window** → Width: `390`, Height: `844`
5. Build `Main.tscn` using the scene tree in `docs/15_godot_setup.md`
6. Set `Main.tscn` as the main scene and run

See `docs/15_godot_setup.md` for the full node tree and inspector settings.

---

## 🏗️ Architecture

Three-layer separation:

```
UI Layer        →  scripts/  (reads state, fires events)
Controller      →  GameState.gd (translates events → logic)
Logic Layer     →  logic/    (pure functions, no UI imports)
```

- All game formulas are in `logic/Simulation.gd` as static functions
- All placement rules are in `logic/PlacementValidator.gd` as static functions
- Both can be tested without running any UI

---

## 📋 Buildable Objects

| Object | Size | Cost | Capacity | Rating |
|---|---|---|---|---|
| Slot Machine | 1×1 | 750 | +1 | +0.02 |
| Small Table | 2×3 | 2,500 | +4 | +0.18 |
| Large Table | 2×4 | 4,500 | +6 | +0.25 |
| WC | 3×1 wall | 1,200 | — | +0.20 |
| Bar | 8×1 wall | 6,500 | — | +0.35 (flat) |

---

## 🎯 10 Progression Goals

1. Build 3 slot machines
2. Reach 35 guests per day
3. Build your first WC
4. Build your first small table
5. Reach Resort Rating 2.0
6. Earn 5,000 total
7. Expand hotel to 4 rooms
8. Reach 60 guests per day
9. Upgrade hotel to quality level 2
10. Build the bar

---

## 📄 Design Documents

Full design documentation is in the `docs/` folder — spec, formulas, data model, pseudocode, UI design, and testing checklist.

---

## 🚧 MVP Status

This is a first playable prototype. All core systems are implemented:
- ✅ Grid placement with validation
- ✅ Daily simulation loop
- ✅ Resort Rating formula
- ✅ Hotel system
- ✅ Economy model
- ✅ Progression goals
- ✅ Save / load
- ✅ Stats and chart history
- 🔲 Sprite art (placeholder colours)
- 🔲 Sound
- 🔲 Animations
