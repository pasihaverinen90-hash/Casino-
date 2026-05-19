# Casino Resort Manager

A browser-based casino resort management sim. Place gaming objects on a tile grid, attach amenities to the casino walls, run a small hotel, grow your Resort Rating, and work through 10 progression goals while random campaign events come and go.

**Play it:** https://pasihaverinen90-hash.github.io/Casino-hotel/

Built with **Phaser 3 + TypeScript + Vite**. Deployed automatically to GitHub Pages on every push to `main`.

---

## Current status

Playable, in active development.

**Working**
- 36 × 24 tile grid with a central reception lobby.
- 11 buildable object types across 4 categories (slots / tables / services / food).
- Wall services that attach to the **north and west** casino walls only.
- Daily simulation: 15-minute clock, hourly revenue drip, end-of-day rollup.
- Resort Rating drives demand, occupancy, and revenue.
- Hotel rooms (purchase in batches of 2 / 4 / 8) and quality upgrades (3 levels).
- 10 progression goals with cash rewards and an endless-mode bonus.
- Random campaign events: Slot Promotion, Tourist Bus, Comfort Check.
- 60-day history charts (revenue / guests / rating / occupancy).
- Save / load to browser `localStorage` across 3 save slots.
- Premium V2 presentation: shallow-dimetric scene with tall N/W walls and the V2 UI shell (TopHUDV2 with stats + clock + zoom + speed, BottomBarV2, BuildPanelV2, HotelPanelV2, StatsPanelV2 with Today/History/Goals tabs, shared modal/toast/ticker chrome).

**Planned / in progress**
- Final sprite / art polish.
- Hotel room visuals and floor-plan presentation.
- Theme / material / chapter system (deferred until hotel design lands).
- Sound, music, animations.
- Mobile / touch polish (drag-place currently tuned for mouse).
- Continued balancing.

---

## Run locally

Requires **Node 20+** (the GitHub Actions workflow uses Node 20).

```bash
cd casino-web
npm ci                # or: npm install
npm run dev           # Vite dev server on http://localhost:5173
npm run build         # tsc --noEmit && vite build → casino-web/dist/
npm run preview       # serve the production build
```

---

## Controls

### Mouse
| Action | Input |
|---|---|
| Pan grid | Click + drag empty area |
| Zoom | Mouse wheel (zooms toward cursor) or the −/+ buttons in the top HUD (V2) |
| Open a panel | Click **Build / Hotel / Stats** in the bottom bar |
| Place object | Click target tile while in placement mode |
| Drag-place multiple | Hold left mouse and drag — places on every valid new tile, skips invalid silently |
| Stay in placement mode | Hold **Ctrl** while releasing the mouse — placement persists for rapid building |
| Rotate ghost | **R** key, or right-click while placing |
| Cancel placement / close panels | **Esc** |
| Demolish | Bottom bar → **Demolish** toggle, then click an object (50 % refund) |
| Active objective detail (V2) | Click the active goal / challenge ticker |

### Keyboard
| Key | Action |
|---|---|
| `B` | Toggle Build panel |
| `H` | Toggle Hotel panel |
| `S` | Toggle Stats panel |
| `G` | Open Stats → Goals tab (full goals list) |
| `D` | Toggle Demolish mode |
| `Esc` | Close all panels / cancel placement |
| `R` | Rotate the placement ghost |
| `Space` | Toggle pause |
| `1` / `2` / `4` | Set speed 1× / 2× / 4× |

The speed buttons live in the top HUD. 0× pause sits next to them as ⏸.

---

## Gameplay systems

- **Casino floor.** 36 × 24 tile grid. Built objects occupy tile footprints; wall services attach to the north or west casino walls only.
- **Guests.** Walk-in demand scales with Resort Rating; hotel rooms add a steady overnight guest stream. The simulation routes each guest to an interaction tile near a gaming or service object.
- **Rating.** 1.0 – 5.0 scale derived from object mix, hotel quality, and crowding. Drives daily walk-in demand and hotel occupancy.
- **Daily tick.** 15-minute clock, hourly revenue drip, end-of-day rollup writes a `DayStats` record. 60 days of history are kept.
- **Hotel.** Buy rooms in batches of 2 / 4 / 8; upgrade quality across 3 levels. Booked rooms generate overnight revenue and lift the rating.
- **Reports.** V2 Reports panel: Today (right-now stats + yesterday breakdown), History (lifetime totals + 60-day mini-charts for revenue / guests / rating / occupancy + revenue breakdown by category), Goals (10-row status list).
- **Goals.** 10-step progression. Completing a goal awards cash and unlocks the next category of buildable objects. Once all ten are done an endless-mode bonus pays out.
- **Challenges / events.** Random campaign events start automatically by day. Each one shows up as a ticker; click it for full details.

### Random events

