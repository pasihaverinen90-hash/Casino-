# Casino Resort Manager — MVP UI Design
**Mobile-first. Prototype-grade. Matches all MVP 1.1 documents.**

---

## Core UI Philosophy

Three rules that govern every layout decision:

1. **The grid is always visible.** The casino floor planning view is the game. Nothing should fully obscure it. Panels slide over the bottom quarter of the screen at most. Full-screen overlays are used only for goals, stats, and end-state.
2. **One action surface at a time.** The build menu, hotel panel, and stats panel are mutually exclusive. Opening one closes the others.
3. **Prototype cleanliness over feature completeness.** In a first playable, a missing feature is better than a cluttered screen. Add UI surfaces only when the underlying system is working.

---

## 1. Main Game Screen Layout

The main screen has four fixed vertical zones. All measurements assume a standard mobile portrait viewport (~390 × 844px, iPhone 14 scale).

```
┌───────────────────────────────────────┐  ← top of screen
│                                       │
│           TOP HUD STRIP               │  ~56px tall, always visible
│                                       │
├───────────────────────────────────────┤
│                                       │
│                                       │
│                                       │
│          CASINO FLOOR GRID            │  ~560px — the primary view
│           (36 × 24 tiles)             │
│                                       │
│   Pannable and pinch-zoomable         │
│                                       │
├───────────────────────────────────────┤
│                                       │
│          GOAL TICKER STRIP            │  ~40px, always visible
│                                       │
├───────────────────────────────────────┤
│                                       │
│          BOTTOM ACTION BAR            │  ~80px, always visible
│                                       │
└───────────────────────────────────────┘  ← bottom of screen (above home indicator)
```

**Key constraint:** The grid area must never be fully obscured during normal play. Panels that expand upward from the bottom action bar cover at most 50% of the grid — enough to show context, not enough to lose orientation.

---

## 2. Top HUD Strip

Always visible. One row. No scrolling. Contains only the metrics the player needs to read at a glance every day.

```
┌────────────────────────────────────────────────┐
│  ★ 2.3   👥 12/day   💰 4,820   📅 Day 14      │
└────────────────────────────────────────────────┘
```

| Element | Value shown | Update timing |
|---|---|---|
| ★ Rating | `resortRating` (1 decimal) | After each day tick |
| 👥 Guests | `totalGuests` + "/day" | After each day tick |
| 💰 Cash | `cash` (no decimals) | After any transaction or day tick |
| 📅 Day | `dayNumber` | After day advances |

**Rules:**
- Four elements only. No fifth element added without removing one.
- Cash animates up when income arrives (number counts up over 0.5s).
- Rating shows a small ▲ or ▼ indicator for 2 seconds after a change, then disappears.
- No tooltips or tappable expansions on HUD elements in MVP. Tap → nothing.
- Font: monospace or tabular-figure font for all numbers so they don't shift layout as digits change.

---

## 3. Bottom Action Bar

