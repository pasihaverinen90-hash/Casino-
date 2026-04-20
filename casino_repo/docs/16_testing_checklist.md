# Casino Resort Manager — MVP Testing Checklist
**Solo developer QA. Work through each section in order. Check off as you go.**
**Tip: run each section after implementing that system — don't save all testing for the end.**

---

## How to Use This Checklist

- `[ ]` = not yet tested
- `[✓]` = passed
- `[✗]` = failed — note the bug inline
- **BLOCKER** = must fix before any further testing in that section
- **WARN** = wrong but non-blocking; fix before release

Numbers in parentheses are expected values to verify against.

---

## Section 1 — Placement Tests

### 1.1 Basic floor placement
- [ ] Slot machine places on a free FLOOR tile
- [ ] Slot machine cannot place on a LOBBY tile
- [ ] Slot machine cannot place on a WALL tile
- [ ] Slot machine cannot place on a BLOCKED tile (reception, elevator, entrance)
- [ ] Slot machine cannot place outside grid bounds
- [ ] Two slot machines cannot occupy the same tile **BLOCKER**
- [ ] Placed slot machine appears on grid immediately after confirming

### 1.2 Multi-tile floor objects
- [ ] Small table (2×3) places correctly — footprint fills exactly 6 tiles
- [ ] Large table (2×4) places correctly — footprint fills exactly 8 tiles
- [ ] Rotating small table swaps to 3×2 footprint
- [ ] Rotated table cannot be placed if any of its tiles are occupied
- [ ] Table cannot straddle the lobby/casino boundary
- [ ] Table with 1 accessible side is rejected (FAIL_NO_ACCESS) **BLOCKER**
- [ ] Table with 2 accessible sides is accepted

### 1.3 Wall placement
- [ ] WC (3×1) places against north perimeter wall
- [ ] WC places against south perimeter wall
- [ ] WC places against east perimeter wall (non-lobby)
- [ ] WC places against west perimeter wall (non-lobby)
- [ ] WC cannot place against lobby strip wall (col 15 or col 20)
- [ ] WC door tile (centre tile) has a free floor tile inward from wall
- [ ] Placing a floor object directly in front of WC door is blocked
- [ ] Bar (8×1) requires 8 continuous wall tiles — shorter wall run is rejected
- [ ] Bar (8×1) places successfully against a long enough wall
- [ ] Bar door tiles (indices 3 and 4) both have free inward neighbours

### 1.4 Instance limits
- [ ] First bar places successfully
- [ ] Build menu bar button is greyed out after bar is placed
- [ ] Attempting to place a second bar (if triggered programmatically) returns FAIL_LIMIT **BLOCKER**
- [ ] Demolishing the bar re-enables the bar button in the build menu

### 1.5 Affordability
- [ ] Object button is greyed out when cash < cost
- [ ] Attempting to place unaffordable object returns FAIL_AFFORD
- [ ] After earning cash, previously unaffordable buttons become active

### 1.6 Demolish
- [ ] Demolishing a slot refunds 375 cash (750 × 50%)
- [ ] Demolishing a small table refunds 1,250 cash
- [ ] Demolishing a large table refunds 2,250 cash
- [ ] Demolishing a WC refunds 600 cash
- [ ] Demolishing the bar refunds 3,250 cash
- [ ] Demolished object's tiles become free immediately **BLOCKER**
- [ ] Demolishing a table — all 6 or 8 tiles are freed, not just the anchor tile
- [ ] Object counts update correctly after demolish (slotCount decreases)
- [ ] barExists becomes false after bar demolished

### 1.7 Ghost preview
- [ ] Ghost appears green on valid placement tile
- [ ] Ghost appears red on invalid tile (wall, lobby, occupied)
- [ ] Ghost updates in real-time as finger/mouse moves
- [ ] Confirm button only active when ghost is green
- [ ] Cancelling placement returns to normal browse mode with no changes

---

## Section 2 — Economy Tests

Run these by advancing days and checking Output / HUD values.

### 2.1 Starting state
- [ ] Cash starts at exactly 7,500 **BLOCKER**
- [ ] cumulativeIncome starts at 0 **BLOCKER**
- [ ] Day number starts at 1
- [ ] lastDayGuests starts at 0

### 2.2 Revenue calculation — manual verification
Build state: 3 slots only, no hotel rooms. Advance one day.

