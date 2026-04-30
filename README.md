# Casino Resort Manager

A browser-based casino resort management game. Place gaming objects on a tile grid, expand a hotel, grow your Resort Rating, and work through 10 progression goals.

**Play it:** https://pasihaverinen90-hash.github.io/Casino-hotel/

Built with **Phaser 3 + TypeScript + Vite**, deployed automatically to GitHub Pages on every push to `main`.

---

## Gameplay

- **36 × 24 tile grid** with a fixed central lobby
- **Five buildable objects:** slot machine, small table, large table, WC, bar
- **Hotel system:** buy rooms in batches, upgrade quality (3 levels)
- **Resort Rating** (1.0–5.0) drives demand, occupancy, and revenue
- **Daily simulation tick** — advance time, earn revenue, track 60-day history
- **10 progression goals** with cash rewards and an endgame screen
- **Save / load** to browser localStorage

### Buildable objects

| Object | Size | Cost | Capacity | Rating |
|---|---|---|---|---|
| Slot Machine | 1×1 | 750 | +1 | +0.02 |
| Small Table | 2×3 | 2,500 | +4 | +0.18 |
| Large Table | 2×4 | 4,500 | +6 | +0.25 |
| WC | 3×1 wall | 1,200 | — | +0.20 |
| Bar | 8×1 wall | 6,500 | — | +0.35 (flat, max 1) |

### Progression goals

1. Build 3 slot machines
2. Reach 35 guests/day
3. Build your first WC
4. Build your first small table
5. Reach Resort Rating 2.0
6. Earn 5,000 total
7. Expand hotel to 4 rooms
8. Reach 60 guests/day
9. Upgrade hotel to quality 2
10. Build the bar

---

## Controls

| Action | Input |
|---|---|
| Pan grid | Click + drag empty area |
| Zoom | Mouse wheel (zooms toward cursor) |
| Open build menu | Bottom bar → **Build** |
| Place object (single) | Click target tile while in placement mode |
| **Drag-place multiple** | Hold left mouse and drag — places on every valid new tile, skips invalid silently |
| **Stay in placement mode** | Hold **Ctrl** while releasing the mouse — placement persists for rapid building |
| Rotate ghost | **R** key, or right-click while placing |
| Cancel placement / demolish | **Esc** |
| Demolish | Bottom bar → demolish toggle, then click an object (50% refund) |
| Advance day | Bottom bar → **Day** |

---

## Project layout

```
casino-web/
├── src/
│   ├── logic/                # Pure functions — no DOM, no Phaser
│   │   ├── GameConstants.ts      # constants, enums, object defs
│   │   ├── PlacementValidator.ts # all placement-rule checks
│   │   └── Simulation.ts         # rating, demand, revenue, occupancy formulas
│   ├── state/
│   │   ├── GameState.ts          # singleton — owns state, daily tick, save/load
│   │   └── EventEmitter.ts       # tiny pub/sub primitive
│   ├── events/
│   │   └── UIBus.ts              # cross-component UI event bus
│   ├── game/
│   │   └── GridScene.ts          # Phaser scene: render + placement input + zoom/pan
│   ├── ui/                   # DOM components, no Phaser dependency
│   │   ├── TopHUD.ts             # rating, guests, cash, day
│   │   ├── GoalTicker.ts         # active goal strip
│   │   ├── BottomBar.ts          # Build / Hotel / Stats / Day buttons
│   │   ├── BuildPanel.ts         # object placement menu
│   │   ├── HotelPanel.ts         # rooms + quality upgrades
│   │   ├── StatsPanel.ts         # daily summary + 60-day charts
│   │   ├── GoalsPanel.ts         # all 10 goals
│   │   ├── ChartCard.ts          # reusable line chart
│   │   ├── EndScreen.ts          # endgame summary
│   │   └── Toast.ts              # auto-dismissing notifications
│   └── main.ts               # bootstrap — wires Phaser scene + DOM panels
├── index.html
├── vite.config.ts            # base: '/Casino-hotel/' for GitHub Pages
├── tsconfig.json
└── package.json
```

Three-layer separation: `logic/` is pure (testable without UI), `state/` runs the simulation and persists, `ui/` and `game/` render and handle input. UI components communicate with each other through `events/UIBus.ts` rather than direct references.

---

## Run locally

```bash
cd casino-web
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

Requires Node.js 20+.

---

## Deployment

`.github/workflows/deploy.yml` builds `casino-web/` and publishes `casino-web/dist/` to GitHub Pages on every push to `main`. Vite's `base` is set to `/Casino-hotel/` to match the repo name; `actions/upload-pages-artifact` adds the `.nojekyll` marker automatically so asset paths work.

---

## Status

**Done**
- Grid placement with full validation
- Drag-placement + Ctrl-stay-in-mode for rapid building
- Mouse-wheel zoom (zooms toward cursor) and click-drag panning
- Daily simulation, Resort Rating, hotel system, economy, all 10 goals
- Save / load (localStorage)
- 60-day history charts and stats panel
- Endgame screen
- CI build and GitHub Pages deployment

**Not yet**
- Sprite art (placeholder colours)
- Sound
- Animations
- Mobile / touch tuning of drag-place (currently designed for mouse)
