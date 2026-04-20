# Casino Resort Manager — Object Definitions
**All buildable and fixed map objects. Matches ruleset MVP 1.1 and data model MVP 1.1.**

---

## Buildable Objects

---

### SLOT_MACHINE

| Field | Value |
|---|---|
| **ID** | `slot_machine` |
| **Display Name** | Slot Machine |
| **Category** | Casino Floor |
| **Size** | 1 × 1 |
| **Wall Object** | No |
| **Cost** | 750 |
| **Demolish Refund** | 375 |
| **Instance Limit** | Unlimited |
| **Capacity Contribution** | +1 per unit |
| **Rating Contribution** | +0.02 per unit |
| **Revenue Behavior** | Passive. Contributes to `casinoCapacity`, which feeds `capacityMultiplier`, which scales daily walk-in guest count. No direct per-object revenue. |
| **Rotation** | Allowed (90° increments) |
| **Placement Rules** | Any free `FLOOR` tile. Cannot overlap other objects, `LOBBY`, or `BLOCKED` tiles. |
| **Variant** | None |
| **Special Notes** | Cheapest object. Primary tool for early capacity growth. Rating gain per cash spent is low — tables are more efficient at mid-game. |

---

### SMALL_TABLE

| Field | Value |
|---|---|
| **ID** | `small_table` |
| **Display Name** | Small Table |
| **Category** | Casino Floor |
| **Size** | 2 × 3 |
| **Wall Object** | No |
| **Cost** | 2,500 |
| **Demolish Refund** | 1,250 |
| **Instance Limit** | Unlimited |
| **Capacity Contribution** | +4 per unit |
| **Rating Contribution** | +0.18 per unit |
| **Revenue Behavior** | Passive. Contributes to `casinoCapacity`. No direct per-object revenue. |
| **Rotation** | Allowed (90° increments) |
| **Placement Rules** | Any free `FLOOR` tile region of sufficient size. All tiles in the 2×3 footprint must be free, non-lobby, non-blocked. |
| **Variant** | `BLACKJACK` or `POKER` — chosen at placement. Cosmetic only. No mechanical difference. |
| **Special Notes** | Best rating-per-cash ratio of the casino floor objects. Should be the second object type the player targets after slots. |

---

### LARGE_TABLE

| Field | Value |
|---|---|
| **ID** | `large_table` |
| **Display Name** | Large Table |
| **Category** | Casino Floor |
| **Size** | 2 × 4 |
| **Wall Object** | No |
| **Cost** | 4,500 |
| **Demolish Refund** | 2,250 |
| **Instance Limit** | Unlimited |
| **Capacity Contribution** | +6 per unit |
| **Rating Contribution** | +0.25 per unit |
| **Revenue Behavior** | Passive. Contributes to `casinoCapacity`. No direct per-object revenue. |
| **Rotation** | Allowed (90° increments) |
| **Placement Rules** | Any free `FLOOR` tile region of sufficient size. All tiles in the 2×4 footprint must be free, non-lobby, non-blocked. |
| **Variant** | `ROULETTE` or `CRAPS` — chosen at placement. Cosmetic only. No mechanical difference. |
| **Special Notes** | Highest capacity and rating contribution per object. More expensive than small table but strong mid-to-late game investment. |

---

### WC

| Field | Value |
|---|---|
| **ID** | `wc` |
| **Display Name** | WC |
| **Category** | Amenity |
| **Size** | 3 × 1 (wall-snapped, extends 1 tile inward) |
| **Wall Object** | Yes |
| **Cost** | 1,200 |
| **Demolish Refund** | 600 |
| **Instance Limit** | Unlimited |
| **Capacity Contribution** | None |
| **Rating Contribution** | +0.20 per unit |
| **Revenue Behavior** | None. Passive rating modifier only. |
| **Rotation** | Auto-determined by wall edge. No player rotation input needed. |
| **Placement Rules** | Must be placed against a valid interior `WALL` tile on the casino area perimeter. Lobby walls are not valid. All 3 tiles of the footprint (projecting inward) must be free `FLOOR` tiles. |
| **Door Tile** | Middle tile of the 3 (tile index 1). Visual only — no pathfinding or guest usage in MVP. |
| **Variant** | None |
| **Special Notes** | Treat as a static rating modifier — identical in behaviour to a decoration. No guest interaction logic required. Strong early-game rating boost per cost. |

---

### BAR

| Field | Value |
|---|---|
| **ID** | `bar` |
| **Display Name** | Bar |
| **Category** | Amenity |
| **Size** | 8 × 1 (wall-snapped, extends 1 tile inward) |
| **Wall Object** | Yes |
| **Cost** | 6,500 |
| **Demolish Refund** | 3,250 |
| **Instance Limit** | **1 (hard limit)** |
| **Capacity Contribution** | None |
| **Rating Contribution** | +0.35 flat (once, regardless of count — but count is always 0 or 1) |
| **Revenue Behavior** | None. Passive rating modifier only. |
| **Rotation** | Auto-determined by wall edge. No player rotation input needed. |
| **Placement Rules** | Must be placed against a valid interior `WALL` tile on the casino area perimeter. Lobby walls are not valid. All 8 tiles of the footprint (projecting inward) must be free `FLOOR` tiles. Requires a minimum continuous wall run of 8 tiles. Only placeable if `barExists == false`. |
| **Door Tiles** | Tiles at index 3 and 4 (the two centre tiles). Visual only — no pathfinding or usage in MVP. |
| **Variant** | None |
| **Special Notes** | The build menu entry for Bar must be greyed out and unselectable when `barExists == true`. Demolishing the bar resets `barExists` to `false`, re-enabling placement. This is the most expensive single object in the MVP and serves as goal #10. |