| Event | Objective | Window | Reward / effect |
|---|---|---|---|
| Slot Promotion | Build 5 new Slot Machines | 3 days | Slot revenue +25 % for 3 days |
| Tourist Bus | Serve 250 guests | 3 days | +$5,000 cash; walk-in demand +50 % during the event |
| Comfort Check | Run 2 WC + 2 Cashier + 1 ATM + 1 Bar + 1 Buffet simultaneously | 3 days | +$3,000 cash |

Failure has no penalty.

---

## Buildable objects

Source of truth: [`logic/GameConstants.ts`](casino-web/src/logic/GameConstants.ts) `OBJ_DEFS`.

| Category | Object | Footprint | Cost | Notes |
|---|---|---|---|---|
| Slots | Slot Machine | 1 × 2 | 750 | Cap +1 per machine |
| Tables | Small Table | 2 × 3 | 2,500 | Cap +4; variants: blackjack, poker |
| Tables | Large Table | 2 × 4 | 4,500 | Cap +6; variants: roulette, craps |
| Tables | Keno Lounge | 3 × 3 | 7,500 | Cap +8 |
| Tables | High-Stakes Table | 3 × 3 | 15,000 | Cap +6; variants: baccarat, high-roller |
| Services | WC | 3 × 1 wall | 1,200 | N/W walls only |
| Services | Cashier | 1 × 1 wall | 1,500 | N/W walls only |
| Services | ATM | 1 × 1 wall | 1,000 | N/W walls only |
| Services | Sportsbook | 4 × 1 wall | 10,000 | N/W walls only |
| Food & Drink | Bar | 8 × 1 wall | 6,500 | N/W walls only; max 1 |
| Food & Drink | Buffet | 4 × 1 wall | 5,000 | N/W walls only |

Wall services (`is_wall: true`) can only attach to the **north** or **west** visible walls — the south and east edges of the casino are intentionally not buildable. This is enforced inside [`PlacementValidator.ts`](casino-web/src/logic/PlacementValidator.ts) so both renderers honour the rule.

Object unlock order is driven by [`GOAL_UNLOCKS`](casino-web/src/logic/GameConstants.ts) — each completed goal opens the next type for purchase.

---

## Progression goals

Source: [`logic/GameConstants.ts`](casino-web/src/logic/GameConstants.ts) `GOAL_LABELS`, `GOAL_DESCS`, `GOAL_REWARDS`.

| # | Name | Objective | Reward |
|---|---|---|---|
| 1 | First Machines | Build 3 slot machines | 500 |
| 2 | First Crowd | Reach 45 guests/day | 800 |
| 3 | Basic Amenity | Build your first WC | 600 |
| 4 | Real Gaming | Build your first small table | 1,200 |
| 5 | Rising Star | Reach Resort Rating 2.0 | 1,000 |
| 6 | First Profit | Earn 9,000 total | 1,500 |
| 7 | Hotel Open | Expand hotel to 8 rooms | 1,000 |
| 8 | Busy Floor | Reach 85 guests/day | 2,000 |
| 9 | Quality Service | Upgrade hotel to quality 2 | 1,500 |
| 10 | Grand Bar | Build the bar | 3,000 |

Endless-mode bonus on completing all 10: **+25,000 cash** (one-shot per save).

The active goal lives in the bottom ticker; clicking it shows a single-objective detail card. The full list is always available via Stats → Goals.

---

## Save / load

- Three save slots in browser `localStorage`. Keys: `casino_resort_save_slot_1..3` plus `casino_resort_last_used_slot`.
- The start screen lists each slot's summary (day / cash / rating / guests) and offers continue / new game.
- In-game **Save** button (bottom bar) writes to the active slot.
- **Menu** button asks before discarding unsaved progress and returns to the start screen.
- The save schema is versioned (`SAVE_VERSION` in [`state/GameState.ts`](casino-web/src/state/GameState.ts)). Older payloads are upgraded by `SAVE_MIGRATIONS` on load. A legacy pre-slot save is migrated into slot 1 automatically the first time the game boots.
- No cloud save. Clearing browser site data wipes local saves.

---

## Project structure