Always visible. Contains three buttons that open their respective panels, plus the Advance Day button.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  [🔨 Build]   [🏨 Hotel]   [📊 Stats]  [▶ Day]  │
│                                                  │
└──────────────────────────────────────────────────┘
```

| Button | Opens | Label |
|---|---|---|
| 🔨 Build | Build menu panel (slides up) | "Build" |
| 🏨 Hotel | Hotel panel (slides up) | "Hotel" |
| 📊 Stats | Stats panel (full-screen overlay) | "Stats" |
| ▶ Day | Runs daily simulation, no panel | "Day ▶" |

**Rules:**
- Active panel button is highlighted (filled background). Tapping it again closes the panel.
- "Day ▶" button is always visually distinct — different colour from the three panel buttons. It is the most important single action in the game.
- "Day ▶" is never disabled in MVP. The player can always advance.
- When a panel is open, "Day ▶" is still visible and tappable. Advancing the day auto-closes any open panel first.
- Button labels use text, not icons alone. Icons aid recognition; text prevents confusion.

---

## 4. Build Menu Panel

Slides up from the bottom action bar. Covers roughly the bottom 40% of the screen. The grid remains partially visible above.

```
┌───────────────────────────────────────────────┐
│  BUILD                                   [✕]  │  ← drag handle + title + close
├───────────────────────────────────────────────┤
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Slot    │  │ S. Table │  │ L. Table │   │
│  │  1×1     │  │  2×3     │  │  2×4     │   │
│  │  750 💰  │  │ 2,500 💰 │  │ 4,500 💰 │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│                                               │
│  ┌──────────┐  ┌──────────┐                  │
│  │   WC     │  │   Bar    │                  │
│  │  3×1 ⌐  │  │  8×1 ⌐  │                  │
│  │ 1,200 💰 │  │ 6,500 💰 │                  │
│  └──────────┘  └──────────┘                  │
│               (Bar: already built)            │
└───────────────────────────────────────────────┘
```

**Object card states:**

| State | Visual |
|---|---|
| Affordable | Full colour, tappable |
| Unaffordable | Greyed out, cost shown in red, not tappable |
| Limit reached (bar) | Greyed out, label "Already built" |
| Selected | Highlighted border, panel collapses |

**Flow after selecting an object:**
1. Player taps an object card.
2. Build menu slides down and closes.
3. Grid enters placement mode: ghost object appears, follows finger drag.
4. Green ghost = valid placement. Red ghost = invalid.
5. Player taps to confirm, or taps the ✕ cancel button that appears in the corner.
6. On confirm: object placed, cash deducted, menu does not auto-reopen (player returns to free-browse mode).

**Variant selection (tables only):**
When the player taps a table card, a brief inline selector appears on the card before confirming:

```
┌──────────────────────────────┐
│ Small Table — choose type:   │
│  [Blackjack]   [Poker]       │
└──────────────────────────────┘
```

One tap selects the variant and enters placement mode. No full-screen modal needed.

**Demolish mode:**
A small "Demolish" toggle button sits in the top-right of the build menu. When active, tapping any object on the grid shows a confirmation tooltip with refund amount, then removes it. Toggle turns red when active. Auto-deactivates when the build menu closes.

```
BUILD                 [Demolish 🗑️]  [✕]
```

---

## 5. Hotel Panel

Slides up from the bottom action bar. Same height as the build menu (~40% screen). The grid remains partially visible above.

```
┌───────────────────────────────────────────────┐
│  HOTEL                                   [✕]  │
├───────────────────────────────────────────────┤
│                                               │
│  Rooms: 4          Quality: ★★☆  (Level 2)   │
│  Booked: 3 / 4     Occupancy: 75%            │
│  Hotel income: +75 💰/day                     │
│                                               │
├───────────────────────────────────────────────┤
│  ADD ROOMS                                    │
│  +2 rooms  1,000 💰   [Buy]                   │
│  +4 rooms  1,800 💰   [Buy]                   │
│  +8 rooms  3,200 💰   [Buy]                   │
├───────────────────────────────────────────────┤
│  UPGRADE QUALITY                              │
│  Level 2 → 3   4,000 💰   [Upgrade]           │
│  (Level 3 is maximum)                         │
└───────────────────────────────────────────────┘
```

**Rules:**
- "Buy" buttons are greyed and disabled when the player cannot afford them.
- Quality upgrade row only shows the next available upgrade. If already at level 3, replace with "Maximum quality reached."
- Booked rooms and occupancy update after each day tick, not in real time.
- Hotel income shows the previous day's hotel room revenue as context.
- No animation needed on purchase — numbers update instantly.

---

## 6. Goals Panel

Accessible via a tap on the Goal Ticker Strip (see Section 8). Opens as a full-screen overlay from the bottom (slides up to cover the full screen). Not part of the bottom action bar.

```
┌───────────────────────────────────────────────┐
│  GOALS                                   [✕]  │
├───────────────────────────────────────────────┤
│                                               │
│  ✓  First Machines    Build 3 slots           │
│  ✓  First Crowd       35 guests/day           │
│  ✓  Basic Amenity     Build first WC          │
│  ▶  Real Gaming       Build first small table │
│     [████████░░░░]  0 / 1                     │
│                                               │
│  ○  Rising Star       Rating 2.0              │
│  ○  First Profit      Earn 5,000 total        │
│  ○  Hotel Open        Expand to 4 rooms       │
│  ○  Busy Floor        60 guests/day           │
│  ○  Quality Service   Hotel quality 2         │
│  ○  Grand Bar         Build the bar           │
│                                               │
└───────────────────────────────────────────────┘
```

**Rules:**
- Full-screen so the list has room to breathe. 10 goals is too many to cram into a half-panel.
- Completed goals show a tick and are dimmed slightly — still readable, not prominent.
- The active goal row is full contrast with a progress bar directly below.
- Future goals are shown at reduced opacity (~50%). The player can see what's coming.
- No reward amounts shown. Rewards are revealed on completion only.
- This panel is read-only. No actions taken here.

---

## 7. Stats Panel

Opens as a full-screen overlay from the Stats button. Two tabs: **Today** and **History**.

### Today tab

```
┌───────────────────────────────────────────────┐
│  STATS              [Today]  [History]   [✕]  │
├───────────────────────────────────────────────┤
│                                               │
│  Day 14 Summary                               │
│                                               │
│  Resort Rating      2.3  ▲0.1               │
│  Total Guests        12 /day                 │
│    Walk-in            9                      │
│    Hotel              3                      │
│  Casino Capacity     11                      │
│  Crowding            0%                      │
│                                               │
│  ─────────────────────────────────────       │
│                                               │
│  REVENUE                                     │
│  Slots               36 💰                   │
│  Tables             110 💰                   │
│  Bar                  — 💰                   │
│  Hotel rooms         25 💰                   │
│  ─────────────────────────────────────       │
│  Total              171 💰                   │
│                                               │
│  Total Earned     4,820 💰  (goal: 5,000)    │
│                                               │
└───────────────────────────────────────────────┘
```

### History tab

Shows simple line charts. One chart per metric. Stack them vertically, each ~140px tall.

```
┌───────────────────────────────────────────────┐
│  STATS              [Today]  [History]   [✕]  │
├───────────────────────────────────────────────┤
│                                               │
│  Guests / Day                                 │
│  ┌─────────────────────────────────────────┐ │
│  │           ╱‾‾‾╲___                      │ │
│  │      ╱‾‾╱         ╲___                  │ │
│  └─────────────────────────────────────────┘ │
│  Day 1                            Day 14      │
│                                               │
│  Resort Rating                                │
│  ┌─────────────────────────────────────────┐ │
│  │                       ╱‾‾‾‾‾‾‾          │ │
│  │    ───────────────╱                     │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  Revenue / Day                                │
│  ┌─────────────────────────────────────────┐ │
│  │                     ╱‾‾‾‾‾‾‾‾‾          │ │
│  │    ─────────────╱                       │ │
│  └─────────────────────────────────────────┘ │
│                                               │
└───────────────────────────────────────────────┘
```

**Chart rules:**
- Use ChartHistory parallel arrays directly. No transformation needed.
- Show last 30 days maximum. X-axis shows day numbers at start and end only.
- Y-axis: no labels in MVP — just the curve. Add labels post-MVP.
- No tooltips on tap in MVP. Static charts only.
- Line colour: one colour per chart (not configurable).

---

## 8. What Should Be Visible at All Times

These elements are **always on screen**, never hidden by panels or overlays:

| Element | Why always visible |
|---|---|
| Top HUD strip | Rating, guests, cash, and day are orientation anchors. Players need them after every decision. |
| Casino floor grid | The game. Always visible at least partially. |
| Goal ticker strip | Passive goal awareness without requiring a panel open. |
| Bottom action bar | Primary navigation. Always reachable without closing anything. |

### Goal Ticker Strip (detail)

A thin strip between the grid and the action bar. Single line. Scrolls if needed but in MVP the active goal always fits on one line.

```
┌─────────────────────────────────────────────┐
│  ▶  Real Gaming — Build your first table    │
└─────────────────────────────────────────────┘
```

- Tapping the strip opens the Goals full-screen panel.
- Shows the active goal label and short description only.
- When all goals are complete, shows: "✓ All goals complete — view summary."

---

## 9. What Can Be Hidden Behind Buttons

These are accessible only via explicit tap. They should not demand attention during normal play.

| Surface | Trigger | Reason for hiding |
|---|---|---|
| Build menu | Bottom bar "Build" button | Only needed when the player wants to build |
| Hotel panel | Bottom bar "Hotel" button | Only needed for hotel purchases |
| Stats / Today | Bottom bar "Stats" button | Informational — not needed every day |
| Stats / History charts | "History" tab inside Stats | Reference only — rarely needed |
| Goals list | Tap goal ticker strip | The ticker shows enough for daily awareness |
| Variant selector | Tap table card in build menu | Only needed once per table placed |
| Demolish mode | Toggle in build menu | Infrequent action; should not be accidentally triggered |
| End-state screen | Goal 10 completion | Auto-shown — not a button |

**Rule for prototype:** If a feature is implemented but its panel feels empty or incomplete, add a placeholder label ("Coming soon") rather than showing a half-finished UI. A clean placeholder is better than broken or cluttered real content.

---

## 10. Keeping the Prototype Clean

### The three-panel rule

Only three sliding panels exist: Build, Hotel, Stats. No fourth panel is added in MVP. If a new system needs UI, it waits for post-MVP or is absorbed into one of the existing three panels.

### Metric priority tiers

Not every metric needs screen space. Assign each a tier:

| Tier | Metrics | Where shown |
|---|---|---|
| **Always** | Cash, Rating, Guests/day, Day | Top HUD |
| **On day end** | Revenue, capacity, occupancy | Stats › Today |
| **On demand** | Charts, goal history, hotel breakdown | Stats › History, Goals panel |
| **Never in MVP** | Per-object utilisation, guest paths, detailed crowding | Post-MVP only |

### Ghost and placement feedback

Placement mode (when placing an object) is the highest-stress UI moment. Keep it clean:
- Only show the ghost object and the ✕ cancel button.
- Collapse the build menu completely.
- Do not show the HUD overlay or any panels during placement mode.
- After placement, restore the previous screen state.

### Avoid in the prototype

| Anti-pattern | Why |
|---|---|
| Tooltips on every element | Players won't read them; they slow down the prototype feel |
| Confirmation dialogs on every action | Only for demolish (irreversible). Not for placement, not for hotel purchases. |
| Animated transitions longer than 0.3s | Feels sluggish on a prototype; save polish for production |
| More than 4 items in any single row | Cramped on mobile; break into two rows or use a list |
| Full-screen modals for simple confirmations | Use inline card states instead |
| Number formatting with unnecessary precision | Show `4,820` not `4,820.00` |

### Prototype-first component order

Build in this order. Stop when the prototype is playable.

```
Phase 1 — Playable skeleton (required for any testing)
  1. Grid render with lobby and pre-placed objects
  2. Top HUD (4 values, no animation)
  3. Bottom action bar (buttons exist, tap does nothing)
  4. Day ▶ button runs simulation, HUD updates

Phase 2 — Core loop (required for the game to work)
  5. Build menu panel with object cards
  6. Placement mode with ghost and green/red feedback
  7. Goal ticker strip with active goal
  8. Demolish mode

Phase 3 — Hotel and progression
  9. Hotel panel with room/quality purchases
  10. Goals full-screen panel
  11. Goal completion animation + reward

Phase 4 — Stats and charts (nice to have for MVP)
  12. Stats › Today panel
  13. Stats › History with line charts
  14. End-state screen
```

Phases 1 and 2 are the minimum viable prototype. Phases 3 and 4 complete the MVP experience.

---

*UI design version: MVP 1.1 — matches all MVP 1.1 documents.*