Expected:
- casinoCapacity = 3
- ratingMultiplier ≈ 0.962 (0.6 + 1.81/5)
- capacityMultiplier = 0.1 (3/30)
- walkInGuests ≈ 3
- totalGuests ≈ 3
- dailyRevenue ≈ 60 (aggregate: 3 × 20) or ~36 (3 slot guests × 12)

- [ ] casinoCapacity = 3 after placing 3 slots
- [ ] walkInGuests is in range 2–4 on day 2 (day 1 has no penalty)
- [ ] Cash increases after advancing day
- [ ] cumulativeIncome = dailyRevenue after day 1 (not counting starting cash)

### 2.3 Revenue with tables
Build state: 1 slot + 1 small table. Advance one day.

Expected:
- casinoCapacity = 1 + 4 = 5
- slotShare = 1/5 = 0.2, tableShare = 4/5 = 0.8

- [ ] Slot guests ≈ 20% of total guests
- [ ] Table guests ≈ 80% of total guests
- [ ] Table revenue > slot revenue (22 vs 12 per guest)

### 2.4 Bar revenue
- [ ] Bar guest draw = round(totalGuests × 0.15) when bar exists
- [ ] Bar revenue = barGuests × 8
- [ ] Bar guests do NOT reduce slot or table guest counts

### 2.5 Hotel room revenue
- [ ] Hotel revenue = bookedRooms × 25
- [ ] Hotel revenue added independently of casino revenue
- [ ] With 0 rooms: hotelRoomRevenue = 0

### 2.6 Cash safety
- [ ] Cash never goes below 0 under any circumstances **BLOCKER**
- [ ] Buying hotel rooms deducts correct amount from cash
- [ ] Buying quality upgrade deducts correct amount from cash
- [ ] Multiple purchases in same session stack correctly

---

## Section 3 — Rating Tests

### 3.1 Base rating
- [ ] New game: resort_rating ≈ 1.75 (base 1.5 + quality 1 × 0.25) **BLOCKER**
- [ ] Rating never below 1.0, never above 5.0 under any state **BLOCKER**

### 3.2 Per-object contributions
Test each object in isolation on a fresh game. Add one object, advance one day, check rating change.

- [ ] +1 slot:        rating increases by ~0.02
- [ ] +1 small table: rating increases by ~0.18
- [ ] +1 large table: rating increases by ~0.25
- [ ] +1 WC:          rating increases by ~0.20
- [ ] bar built:      rating increases by ~0.35
- [ ] +1 hotel room:  rating increases by ~0.03

### 3.3 Hotel quality
- [ ] Quality level 1: contributes +0.25 (always present from start)
- [ ] Quality level 2: contributes +0.50 (total, not additional)
- [ ] Quality level 3: contributes +0.75 (total)
- [ ] Upgrading quality → immediate rating improvement on next day

### 3.4 Crowding penalty
Setup: place 1 slot (capacity 1), advance days until guests > 1.

- [ ] With 0 lastDayGuests: crowdingPenalty = 0.0
- [ ] With guests = capacity: penalty = 0.0
- [ ] With guests = 2 × capacity: rawPenalty = 0.5
- [ ] Smoothing: penalty on day 1 of overcrowding = 0.4 × rawPenalty (not full raw)
- [ ] Penalty accumulates over multiple overcrowded days
- [ ] Adding capacity reduces penalty on subsequent days
- [ ] With casinoCapacity = 0: penalty = 0, no divide-by-zero **BLOCKER**

### 3.5 Display
- [ ] Rating displays as X.X (always one decimal place)
- [ ] Rating shows 1.0 not 1 or 1.00
- [ ] Rating shows 5.0 when clamped at ceiling
- [ ] Star display matches numeric rating (e.g. 2.3 → 2 full + partial star)

---

## Section 4 — Hotel Tests

### 4.1 Starting state
- [ ] roomCount starts at 0
- [ ] qualityLevel starts at 1
- [ ] Hotel panel shows "Rooms: 0", "Quality: ★☆☆"
- [ ] With 0 rooms: hotelCasinoGuests = 0, hotelRoomRevenue = 0