```
casino-web/
├── src/
│   ├── main.ts                  # bootstrap — Phaser game + DOM UI mounting
│   ├── logic/                   # Pure simulation — no DOM, no Phaser
│   │   ├── GameConstants.ts        # constants, enums, OBJ_DEFS, goals
│   │   ├── PlacementValidator.ts   # all placement rules (N/W walls etc.)
│   │   ├── OperationalValidator.ts # interaction-tile checks
│   │   └── Simulation.ts           # rating / demand / revenue / occupancy
│   ├── state/
│   │   ├── GameState.ts            # singleton — owns state, daily tick, save/load
│   │   ├── SaveSlots.ts            # 3-slot localStorage save plumbing
│   │   ├── TimeController.ts       # clock, hour/day events, speed
│   │   └── EventEmitter.ts         # tiny pub/sub primitive
│   ├── events/
│   │   └── UIBus.ts                # cross-component UI event bus
│   ├── game/                    # Shared (renderer-agnostic) helpers
│   │   └── GuestRouter.ts          # shared — guest routing logic (used by V2)
│   ├── ui/                      # Shared HTML UI components
│   │   ├── StartScreen.ts          # opening slot picker
│   │   ├── Toast.ts                # auto-dismissing notifications
│   │   ├── GoalTicker.ts           # active-goal strip
│   │   ├── ChallengeTicker.ts      # active-event strip + detail modal
│   │   ├── GoalCompletePopup.ts    # goal completion overlay
│   │   ├── objectiveDetail.ts      # shared modal helper (goal/challenge detail)
│   │   └── format.ts               # fmtCash / fmtPct / fmtRating / fmtOccupancy
│   ├── v2/
│   │   ├── scene/
│   │   │   ├── PresentationSceneV2.ts   # V2 Phaser scene
│   │   │   ├── CameraControllerV2.ts    # pan / zoom / clamp
│   │   │   └── InputControllerV2.ts     # placement / demolish / hover / selection
│   │   ├── render/
│   │   │   ├── ProjectionV2.ts          # pure math — dimetric projection
│   │   │   ├── PaletteV2.ts             # V2 colour palette
│   │   │   ├── FloorRendererV2.ts, WallRendererV2.ts
│   │   │   ├── ObjectRendererV2.ts, GuestRendererV2.ts
│   │   │   ├── GhostRendererV2.ts, DemolishRendererV2.ts, SelectionRendererV2.ts
│   │   │   └── recipes/                  # per-object paint recipes
│   │   ├── guests/
│   │   │   └── GuestVisualControllerV2.ts
│   │   └── ui/                          # V2 HTML chrome
│   │       ├── TopHUDV2.ts, BottomBarV2.ts
│   │       ├── BuildPanelV2.ts, HotelPanelV2.ts, StatsPanelV2.ts
│   │       ├── ZoomControlsV2.ts        # mounts inside TopHUDV2
│   │       └── styleV2.css              # .v2-* scoped styles for every UI surface
│   └── style.css                # Reset + app shell (#app / #ui-root / .interactive)
├── index.html
├── vite.config.ts               # base: '/Casino-hotel/' for GitHub Pages
├── tsconfig.json
└── package.json
```

Three-layer separation is preserved: `logic/` is pure (testable without UI), `state/` runs the simulation and persists, `ui/` + `v2/` render and handle input. Components communicate through `events/UIBus.ts` and `state/EventEmitter` rather than direct references.

V2 reuses the shared UI components in `ui/`: `StartScreen`, `Toast`, `GoalTicker`, `ChallengeTicker`, `GoalCompletePopup`, and `objectiveDetail`. Each component emits `.v2-*` class names directly, so all of their styling lives in `styleV2.css` alongside the V2-only panels.

---

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys to GitHub Pages on every push to `main`:

1. `actions/setup-node@v4` with Node 20.
2. `npm ci` and `npm run build` inside `casino-web/`.
3. `actions/upload-pages-artifact@v3` uploads `casino-web/dist/`.
4. `actions/deploy-pages@v4` publishes the artifact.

Vite's `base` is set to `/Casino-hotel/` so asset paths resolve under the repo's GitHub Pages URL. The upload action attaches `.nojekyll` automatically.

---

## Near-term technical plan

1. **Phases 9–10.** V2 default flip, V2 smoke-test bugfixes, V1 retirement. *Done.*
2. **Phase 11.** V2-only polish — main.ts split, shared-UI V2-native restyle, StartScreen redesign, and the final CSS audit have all landed. The **sprite / art pass** is the remaining piece.
3. **Later.** Hotel floor-plan visuals, theme / material / chapter system, sound / music / animations, mobile / touch polish, continued balancing.

---

## Manual QA checklist

A quick smoke test after each significant change.

- Boots without console errors; StartScreen lists 3 slots; new game and load both work.
- TopHUDV2 shows rating / guests / cash / clock / view (− +) / speed (⏸ 1× 2× 4×).
- BottomBarV2 toggles Build / Hotel / Stats / Demolish; Save / Menu work.
- BuildPanelV2 category buttons swap item lists; variant picker opens for tables; selection highlights during placement.
- HotelPanelV2 buys rooms + upgrades quality; disables at max; occupancy display matches count.
- StatsPanelV2 tabs (Today / History / Goals) all show data; charts redraw on tab switch; `G` opens Stats → Goals.
- Active goal ticker click opens single-goal detail; active challenge ticker click opens challenge detail.
- Pan / zoom work; − greys out at min zoom, + greys out at max.
- N/W walls: WC / Bar / Cashier etc. auto-orient and place; south or east attempt rejects with a toast.
- Save → reload → continue restores objects, hotel, goals, and the in-day clock minute.

---

## License

No license file is currently provided. Treat the project as source-available for review purposes.