---

## Fixed Map Objects

These objects are placed at map initialisation and cannot be moved, demolished, or interacted with in MVP. They occupy `BLOCKED` or `LOBBY` tiles and are never assigned to `PlacedObject[]`.

---

### LOBBY

| Field | Value |
|---|---|
| **ID** | `lobby` |
| **Display Name** | Lobby |
| **Category** | Fixed — Structure |
| **Size** | 6 × 24 (full map height, centred horizontally at columns 15–20) |
| **Tile Type** | `LOBBY` |
| **Buildable** | No |
| **Interactable** | No |
| **Function** | Central corridor connecting the entrance to hotel reception, elevators, and both casino areas. Guests enter and exit through this strip. |
| **Placement** | Columns 15–20 inclusive across all 24 rows. Set at map init. Never changes. |
| **Special Notes** | Acts as a visual and logical separator between the west (cols 0–14) and east (cols 21–35) casino areas. No gameplay logic is attached to lobby tiles directly — they are simply non-buildable passthrough space. |

---

### HOTEL_RECEPTION

| Field | Value |
|---|---|
| **ID** | `hotel_reception` |
| **Display Name** | Hotel Reception |
| **Category** | Fixed — Hotel |
| **Size** | 3 × 2 |
| **Tile Type** | `BLOCKED` |
| **Buildable** | No |
| **Interactable** | Yes — tapping opens the Hotel Panel UI |
| **Function** | Visual anchor for the hotel system on the map. Tapping it opens the hotel upgrade panel. No mechanical effect from the object itself — the hotel system is driven entirely by `HotelState`. |
| **Placement** | Pre-placed in the lobby strip (exact position defined during map design). Centred within the lobby, towards the top half of the map. |
| **Special Notes** | This is the only fixed object with a UI interaction. The tap target should be clearly visually distinct from surrounding floor tiles. In MVP, it does not need an animation or state indicator. |

---

### ELEVATOR

| Field | Value |
|---|---|
| **ID** | `elevator` |
| **Display Name** | Elevator |
| **Category** | Fixed — Hotel |
| **Size** | 2 × 1 per unit |
| **Tile Type** | `BLOCKED` |
| **Buildable** | No |
| **Interactable** | No |
| **Instance Count** | 2 (one on each side wall of the lobby) |
| **Function** | Visual representation of hotel floor access. No mechanical effect in MVP. Present to indicate that the hotel floors exist above the casino floor. |
| **Placement** | Pre-placed on the left and right walls of the lobby strip, one on each side, at matching row positions. |
| **Special Notes** | Not interactive in MVP. Do not attach any logic, tooltip, or tap handler. Purely decorative. Can be upgraded or made interactive in a post-MVP update without structural changes. |

---

### ENTRANCE

| Field | Value |
|---|---|
| **ID** | `entrance` |
| **Display Name** | Entrance |
| **Category** | Fixed — Structure |
| **Size** | 4 × 1 |
| **Tile Type** | `BLOCKED` |
| **Buildable** | No |
| **Interactable** | No |
| **Function** | Visual entry point for guests arriving at the resort. Walk-in guests are spawned from or near this point for visual purposes. Has no mechanical effect on guest count — guest generation is purely formula-driven. |
| **Placement** | Pre-placed at the bottom edge of the lobby strip, centred on the lobby width (columns 16–19, row 23). |
| **Special Notes** | Guest spawn animations (if any) should originate here. In MVP, if no guest walking animation exists, this object is purely decorative. |

---

## Quick Reference Table

| ID | Name | Size | Category | Cost | Capacity | Rating | Limit | Wall |
|---|---|---|---|---|---|---|---|---|
| `slot_machine` | Slot Machine | 1×1 | Casino Floor | 750 | +1 | +0.02 | ∞ | No |
| `small_table` | Small Table | 2×3 | Casino Floor | 2,500 | +4 | +0.18 | ∞ | No |
| `large_table` | Large Table | 2×4 | Casino Floor | 4,500 | +6 | +0.25 | ∞ | No |
| `wc` | WC | 3×1 | Amenity | 1,200 | — | +0.20 | ∞ | Yes |
| `bar` | Bar | 8×1 | Amenity | 6,500 | — | +0.35 | **1** | Yes |
| `lobby` | Lobby | 6×24 | Fixed | — | — | — | 1 | — |
| `hotel_reception` | Hotel Reception | 3×2 | Fixed | — | — | — | 1 | — |
| `elevator` | Elevator | 2×1 | Fixed | — | — | — | 2 | — |
| `entrance` | Entrance | 4×1 | Fixed | — | — | — | 1 | — |

---

*Object definitions version: MVP 1.1 — matches ruleset MVP 1.1 and data model MVP 1.1.*