### 4.2 Room purchases
- [ ] +2 rooms option costs 1,000 and adds exactly 2 rooms
- [ ] +4 rooms option costs 1,800 and adds exactly 4 rooms
- [ ] +8 rooms option costs 3,200 and adds exactly 8 rooms
- [ ] Multiple purchases stack (buy +2 twice = 4 rooms total)
- [ ] Room purchase greyed out when unaffordable
- [ ] roomCount persists across day advances

### 4.3 Occupancy formula
With 4 rooms, quality 1, rating 1.75:
- occupancy = min(1.0, 0.35 + 0.175 + 0.08) = min(1.0, 0.605) = 0.605
- bookedRooms = floor(4 × 0.605) = floor(2.42) = 2

- [ ] occupancyRate updates after room purchase
- [ ] bookedRooms = floor(roomCount × occupancyRate) — not rounded **BLOCKER**
- [ ] hotelCasinoGuests = round(bookedRooms × 0.9)
- [ ] Higher resort rating → higher occupancy rate
- [ ] Quality level 2 raises occupancy rate noticeably

### 4.4 Quality upgrades
- [ ] Level 1→2 upgrade costs 2,000
- [ ] Level 2→3 upgrade costs 4,000
- [ ] Cannot upgrade past level 3
- [ ] Upgrade button hidden/disabled at level 3
- [ ] Quality upgrade immediately increases displayed quality level
- [ ] Quality upgrade affects rating on next day advance

---

## Section 5 — Progression Tests

### 5.1 Goal ordering
Verify goals trigger in the correct sequence. Complete each one in order.

- [ ] Goal 1 (3 slots): fires immediately on 3rd slot placement **BLOCKER**
- [ ] Goal 2 (35 guests): fires at end of day when totalGuests ≥ 35
- [ ] Goal 3 (1 WC): fires immediately on WC placement
- [ ] Goal 4 (1 small table): fires immediately on table placement
- [ ] Goal 5 (rating 2.0): fires at end of day when rating ≥ 2.0
- [ ] Goal 6 (5,000 cumulative): fires at end of day — NOT when cash hits 5,000
- [ ] Goal 7 (4 rooms): fires immediately on hotel purchase that brings total ≥ 4
- [ ] Goal 8 (60 guests): fires at end of day when totalGuests ≥ 60
- [ ] Goal 9 (quality 2): fires immediately on quality upgrade
- [ ] Goal 10 (bar): fires immediately on bar placement

### 5.2 Goal rewards
- [ ] Goal 1 reward: +500 cash
- [ ] Goal 2 reward: +800 cash
- [ ] Goal 3 reward: +600 cash
- [ ] Goal 4 reward: +1,200 cash
- [ ] Goal 5 reward: +1,000 cash
- [ ] Goal 6 reward: +1,500 cash
- [ ] Goal 7 reward: +1,000 cash
- [ ] Goal 8 reward: +2,000 cash
- [ ] Goal 9 reward: +1,500 cash
- [ ] Goal 10 reward: +3,000 cash + end screen shown

### 5.3 Goal state
- [ ] Completed goals stay complete after demolishing related objects
- [ ] Active goal index only ever increments, never decrements
- [ ] Goal 6 uses cumulativeIncome (starts at 0), not cash balance **BLOCKER**
- [ ] Starting cash (7,500) does NOT count toward goal 6
- [ ] Toast notification appears on goal completion
- [ ] GoalTicker updates to show next active goal after completion
- [ ] GoalsPanel shows correct ✓ / ▶ / ○ icons for each goal
- [ ] Progress bar in GoalsPanel fills correctly for active goal

### 5.4 End state
- [ ] End screen appears after goal 10 completes
- [ ] End screen shows correct day count, rating, total earned, objects built
- [ ] "Play Again" resets game to fresh state with 7,500 cash

---

## Section 6 — Save / Load Tests

### 6.1 Basic persistence
- [ ] Advancing a day then force-quitting and reloading restores same state **BLOCKER**
- [ ] Cash balance survives save/load
- [ ] cumulativeIncome survives save/load (not reset to 0)
- [ ] Day number survives save/load
- [ ] All placed objects appear on grid after reload
- [ ] Demolished objects do not reappear after reload
- [ ] Hotel roomCount and qualityLevel survive save/load

### 6.2 Map reconstruction
- [ ] Grid tiles are correctly rebuilt from saved placed objects (not saved directly)
- [ ] Tile occupiedByObjId correctly set after load
- [ ] Wall/Lobby/Blocked tiles are correct after reload (rebuild from constants, not save)
- [ ] Placing an object in a loaded game works immediately without errors **BLOCKER**
- [ ] No "tile already occupied" errors on a correctly loaded save

