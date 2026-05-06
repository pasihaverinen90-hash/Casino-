// GuestSprites.ts — visible guest presentation layer.
//
// Strict scope: this is *not* the source of truth for the economy. It is a
// scaled-down visual layer driven by aggregate state. Guests spawn at the
// lobby, walk to a usage-weighted attraction's seat / interaction tile,
// idle while "using" it, visit a few more attractions, then return to the
// lobby and despawn.
//
// P3B: movement is grid-aware. Each guest carries a tile-centre route from
// its current tile to the target interaction tile, computed by BFS over
// walkable tiles (see GuestRouter). Guests step orthogonally between tile
// centres, so the floor reads like real navigation rather than a straight
// drift toward the goal. If the path is broken mid-walk by a placement,
// the guest reroutes; if rerouting fails, the existing stuck-recovery
// cascade (clip → repick → exit → despawn) still applies.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';
import * as OV from '../logic/OperationalValidator';
import * as PV from '../logic/PlacementValidator';
import { gameState } from '../state/GameState';
import { findRoute } from './GuestRouter';

type GuestState = 'to_target' | 'idle' | 'to_exit';

interface Guest {
  // Float tile coordinates so pan/zoom auto-reposition without recomputing.
  // Whole+0.5 conventionally lands on a tile centre.
  col   : number;
  row   : number;
  // Tile-coordinate target (centre of an interaction tile).
  tCol  : number;
  tRow  : number;
  // Lobby spawn — guest returns here before despawning.
  exitCol: number;
  exitRow: number;
  state : GuestState;
  // Remaining idle seconds (game-time) while using an attraction.
  idle  : number;
  // Type of attraction the guest is currently heading to / using. Drives
  // dwell time so a roulette wheel keeps a guest longer than a slot.
  curKind: GC.ObjType | null;
  // How many additional attractions to visit after the current one
  // before heading for the exit. 0 means "exit after this idle".
  visitsLeft: number;
  // Game-seconds spent unable to advance toward the target. After a
  // grace window we let the guest pass through obstacles so they
  // never get permanently pinned by a layout change.
  stuck : number;
  // Subtle per-guest body tint variation so the crowd doesn't look uniform.
  tint  : number;
  // Skin tone for the head — small per-guest variation around a base.
  headTint: number;
  // Last movement direction (unit vector). Drives a tiny head-lean cue so
  // walking guests visibly face where they're going.
  dirX  : number;
  dirY  : number;
  // Walk-bob phase, advanced only while the guest is actually moving.
  // Initial value is randomised so the crowd doesn't bob in lockstep.
  phase : number;
  // Remaining tile-centre waypoints toward the current target. Front of
  // the array is the next waypoint to reach. Empty either right after a
  // target change (will be filled by the next _stepGuest call) or when
  // BFS has failed to find a path — the stuck cascade then takes over.
  route : GC.Vec2[];
}

// Visible-crowd sizing. The ratio scales the aggregate guests/day down to
// an on-screen population; the floor felt empty at 0.10, so we use a third
// of demand. MIN keeps the floor from looking deserted while a few
// attractions are running, MAX caps draw + state cost at busy times.
// Effective formula: clamp(round(totalGuests / 3), MIN, MAX).
const MIN_VISIBLE        = 10;
const MAX_VISIBLE        = 36;
const VISIBLE_PER_GUEST  = 1 / 3;
// Calmer casual-walk pace. Previously 2.5 (≈ particle-fast). At 1× speed
// (1 real-sec = 1 game-sec) this is one tile per real second, which reads
// as a person strolling rather than darting around. Speed scaling via
// dtGame in update() still cleanly multiplies this by 0/1/2/4×.
const WALK_TILES_PER_SEC = 1.0;
// Walk-bob frequency in radians/sec (game time). ~1.27 Hz feels like a
// gentle stride when paired with WALK_TILES_PER_SEC.
const BOB_RATE_RAD       = 8.0;
// Stuck-recovery escalation. A guest in `to_target` walks the tiers in
// order; each tier resets `stuck` so the next gets a clean window. The
// outer despawn tier protects against everything else by teleporting the
// guest onto its exit so the per-tick despawn check removes it.
//   T1 — clip-beeline straight to the target through obstacles.
//   T2 — re-pick a target (current attraction may have just been demolished).
//   T3 — give up on attractions and head for the exit.
//   T4 — last resort: snap to the exit so we can never have a permanently
//        inert guest visible on the floor.
const STUCK_BYPASS_SEC   = 1.2;
const STUCK_REPICK_SEC   = 4.0;
const STUCK_EXIT_SEC     = 8.0;
const STUCK_DESPAWN_SEC  = 12.0;