### 6.3 Progression persistence
- [ ] activeGoalIndex survives save/load
- [ ] completedGoals array survives save/load (all 10 booleans)
- [ ] Goal that was met before save fires immediately on load if not yet recorded
- [ ] lastDayGuests survives save/load (needed for crowding penalty on first tick after load)
- [ ] prevCrowdingPenalty survives save/load

### 6.4 Stats history
- [ ] stats_records array survives save/load
- [ ] Chart arrays survive save/load
- [ ] History charts show correct data after reload
- [ ] History does not double-append on reload

### 6.5 Edge cases
- [ ] No save file: starts fresh game with 7,500 cash
- [ ] Corrupt save file (manually break JSON): starts fresh game, no crash **BLOCKER**
- [ ] Old version save (change ver field to "1.0.0"): starts fresh game
- [ ] Save file exists but is empty: starts fresh game

---

## Section 7 — UI Tests

### 7.1 Top HUD
- [ ] Rating, guests, cash, and day all visible simultaneously
- [ ] Cash updates immediately after any purchase
- [ ] Guests and rating update after day advance
- [ ] Day increments after day advance
- [ ] Numbers do not overlap or truncate at realistic values (e.g. cash "99,999")

### 7.2 Build panel
- [ ] Opens on "Build" tap, closes on second "Build" tap
- [ ] All 5 object types visible
- [ ] Unaffordable objects are visually distinct (greyed)
- [ ] Bar shows "Already built" when barExists = true
- [ ] Variant picker appears for table types (Blackjack/Poker or Roulette/Craps)
- [ ] Variant selection enters placement mode correctly
- [ ] Demolish toggle turns red when active
- [ ] Demolish mode: tapping a placed object removes it
- [ ] Build panel closes when placement mode is entered

### 7.3 Hotel panel
- [ ] Opens on "Hotel" tap
- [ ] Shows current rooms, quality, booked rooms, occupancy %
- [ ] Room purchase buttons greyed when unaffordable
- [ ] Quality upgrade shows correct next level and cost
- [ ] Quality upgrade button disabled at level 3
- [ ] Purchasing rooms or quality updates panel display immediately

### 7.4 Stats panel
- [ ] Today tab shows last day's data
- [ ] Revenue breakdown shows slots/tables/bar/hotel separately
- [ ] Switching to History tab shows charts
- [ ] Charts render with correct data (not empty when history exists)
- [ ] Charts show "No data yet" on day 1 before first advance
- [ ] Charts cap at 60 entries (verify on a long session)

### 7.5 Goals panel
- [ ] Accessible via tap on GoalTicker strip
- [ ] All 10 goals listed
- [ ] Completed goals shown with ✓, active goal with ▶, future with ○
- [ ] Progress bar shows for active goal only
- [ ] Panel closes correctly

### 7.6 Navigation
- [ ] Only one panel open at a time — opening Build closes Hotel/Stats
- [ ] Back/Escape key closes open panel
- [ ] Day ▶ button works while a panel is open (panel closes first)
- [ ] Placement cancel (✕ or Escape) returns to normal browse mode
- [ ] No dead states where UI is stuck (e.g. ghost stuck on screen)

### 7.7 Toast notifications
- [ ] Goal completion toast appears with correct goal name and reward
- [ ] Placement failure toast shows correct reason
- [ ] Demolish refund toast shows correct amount
- [ ] Toast auto-dismisses after ~2.5 seconds
- [ ] Multiple rapid events don't stack broken toasts

---

## Section 8 — Edge Cases

These are the specific scenarios most likely to produce unexpected behaviour.

### 8.1 Zero-state scenarios
- [ ] Advance day with nothing built: no crash, 0 revenue, rating stays 1.75 **BLOCKER**
- [ ] Advance day with 0 hotel rooms: no divide-by-zero, hotel guests = 0 **BLOCKER**
- [ ] Advance day with casinoCapacity = 0: walkInGuests = 0, no NaN **BLOCKER**
- [ ] Place WC with nothing else built: rating updates correctly

### 8.2 Boundary conditions
- [ ] Place object at grid corner (col=1, row=1 — just inside wall)
- [ ] Place object exactly at lobby edge (col=14 or col=21)
- [ ] Bar placed on wall with exactly 8 continuous tiles — accepted
- [ ] Bar placed on wall with 7 tiles — rejected
- [ ] Object with rotated=true placed where only rotated fits
- [ ] Crowding penalty when guests exactly equal capacity: penalty = 0, not slightly positive

### 8.3 Rapid actions
- [ ] Place and immediately demolish same object: no orphaned tiles **BLOCKER**
- [ ] Buy rooms twice in quick succession: roomCount sums correctly
- [ ] Advance day multiple times quickly: day number, cash, history all increment correctly
- [ ] Complete goal → reward applied → next goal immediately checked (cascade): no double reward

### 8.4 Large numbers
- [ ] Cash display handles 99,999 (6 digits) without truncation
- [ ] cumulativeIncome correctly tracks past 5,000 (goal 6 threshold)
- [ ] 60-entry chart history: oldest entry dropped, newest appended, length stays 60
- [ ] Stats panel scrollable when many days of data exist

### 8.5 Demolish edge cases
- [ ] Demolish object that straddles demolished area: all tiles freed
- [ ] Demolish the only slot when goal 1 already complete: goal stays complete
- [ ] Demolish bar when goal 10 already complete: game does NOT un-complete
- [ ] Demolish bar: barExists = false, build menu bar button re-enabled

---

## Section 9 — Balancing Sanity Checks

These are not pass/fail — they are feel checks. Note your observations.

### 9.1 Early game pacing (Day 1–10)
Run a session building only 3 slots. Record daily income for 5 days.

- [ ] Daily revenue with 3 slots only: ____________ (expect ~60/day)
- [ ] Does early income feel slow but not stalled? Y / N / Note:____________
- [ ] Does the first table purchase feel like a meaningful decision? Y / N

### 9.2 Mid game transition
Build 3 slots + 1 WC + 1 small table. Record income.

- [ ] Daily revenue: ____________ (expect ~120–170/day)
- [ ] Is the jump from slots-only to first table noticeably better? Y / N
- [ ] Does resort_rating reach 2.0 within a few days of this state? Y / N

### 9.3 Goal reachability
Play through goals 1–5 in order. Note day number when each goal completes.

- [ ] Goal 1 (3 slots):          Day ____  (expect: Day 1)
- [ ] Goal 2 (35 guests):        Day ____  (expect: Day 15–25)
- [ ] Goal 3 (1 WC):             Day ____  (expect: shortly after goal 2)
- [ ] Goal 4 (1 small table):    Day ____
- [ ] Goal 5 (rating 2.0):       Day ____  (expect: same day or next after goal 4)

If goal 5 completes the same day as goal 4: expected.
If goal 5 takes more than 3 days after goal 4: rating formula may need tuning.

### 9.4 Hotel vs floor balance
- [ ] At 10 rooms + quality 2, is hotel income less than casino floor income? Y / N
  (Hotel should supplement, not dominate. If hotel > floor income: reduce REV_PER_ROOM)
- [ ] Does buying hotel rooms feel worth it vs buying more slots? Y / N

### 9.5 Crowding feel
Run a session where guests exceed capacity by 2× for 3 consecutive days.

- [ ] Does rating drop noticeably? Y / N (expect −0.2 to −0.4 over 3 days)
- [ ] Is the signal clear enough for the player to notice and respond? Y / N
- [ ] After fixing overcrowding (add capacity), does rating recover within 2–3 days? Y / N

### 9.6 Goal rewards
- [ ] Do goal rewards feel meaningful (not too small, not game-breaking)? Y / N
- [ ] Does reward from goal 8 (+2,000) feel well-timed before the expensive hotel upgrade? Y / N

---

## Section 10 — Likely Bugs to Watch For

These are the highest-probability issues based on the architecture. Check these first if something seems wrong.

### 10.1 @onready null errors
**Symptom:** Script error on scene load, node not found.
**Cause:** Node name in scene tree doesn't match `$NodeName` in script.
**Check:** Every `@onready var x : NodeType = $Path` — verify the path exists in the tree exactly.

### 10.2 Signal not connected
**Symptom:** Advancing day / placing objects doesn't update UI.
**Cause:** `state_changed.connect()` not called in `_ready()`, or signal emitted before connection.
**Check:** Verify every UI script connects to `GameState.state_changed` in `_ready()`.