// Per-attraction dwell range, in game-seconds. At 1× speed 1 game-second
// equals 1 real second, and 1 in-game hour spans 4 real seconds, so the
// numbers below map roughly to:
//   slot       1–2 in-game hours
//   small      1.5–3 in-game hours
//   large      2–4 in-game hours
//   cashier    0.5–1 in-game hours
const DWELL_RANGES: Partial<Record<GC.ObjType, [number, number]>> = {
  [GC.ObjType.SLOT_MACHINE]: [4,  8],
  [GC.ObjType.SMALL_TABLE]:  [6, 12],
  [GC.ObjType.LARGE_TABLE]:  [8, 16],
  [GC.ObjType.CASHIER]:      [2,  4],
};
const DWELL_FALLBACK: [number, number] = [3, 6];

export class GuestSprites {
  private gfx: Phaser.GameObjects.Graphics;
  private guests: Guest[] = [];

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(3);
  }

  // Called every frame by GridScene.update.
  update(dtMs: number, speed: number, baseX: number, baseY: number, tileSize: number): void {
    // Step movement only when time is running. Drawing always happens so
    // pan/zoom keep them positioned even while paused.
    if (speed > 0 && dtMs > 0) {
      const dtGame = (dtMs / 1000) * speed;
      this._stepLogic(dtGame);
    }
    this._draw(baseX, baseY, tileSize);
  }

  // ── Population & state machine ────────────────────────────────────────────

  private _stepLogic(dtGame: number): void {
    // Population target — scaled-down representation of total demand.
    const scaled = Math.round(gameState.totalGuests * VISIBLE_PER_GUEST);
    const target = Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, scaled));
    while (this.guests.length < target) {
      const g = this._spawn();
      if (!g) break; // no functional attractions yet
      this.guests.push(g);
    }
    // Don't hard-cull when over-target — let them walk out naturally so the
    // crowd thins gracefully when state changes.

    // Step each guest.
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      this._stepGuest(g, dtGame);
      if (g.state === 'to_exit' && this._near(g, g.tCol, g.tRow)) {
        this.guests.splice(i, 1);
      }
    }
  }

  private _stepGuest(g: Guest, dt: number): void {
    if (g.state === 'idle') {
      g.idle -= dt;
      if (g.idle <= 0) this._chooseNextLeg(g);
      return;
    }

    // Recovery escalation, checked before movement so a fully blocked
    // target can't pin the guest indefinitely.
    if (g.stuck >= STUCK_DESPAWN_SEC) {
      // T4: snap to exit; the per-tick despawn check then removes us.
      g.col   = g.exitCol; g.row = g.exitRow;
      g.tCol  = g.exitCol; g.tRow = g.exitRow;
      g.state = 'to_exit';
      g.route = [];
      return;
    }
    if (g.state === 'to_target' && g.stuck >= STUCK_EXIT_SEC) {
      // T3: give up on attractions, head for the exit.
      g.state   = 'to_exit';
      g.tCol    = g.exitCol;
      g.tRow    = g.exitRow;
      g.curKind = null;
      g.route   = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
      g.stuck   = 0;
      return;
    }
    if (g.state === 'to_target' && g.stuck >= STUCK_REPICK_SEC) {
      // T2: try a different attraction first — the current target tile may
      // have been demolished, blocked, or just had its open-floor approach
      // built over. Falling back to exit is fine if no attractions remain.
      const alt = this._pickInteractionTile();
      if (alt) {
        g.tCol    = alt.tile.x + 0.5;
        g.tRow    = alt.tile.y + 0.5;
        g.curKind = alt.kind;
      } else {
        g.state   = 'to_exit';
        g.tCol    = g.exitCol;
        g.tRow    = g.exitRow;
        g.curKind = null;
      }
      g.route = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
      g.stuck = 0;
      return;
    }

    const allowClip = g.stuck >= STUCK_BYPASS_SEC;
    const step      = WALK_TILES_PER_SEC * dt;

    // Pick a destination for this step. Prefer the next route waypoint;
    // if the route is empty, try BFS once more in case the world cleared;
    // if BFS still fails and we're past the bypass window, beeline to the
    // target through obstacles so a temporary block can't freeze us mid-floor.
    let destX: number;
    let destY: number;
    let onRoute = g.route.length > 0;
    if (!onRoute) {
      g.route = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
      onRoute = g.route.length > 0;
    }
    if (onRoute) {
      destX = g.route[0].x;
      destY = g.route[0].y;
    } else if (allowClip) {
      destX = g.tCol;
      destY = g.tRow;
    } else {
      g.stuck += dt;
      return;
    }

    const dx   = destX - g.col;
    const dy   = destY - g.row;
    const dist = Math.hypot(dx, dy);

    if (dist <= step) {
      // Reach this waypoint. Snap, consume it, and let next frame pick up
      // the following one (or trigger arrival if this was the target).
      if (dist > 1e-4) { g.dirX = dx / dist; g.dirY = dy / dist; }
      g.col = destX;
      g.row = destY;
      if (onRoute) g.route.shift();
      g.stuck = 0;
      if (g.route.length === 0 && this._near(g, g.tCol, g.tRow)) this._onArrive(g);
      return;
    }

    // If the next route waypoint just became unwalkable (placed over
    // mid-walk), reroute now. Skip in clip mode where we already accept
    // crossing obstacles.
    if (onRoute && !allowClip) {
      const tCol = Math.floor(destX);
      const tRow = Math.floor(destY);
      if (!PV.isWalkable(gameState.tiles, tCol, tRow)) {
        const nr = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow);
        if (nr && nr.length > 0) {
          g.route = nr;
        } else {
          g.stuck += dt;
        }
        return;
      }
    }

    const ux = dx / dist;
    const uy = dy / dist;
    g.col += ux * step;
    g.row += uy * step;
    g.dirX = ux;
    g.dirY = uy;
    g.phase += dt * BOB_RATE_RAD;
    g.stuck = 0;
  }

  // Decide what to do after an idle has finished: visit another attraction
  // or head for the exit. Falling back to exit when no targets are left
  // ensures the crowd doesn't pile up at one attraction.
  private _chooseNextLeg(g: Guest): void {
    if (g.visitsLeft > 0) {
      const next = this._pickInteractionTile();
      if (next) {
        g.tCol    = next.tile.x + 0.5;
        g.tRow    = next.tile.y + 0.5;
        g.curKind = next.kind;
        g.state   = 'to_target';
        g.visitsLeft--;
        g.route   = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
        g.stuck   = 0;
        return;
      }
    }
    g.state   = 'to_exit';
    g.tCol    = g.exitCol;
    g.tRow    = g.exitRow;
    g.curKind = null;
    g.route   = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
    g.stuck   = 0;
  }

  private _onArrive(g: Guest): void {
    if (g.state === 'to_target') {
      g.state = 'idle';
      g.idle  = this._dwellFor(g.curKind);
    }
    // 'to_exit' arrival is handled by the despawn check in _stepLogic.
  }

  private _dwellFor(kind: GC.ObjType | null): number {
    const range = (kind != null && DWELL_RANGES[kind]) || DWELL_FALLBACK;
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  private _near(g: Guest, c: number, r: number): boolean {
    return Math.hypot(g.col - c, g.row - r) < 0.05;
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  private _spawn(): Guest | null {
    const target = this._pickInteractionTile();
    if (!target) return null;
    const exit = this._lobbySpawn();
    const tCol = target.tile.x + 0.5;
    const tRow = target.tile.y + 0.5;
    // Slight per-guest skin-tone variation around a warm base tone — keeps
    // heads recognisable while breaking up uniform crowds. ±0x18 per channel.
    const headJitter = (Math.floor(Math.random() * 7) - 3) * 0x080808;
    return {
      col   : exit.col,
      row   : exit.row,
      tCol,
      tRow,
      exitCol: exit.col,
      exitRow: exit.row,
      state : 'to_target',
      idle  : 0,
      curKind: target.kind,
      // 2..4 additional visits after the first → total 3..5 attractions per
      // guest. Matches the design target for floor activity.
      visitsLeft: 2 + Math.floor(Math.random() * 3),
      stuck : 0,
      tint  : 0xffe28a + Math.floor(Math.random() * 0x40) * 0x010101,
      headTint: 0xead0a8 + headJitter,
      // Default facing north, away from the lobby (south of the floor).
      dirX  : 0,
      dirY  : -1,
      // Random initial phase so the crowd's bobs don't synchronise.
      phase : Math.random() * Math.PI * 2,
      route : findRoute(gameState.tiles, exit.col, exit.row, tCol, tRow) ?? [],
    };
  }

  // Random lobby tile centre so multiple spawns don't stack on one point.
  // Lobby occupies cols LOBBY_START_COL..LOBBY_END_COL × rows 19..22.
  private _lobbySpawn(): { col: number; row: number } {
    const c = GC.LOBBY_START_COL + Math.floor(Math.random() * (GC.LOBBY_END_COL - GC.LOBBY_START_COL + 1));
    const r = 19 + Math.floor(Math.random() * 4);
    return { col: c + 0.5, row: r + 0.5 };
  }

  // Usage-weighted attraction picker → an interaction tile (seat / use
  // position) for the chosen attraction. Returns the tile and the kind so
  // the caller can pick a type-appropriate dwell duration.
  //   slot     weight = funcSlot  × 1
  //   small    weight = funcSmall × 4   (matches table capacity weight)
  //   large    weight = funcLarge × 6   (matches large-table capacity weight)
  //   cashier  weight = funcCashier × 2 (smaller but regular share)
  private _pickInteractionTile(): { tile: GC.Vec2; kind: GC.ObjType } | null {
    const wSlot    = gameState.funcSlot;
    const wSmall   = gameState.funcSmall   * 4;
    const wLarge   = gameState.funcLarge   * 6;
    const wCashier = gameState.funcCashier * 2;
    const total = wSlot + wSmall + wLarge + wCashier;
    if (total <= 0) return null;
    let r = Math.random() * total;
    let kind: GC.ObjType;
    if      ((r -= wSlot)    < 0) kind = GC.ObjType.SLOT_MACHINE;
    else if ((r -= wSmall)   < 0) kind = GC.ObjType.SMALL_TABLE;
    else if ((r -= wLarge)   < 0) kind = GC.ObjType.LARGE_TABLE;
    else                          kind = GC.ObjType.CASHIER;

    const candidates = gameState.placedObjs.filter(
      o => o.type === kind && gameState.functionalIds.has(o.id),
    );
    if (candidates.length === 0) return null;

    // Try candidates in random order until one yields at least one
    // interaction tile. Functional objects almost always have one; the
    // loop only matters in edge cases where adjacency just changed.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const obj of candidates) {
      const slots = OV.getInteractionTiles(obj, gameState.tiles);
      if (slots.length === 0) continue;
      const slot = slots[Math.floor(Math.random() * slots.length)];
      return { tile: slot, kind };
    }
    return null;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private _draw(baseX: number, baseY: number, ts: number): void {
    const g = this.gfx;
    g.clear();
    if (this.guests.length === 0 || ts < 8) return;

    // Per-tile-size proportions. All values floor at small minimums so
    // guests stay legible at the smallest zoom levels.
    const headR = Math.max(2, ts * 0.16);
    const bodyW = Math.max(3, Math.round(ts * 0.36));
    const bodyH = Math.max(3, Math.round(ts * 0.32));
    const bobAmp = Math.max(0.5, ts * 0.06);
    const lean   = Math.max(0.6, ts * 0.07);

    for (const guest of this.guests) {
      const x = baseX + guest.col * ts;
      const y = baseY + guest.row * ts;
      const moving = guest.state !== 'idle';
      const bob    = moving ? Math.sin(guest.phase) * bobAmp : 0;

      // Soft elongated shadow under the feet — gives the guest weight on
      // the floor and helps them read against the carpet/lobby tones.
      g.fillStyle(0x000000, 0.32);
      g.fillEllipse(x, y + bodyH * 0.45, bodyW * 1.05, Math.max(2, bodyH * 0.45));

      // Torso — rounded-rect "shoulders" silhouette in the guest's tint.
      // Bobs by a fraction of the head bob so the body weight feels grounded.
      const torsoX = x - bodyW / 2;
      const torsoY = y - bodyH * 0.18 + bob * 0.35;
      g.fillStyle(guest.tint, 1);
      g.fillRoundedRect(torsoX, torsoY, bodyW, bodyH, Math.max(1, bodyW * 0.42));

      // Head — leans toward the direction of travel so even a tiny dot
      // sells "this person is heading that way".
      const hx = x + guest.dirX * lean;
      const hy = y - bodyH * 0.45 + bob;
      g.fillStyle(guest.headTint, 1);
      g.fillCircle(hx, hy, headR);

      // Catch-light dot on the upper-left of the head — pure procedural,
      // but it gives the head a subtle 3D feel without any asset cost.
      g.fillStyle(0xffffff, 0.30);
      g.fillCircle(hx - headR * 0.3, hy - headR * 0.35, Math.max(1, headR * 0.35));
    }
  }
}