### 10.3 Tile occupancy not cleared on demolish
**Symptom:** Demolished object leaves tiles as occupied — new objects can't place there.
**Cause:** Loop over `obj.tiles` not executing, or wrong tile index formula.
**Check:** After demolishing, inspect `tiles[row * GRID_COLS + col].obj_id` — should be `""`.

### 10.4 cumulativeIncome includes starting cash
**Symptom:** Goal 6 (earn 5,000) completes instantly on day 1.
**Cause:** Starting cash added to `cumulative_income` in `_new_game()`.
**Check:** `cumulative_income` must be initialised to `0`, not `STARTING_CASH`.

### 10.5 Crowding divide-by-zero
**Symptom:** Game crashes or rating becomes NaN when casinoCapacity = 0.
**Cause:** `last_guests / casinoCapacity` when capacity is zero.
**Check:** `Simulation.calc_crowding()` must guard `if capacity <= 0: return ...` **BLOCKER**

### 10.6 Footprint not rebuilt on load
**Symptom:** Placing an object after load crashes, or demolish frees wrong tiles.
**Cause:** Saved objects don't store `tiles` array; it must be recomputed on load.
**Check:** `_try_load()` calls `PV.compute_footprint()` for each loaded object.

### 10.7 Goal cascade infinite loop
**Symptom:** Game freezes or stack overflow after a goal completes.
**Cause:** `_check_goals()` calls itself recursively without a base case.
**Check:** `_check_goals()` returns immediately when `active_goal >= 10`.

### 10.8 Chart arrays different lengths
**Symptom:** Chart renders garbled data or crashes on index access.
**Cause:** One chart array was appended without appending to all others.
**Check:** After each day advance, verify all chart arrays have the same `.size()`.

### 10.9 Rotation swapping wrong dimensions
**Symptom:** Rotated object footprint has wrong shape (tall when should be wide).
**Cause:** `w = def.fh if rotated else def.fw` — must be `fh` not `fw` for the width.
**Check:** Place a 2×3 table, rotate it — verify it becomes 3 wide × 2 tall on grid.

### 10.10 Save overwrites with stale derived values
**Symptom:** After loading, rating or capacity is wrong until the next day advances.
**Cause:** `_try_load()` doesn't call `_recompute_derived()` after restoring placed objects.
**Check:** `_try_load()` must call `_recompute_derived()` as its second-to-last step.

### 10.11 Hotel guests added before rooms purchased
**Symptom:** Hotel casino guests > 0 even with 0 rooms.
**Cause:** `calc_occupancy()` not guarding `if room_count == 0`.
**Check:** With roomCount = 0, hotelCasinoGuests must always be exactly 0. **BLOCKER**

### 10.12 Ghost persists after placement confirmed
**Symptom:** Ghost object stays on grid after tapping to place.
**Cause:** `exit_placement_mode()` not called after `placement_confirmed` signal fires.
**Check:** After confirming placement, `placement_active` must be `false`, `ghost_col` = -1.

---

## Quick Smoke Test (5 minutes, first boot)

Run these in order on a fresh install. If all pass, the core loop is functional.

1. [ ] Game loads without errors in Godot Output panel
2. [ ] Grid renders (grey floor tiles, green-tinted lobby strip, darker walls)
3. [ ] HUD shows: ★ 1.8 | 👥 0/day | 💰 7,500 | Day 1
4. [ ] Tap "Build" → build panel slides up with 5 objects
5. [ ] Tap "Slot Machine" → panel closes, green ghost follows mouse/finger
6. [ ] Tap a floor tile → slot appears, cash decreases by 750 (now 6,750)
7. [ ] Tap "▶ Day" → day advances to 2, cash increases slightly
8. [ ] GoalTicker still shows goal 1 (need 3 slots)
9. [ ] Place 2 more slots → GoalTicker shows goal complete toast + +500 cash
10. [ ] Tap "Hotel" → hotel panel shows 0 rooms, level 1
11. [ ] Tap "+2 rooms (1,000)" → rooms become 2
12. [ ] Quit and reopen → same state restored (day number, cash, objects, rooms)

If all 12 pass: proceed to full section testing.

---

*Checklist version: MVP 1.1 — matches all MVP 1.1 design documents.*
