// GuestVisualControllerV2.ts — visual guest layer for Presentation V2.
//
// Owns the on-screen population + state machine: spawn at lobby → walk
// to a functional attraction's interaction tile via GuestRouter →
// idle / dwell → maybe visit more → leave to lobby. All state lives
// here; gameState is read-only. No revenue, rating, goals, saves, or
// reservations on gameState are touched.
import * as GC from '../../logic/GameConstants';
import * as OV from '../../logic/OperationalValidator';
import * as PV from '../../logic/PlacementValidator';
import { findRoute } from '../../game/GuestRouter';
import { gameState } from '../../state/GameState';
import { time } from '../../state/TimeController';

export interface GuestVisualV2 {
  id          : string;
  // Tile-coordinate position (fractional). 0.5 conventionally lands a
  // guest on a tile centre.
  col         : number;
  row         : number;
  // Unit vector of last movement direction (in tile space). The
  // renderer projects this to screen for the head-lean offset.
  dirX        : number;
  dirY        : number;
  tint        : number;
  headTint    : number;
  // Walk-bob phase, advanced only while moving — keeps a paused
  // crowd visually still.
  phase       : number;
  state       : 'walking' | 'idle' | 'leaving' | 'service';
  targetObjId?: string;
  // V2 visual-only: when true the renderer skips this guest. Set during
  // the 'inside' phase of WC/Bar/Buffet service usage so the guest
  // appears to disappear into the facade. Position is unchanged while
  // hidden; the guest reappears at its visible-use anchor on exit.
  hidden?     : boolean;
}

interface InternalGuest extends GuestVisualV2 {
  // Tile-centre target (the interaction tile of the current attraction
  // or the lobby exit). Stored as fractional tile coords so the move
  // logic snaps to centres.
  tCol        : number;
  tRow        : number;
  exitCol     : number;
  exitRow     : number;
  // Remaining idle seconds (game-time) while "using" an attraction.
  idleSec     : number;
  curKind     : GC.ObjType | null;
  // How many additional attractions to visit after the current one.
  visitsLeft  : number;
  // Game-seconds without progress toward the target — drives the
  // repick/exit recovery cascade so a guest never gets pinned.
  stuck       : number;
  // Remaining waypoints toward the current target. Front of the
  // array is the next waypoint.
  route       : GC.Vec2[];
  // Reservation key for the interaction tile the guest is targeting,
  // so two V2 guests don't aim at the same chair. Cleared when the
  // guest re-picks or leaves.
  reservedKey : string | null;

  // ── Wall-service visual sub-phase ──────────────────────────────────────
  // Driven entirely by the controller; renderer reads only `hidden`.
  //   'none'     — not currently using a wall service.
  //   'entering' — linearly moving from the interaction tile centre
  //                toward visibleUseAnchor (closer to the facade).
  //   'inside'   — dwell timer counting down. hidden=true for WC/Bar/
  //                Buffet so the guest appears to have entered the
  //                facade; hidden=false for ATM/Cashier/Sportsbook
  //                (visible standing-at-counter dwell).
  //   'exiting'  — linearly moving from visibleUseAnchor back to the
  //                interaction tile centre, then _chooseNextLeg.
  servicePhase       : 'none' | 'entering' | 'inside' | 'exiting';
  // Position the guest stands at while visible during service use —
  // biased toward the wall facade (north-of-tile for N wall, west-of-
  // tile for W wall). Null when not in service flow.
  visibleUseAnchor   : { col: number; row: number } | null;
  // Where the guest returns to before leaving service (the original
  // route-end interaction tile centre). Routing resumes from here.
  interactionAnchor  : { col: number; row: number } | null;
  // Game-seconds remaining for the current servicePhase. Used during
  // 'inside' to time the dwell; entering / exiting use distance-based
  // termination instead.
  phaseTimer         : number;
}

// Visible-crowd sizing — caps at 36 so even a packed casino renders
// smoothly on a single Graphics layer.
const MIN_VISIBLE        = 4;
const MAX_VISIBLE        = 36;
const VISIBLE_PER_GUEST  = 0.25;
const SPAWN_INTERVAL_SEC = 1.0;
const WALK_TILES_PER_SEC = 1.0;
const BOB_RATE_RAD       = 8.0;

// Stuck-recovery cascade (game-seconds). Two tiers — the layer is
// visual-only, so cheaper than a full simulation pathing recovery.
const STUCK_REPICK_SEC  = 4.0;
const STUCK_EXIT_SEC    = 8.0;

const DWELL_FALLBACK: [number, number] = [3, 6];

// Distance (in tile units) at which a guest "arrives" at a target.
const ARRIVE_EPSILON = 0.05;

// ── Visual target weights ────────────────────────────────────────────────
// ObjDef.targetWeight is the simulation/economy weight — it sets WC
// and BAR to 0 because the economy doesn't want guests queueing for
// them. This layer is purely visual, so we want guests to occasionally
// walk to every functional service (including WC and BAR) for visual
// life. Local table owned by this file; gameplay-side ObjDef is
// unchanged.
//
// Adjust here if a service feels over- or under-used. Missing entries
// default to 0 (never selected) — added safety for future ObjTypes.
const V2_VISUAL_WEIGHTS: { readonly [K in GC.ObjType]: number } = {
  [GC.ObjType.SLOT_MACHINE]      : 4,
  [GC.ObjType.SMALL_TABLE]       : 4,
  [GC.ObjType.LARGE_TABLE]       : 4,
  [GC.ObjType.KENO_LOUNGE]       : 3,
  [GC.ObjType.HIGH_STAKES_TABLE] : 3,
  [GC.ObjType.WC]                : 2,
  [GC.ObjType.BAR]               : 3,
  [GC.ObjType.BUFFET]            : 3,
  [GC.ObjType.CASHIER]           : 1,
  [GC.ObjType.ATM]               : 1,
  [GC.ObjType.SPORTSBOOK]        : 2,
};

// File-local debug flag. Set to true while diagnosing target selection
// to log selections and skip reasons. Keep false on commits — produces
// no console output when off.
const DEBUG_GUEST_TARGETS = false;

// const enum can't be reverse-indexed at runtime, so name the types
// manually for the debug log only. Off by default; tree-shaken out
// of the production bundle when DEBUG_GUEST_TARGETS is false.
function _typeName(t: GC.ObjType): string {
  switch (t) {
    case GC.ObjType.SLOT_MACHINE:      return 'SLOT_MACHINE';
    case GC.ObjType.SMALL_TABLE:       return 'SMALL_TABLE';
    case GC.ObjType.LARGE_TABLE:       return 'LARGE_TABLE';
    case GC.ObjType.WC:                return 'WC';
    case GC.ObjType.BAR:               return 'BAR';
    case GC.ObjType.CASHIER:           return 'CASHIER';
    case GC.ObjType.ATM:               return 'ATM';
    case GC.ObjType.BUFFET:            return 'BUFFET';
    case GC.ObjType.SPORTSBOOK:        return 'SPORTSBOOK';
    case GC.ObjType.KENO_LOUNGE:       return 'KENO_LOUNGE';
    case GC.ObjType.HIGH_STAKES_TABLE: return 'HIGH_STAKES_TABLE';
  }
}

// ── Wall-service visual tuning ────────────────────────────────────────────
// Tiles biased toward the wall when a guest stands at a wall service. The
// guest still routes to the same interaction tile (logical, unchanged) —
// the visual position is offset from the tile centre. Bias is fractional
// tile units; 0.35 puts the guest just inside the north / west edge of
// the interaction tile, in front of the painted facade.
const WALL_SERVICE_BIAS = 0.35;

// Set of wall services that hide guests during the inside dwell (the
// guest visually enters and disappears). Other wall services (ATM,
// Cashier, Sportsbook) stay visible at the wall-biased anchor.
function _isHidingService(type: GC.ObjType): boolean {
  return type === GC.ObjType.WC
      || type === GC.ObjType.BAR
      || type === GC.ObjType.BUFFET;
}

export class GuestVisualControllerV2 {
  private guests        : InternalGuest[] = [];
  private spawnCooldown = 0;
  private reservedTiles = new Set<string>();
  private _nextId       = 0;

  // Called every frame from PresentationSceneV2.update. dtMs is real
  // milliseconds; we scale by the current game speed so paused = freeze
  // and 4× = guests walk 4× faster.
  update(dtMs: number): void {
    if (dtMs <= 0) return;
    const speed = time.speed;
    if (speed <= 0) return;
    const dtGame = (dtMs / 1000) * speed;

    // Population target — scaled to total demand and clamped.
    const scaled = Math.round(gameState.totalGuests * VISIBLE_PER_GUEST);
    const target = Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, scaled));

    if (this.spawnCooldown > 0) this.spawnCooldown -= dtGame;
    if (this.guests.length < target && this.spawnCooldown <= 0) {
      const g = this._spawn();
      if (g) {
        this.guests.push(g);
        this.spawnCooldown = SPAWN_INTERVAL_SEC;
      }
      // If _spawn returned null (no functional attractions yet), leave
      // the cooldown at zero so we retry next tick.
    }

    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      this._stepGuest(g, dtGame);
      if (g.state === 'leaving' && this._near(g, g.tCol, g.tRow)) {
        this._releaseReservation(g);
        this.guests.splice(i, 1);
      }
    }
  }

  // Called by the scene on gameState 'state_changed'. Drops any
  // walking-guest's target if the target object disappeared or stopped
  // being functional; the guest then re-picks on its next step.
  refreshTargets(): void {
    for (const g of this.guests) {
      if (g.state === 'leaving') continue;
      if (g.targetObjId == null) continue;
      const obj = gameState.placedObjs.find(o => o.id === g.targetObjId);
      const ok  = obj != null && gameState.functionalIds.has(obj.id);
      if (!ok) {
        // Demolished or just became inert — force a re-pick on next tick.
        this._releaseReservation(g);
        g.targetObjId = undefined;
        g.curKind     = null;
        // If the guest was mid-service, snap back to a visible position
        // and clear the service flow so they don't stay hidden forever.
        if (g.state === 'service') {
          const v = g.visibleUseAnchor;
          if (v) {
            g.col = v.col;
            g.row = v.row;
          }
          g.servicePhase      = 'none';
          g.visibleUseAnchor  = null;
          g.interactionAnchor = null;
          g.hidden            = false;
        }
        // Lift the guest off the now-removed target tile and head for
        // a fresh leg next frame.
        g.state = 'idle';
        g.idleSec = 0;
      }
    }
  }

  getGuests(): readonly GuestVisualV2[] {
    return this.guests;
  }

  destroy(): void {
    this.guests = [];
    this.reservedTiles.clear();
  }

  // Visual-only displacement: when a V2 placement is about to commit,
  // any guest standing on a soon-to-be-blocked tile is gently moved
  // to a nearby walkable tile and forced to re-pick a target. Never
  // mutates gameState — this only nudges the controller's own guests.
  //
  // Always succeeds (best-effort) — if no safe tile is found within
  // a small BFS radius, the guest is sent to the lobby exit so it
  // visibly leaves. Placement is never blocked by guests.
  displaceGuestsFromTiles(blocked: readonly GC.Vec2[]): void {
    if (blocked.length === 0) return;
    const keys = new Set<string>();
    for (const t of blocked) keys.add(this._tileKey(t.x, t.y));

    for (const g of this.guests) {
      const gc = Math.floor(g.col);
      const gr = Math.floor(g.row);
      if (!keys.has(this._tileKey(gc, gr))) continue;
      // Snap to a nearby safe tile if possible, otherwise force-leave.
      const safe = this._findSafeTileNear(gc, gr, keys);
      if (safe) {
        g.col   = safe.x + 0.5;
        g.row   = safe.y + 0.5;
        g.route = [];
        g.stuck = 0;
        this._releaseReservation(g);
        // Also break any in-progress service flow so a guest hidden
        // inside a wall service that's about to be replaced reappears.
        g.servicePhase      = 'none';
        g.visibleUseAnchor  = null;
        g.interactionAnchor = null;
        g.hidden            = false;
        this._chooseNextLeg(g);
      } else {
        this._releaseReservation(g);
        g.state             = 'leaving';
        g.tCol              = g.exitCol;
        g.tRow              = g.exitRow;
        g.curKind           = null;
        g.targetObjId       = undefined;
        g.servicePhase      = 'none';
        g.visibleUseAnchor  = null;
        g.interactionAnchor = null;
        g.hidden            = false;
        g.route = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
        g.stuck = 0;
      }
    }
  }

  // Small BFS outward from (sc, sr) to find an unblocked walkable
  // tile. Excludes `blocked` (the upcoming placement footprint) and
  // anything PV.isWalkable rejects.
  private _findSafeTileNear(
    sc: number, sr: number, blocked: Set<string>,
  ): GC.Vec2 | null {
    const visited = new Set<string>();
    visited.add(this._tileKey(sc, sr));
    const queue: GC.Vec2[] = [{ x: sc, y: sr }];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur.x !== sc || cur.y !== sr) {
        const k = this._tileKey(cur.x, cur.y);
        if (!blocked.has(k) && PV.isWalkable(gameState.tiles, cur.x, cur.y)) {
          return cur;
        }
      }
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || nx >= GC.GRID_COLS || ny < 0 || ny >= GC.GRID_ROWS) continue;
        const k = this._tileKey(nx, ny);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // ── Reservations ──────────────────────────────────────────────────────────

  private _tileKey(x: number, y: number): string {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  private _reserve(g: InternalGuest, key: string): void {
    this.reservedTiles.add(key);
    g.reservedKey = key;
  }

  private _releaseReservation(g: InternalGuest): void {
    if (g.reservedKey == null) return;
    this.reservedTiles.delete(g.reservedKey);
    g.reservedKey = null;
  }

  // ── Spawn / pick ──────────────────────────────────────────────────────────

  private _spawn(): InternalGuest | null {
    const target = this._pickInteractionTile();
    if (!target) return null;
    const exit = this._lobbySpawn();
    const tCol = target.tile.x + 0.5;
    const tRow = target.tile.y + 0.5;
    const key  = this._tileKey(target.tile.x, target.tile.y);
    this.reservedTiles.add(key);
    const headJitter = (Math.floor(Math.random() * 7) - 3) * 0x080808;
    return {
      id          : `v2g_${this._nextId++}`,
      col         : exit.col,
      row         : exit.row,
      dirX        : 0,
      dirY        : -1,
      tint        : 0xffe28a + Math.floor(Math.random() * 0x40) * 0x010101,
      headTint    : 0xead0a8 + headJitter,
      phase       : Math.random() * Math.PI * 2,
      state       : 'walking',
      targetObjId : target.obj.id,
      tCol, tRow,
      exitCol     : exit.col,
      exitRow     : exit.row,
      idleSec     : 0,
      curKind     : target.obj.type,
      // Total of 3..5 attractions per guest.
      visitsLeft  : 2 + Math.floor(Math.random() * 3),
      stuck       : 0,
      route       : findRoute(gameState.tiles, exit.col, exit.row, tCol, tRow) ?? [],
      reservedKey : key,
      servicePhase      : 'none',
      visibleUseAnchor  : null,
      interactionAnchor : null,
      phaseTimer        : 0,
      hidden            : false,
    };
  }

  // Random lobby tile centre.
  private _lobbySpawn(): { col: number; row: number } {
    const span = GC.LOBBY_END_COL - GC.LOBBY_START_COL + 1;
    const c    = GC.LOBBY_START_COL + Math.floor(Math.random() * span);
    const r    = 19 + Math.floor(Math.random() * 4);
    return { col: c + 0.5, row: r + 0.5 };
  }

  // V2 visual-weighted attraction picker → an interaction tile. Uses
  // V2_VISUAL_WEIGHTS (not GC.ObjDef.targetWeight) so wall services
  // like WC and BAR — which the economy deliberately excludes from its picker
  // by setting targetWeight=0 — still get visual visits in V2. Skips
  // already-reserved tiles so V2 guests don't all aim at the same seat.
  private _pickInteractionTile(): { tile: GC.Vec2; obj: GC.PlacedObj } | null {
    interface Candidate { obj: GC.PlacedObj; weight: number; tiles: GC.Vec2[]; }
    const candidates: Candidate[] = [];
    let total = 0;
    for (const obj of gameState.placedObjs) {
      if (!gameState.functionalIds.has(obj.id)) {
        if (DEBUG_GUEST_TARGETS) {
          // eslint-disable-next-line no-console
          console.log(`[V2 guests] skip ${obj.id} (${_typeName(obj.type)}): not functional`);
        }
        continue;
      }
      const weight = V2_VISUAL_WEIGHTS[obj.type] ?? 0;
      if (weight <= 0) {
        if (DEBUG_GUEST_TARGETS) {
          // eslint-disable-next-line no-console
          console.log(`[V2 guests] skip ${obj.id} (${_typeName(obj.type)}): weight 0`);
        }
        continue;
      }
      const all = OV.getInteractionTiles(obj, gameState.tiles);
      const tiles = all.filter(t => !this.reservedTiles.has(this._tileKey(t.x, t.y)));
      if (tiles.length === 0) {
        if (DEBUG_GUEST_TARGETS) {
          // eslint-disable-next-line no-console
          console.log(`[V2 guests] skip ${obj.id} (${_typeName(obj.type)}): no usable interaction tile`);
        }
        continue;
      }
      candidates.push({ obj, weight, tiles });
      total += weight;
    }
    if (total <= 0) {
      if (DEBUG_GUEST_TARGETS) {
        // eslint-disable-next-line no-console
        console.log('[V2 guests] no eligible targets');
      }
      return null;
    }
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r < 0) {
        const tile = c.tiles[Math.floor(Math.random() * c.tiles.length)];
        if (DEBUG_GUEST_TARGETS) {
          // eslint-disable-next-line no-console
          console.log(`[V2 guests] pick ${c.obj.id} (${_typeName(c.obj.type)}) w=${c.weight}`);
        }
        return { tile, obj: c.obj };
      }
    }
    const last = candidates[candidates.length - 1];
    if (DEBUG_GUEST_TARGETS) {
      // eslint-disable-next-line no-console
      console.log(`[V2 guests] pick (fallback) ${last.obj.id} (${_typeName(last.obj.type)})`);
    }
    return {
      tile: last.tiles[Math.floor(Math.random() * last.tiles.length)],
      obj : last.obj,
    };
  }

  // ── Step / state machine ──────────────────────────────────────────────────

  private _stepGuest(g: InternalGuest, dt: number): void {
    if (g.state === 'idle') {
      g.idleSec -= dt;
      if (g.idleSec <= 0) this._chooseNextLeg(g);
      return;
    }
    if (g.state === 'service') {
      this._stepServicePhase(g, dt);
      return;
    }

    // Recovery cascade for walking + leaving guests.
    if (g.state === 'walking' && g.stuck >= STUCK_EXIT_SEC) {
      this._releaseReservation(g);
      g.state       = 'leaving';
      g.tCol        = g.exitCol;
      g.tRow        = g.exitRow;
      g.curKind     = null;
      g.targetObjId = undefined;
      g.route       = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
      g.stuck       = 0;
      return;
    }
    if (g.state === 'walking' && g.stuck >= STUCK_REPICK_SEC) {
      this._releaseReservation(g);
      const alt = this._pickInteractionTile();
      if (alt) {
        g.tCol        = alt.tile.x + 0.5;
        g.tRow        = alt.tile.y + 0.5;
        g.curKind     = alt.obj.type;
        g.targetObjId = alt.obj.id;
        this._reserve(g, this._tileKey(alt.tile.x, alt.tile.y));
      } else {
        g.state       = 'leaving';
        g.tCol        = g.exitCol;
        g.tRow        = g.exitRow;
        g.curKind     = null;
        g.targetObjId = undefined;
      }
      g.route = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
      g.stuck = 0;
      return;
    }

    const step = WALK_TILES_PER_SEC * dt;

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
    } else {
      g.stuck += dt;
      return;
    }

    const dx   = destX - g.col;
    const dy   = destY - g.row;
    const dist = Math.hypot(dx, dy);

    if (dist <= step) {
      if (dist > 1e-4) {
        g.dirX = dx / dist;
        g.dirY = dy / dist;
      }
      g.col = destX;
      g.row = destY;
      if (onRoute) g.route.shift();
      g.stuck = 0;
      if (g.route.length === 0 && this._near(g, g.tCol, g.tRow)) this._onArrive(g);
      return;
    }

    // If the next waypoint just became unwalkable, reroute now.
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

    const ux = dx / dist;
    const uy = dy / dist;
    g.col   += ux * step;
    g.row   += uy * step;
    g.dirX   = ux;
    g.dirY   = uy;
    g.phase += dt * BOB_RATE_RAD;
    g.stuck  = 0;
  }

  private _chooseNextLeg(g: InternalGuest): void {
    this._releaseReservation(g);
    if (g.visitsLeft > 0) {
      const next = this._pickInteractionTile();
      if (next) {
        g.tCol        = next.tile.x + 0.5;
        g.tRow        = next.tile.y + 0.5;
        g.curKind     = next.obj.type;
        g.targetObjId = next.obj.id;
        g.state       = 'walking';
        g.visitsLeft--;
        this._reserve(g, this._tileKey(next.tile.x, next.tile.y));
        g.route = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
        g.stuck = 0;
        return;
      }
    }
    g.state       = 'leaving';
    g.tCol        = g.exitCol;
    g.tRow        = g.exitRow;
    g.curKind     = null;
    g.targetObjId = undefined;
    g.route       = findRoute(gameState.tiles, g.col, g.row, g.tCol, g.tRow) ?? [];
    g.stuck       = 0;
  }

  private _onArrive(g: InternalGuest): void {
    if (g.state !== 'walking') {
      // 'leaving' arrival is handled by the despawn check in update().
      return;
    }

    // If the target is a wall service, branch into the visual service
    // flow (enter → inside → exit) instead of the simple floor-object
    // 'idle' dwell. The interaction tile / route are unchanged.
    if (g.targetObjId != null && g.curKind != null) {
      const obj = gameState.placedObjs.find(o => o.id === g.targetObjId);
      if (obj && GC.getDef(obj.type).is_wall) {
        const anchors = this._computeWallServiceAnchors(obj, g.tCol, g.tRow);
        if (anchors) {
          g.state             = 'service';
          g.servicePhase      = 'entering';
          g.visibleUseAnchor  = anchors.visible;
          g.interactionAnchor = { col: g.tCol, row: g.tRow };
          g.hidden            = false;
          return;
        }
      }
    }

    // Floor object (or wall-service with an unknown wall side — safety
    // fallback): plain idle dwell at the interaction tile.
    g.state   = 'idle';
    g.idleSec = this._dwellFor(g.curKind);
  }

  // Compute the wall-biased visible anchor for a wall service.
  // The interaction tile (g.tCol, g.tRow) is the door-inward FLOOR tile
  // immediately in front of the facade. Biasing toward the wall plane
  // (north for top, west for left) by WALL_SERVICE_BIAS tiles puts the
  // guest visibly closer to the facade than the tile centre.
  private _computeWallServiceAnchors(
    obj: GC.PlacedObj, tCol: number, tRow: number,
  ): { visible: { col: number; row: number } } | null {
    if (!GC.getDef(obj.type).is_wall) return null;
    const wallDir = PV.detectWallDir(
      obj.col, obj.row, obj.w, obj.h, gameState.tiles,
    );
    if (wallDir === 'top') {
      return { visible: { col: tCol, row: tRow - WALL_SERVICE_BIAS } };
    }
    if (wallDir === 'left') {
      return { visible: { col: tCol - WALL_SERVICE_BIAS, row: tRow } };
    }
    // The N/W-only placement rule rejects S/E walls, so this is a
    // safety fallback that should never fire in practice.
    return null;
  }

  // Visual service flow. Owns the entering → inside → exiting sub-state
  // for wall-service users. Logical target tile is unchanged; this only
  // tweaks visual position and the `hidden` flag.
  private _stepServicePhase(g: InternalGuest, dt: number): void {
    const v = g.visibleUseAnchor;
    const a = g.interactionAnchor;
    if (!v || !a) {
      // Anchors got cleared (e.g. target vanished). Bail to a fresh leg.
      g.servicePhase      = 'none';
      g.visibleUseAnchor  = null;
      g.interactionAnchor = null;
      g.hidden            = false;
      this._chooseNextLeg(g);
      return;
    }

    if (g.servicePhase === 'entering') {
      if (this._moveLinear(g, v.col, v.row, dt)) {
        const hides = g.curKind != null && _isHidingService(g.curKind);
        g.servicePhase = 'inside';
        g.hidden       = hides;
        g.phaseTimer   = this._dwellFor(g.curKind);
      }
      return;
    }

    if (g.servicePhase === 'inside') {
      g.phaseTimer -= dt;
      if (g.phaseTimer <= 0) {
        // Reappear at the visible anchor (for hidden services) before
        // the exit walk. Non-hidden services were already visible
        // standing there.
        if (g.hidden) {
          g.col    = v.col;
          g.row    = v.row;
          g.hidden = false;
        }
        g.servicePhase = 'exiting';
      }
      return;
    }

    if (g.servicePhase === 'exiting') {
      if (this._moveLinear(g, a.col, a.row, dt)) {
        g.servicePhase      = 'none';
        g.visibleUseAnchor  = null;
        g.interactionAnchor = null;
        g.hidden            = false;
        this._chooseNextLeg(g);
      }
      return;
    }
  }

  // Sub-tile linear move toward (targetCol, targetRow). Returns true on
  // arrival (within one step). Used by the service flow's entering /
  // exiting phases — bypasses the BFS route since the source and target
  // are both inside the interaction tile.
  private _moveLinear(
    g: InternalGuest,
    targetCol: number, targetRow: number,
    dt: number,
  ): boolean {
    const dx   = targetCol - g.col;
    const dy   = targetRow - g.row;
    const dist = Math.hypot(dx, dy);
    const step = WALK_TILES_PER_SEC * dt;
    if (dist <= step) {
      g.col = targetCol;
      g.row = targetRow;
      if (dist > 1e-4) {
        g.dirX = dx / dist;
        g.dirY = dy / dist;
      }
      return true;
    }
    const ux  = dx / dist;
    const uy  = dy / dist;
    g.col   += ux * step;
    g.row   += uy * step;
    g.dirX   = ux;
    g.dirY   = uy;
    g.phase += dt * BOB_RATE_RAD;
    return false;
  }

  private _dwellFor(kind: GC.ObjType | null): number {
    const range = kind != null ? GC.getDef(kind).dwellRange : DWELL_FALLBACK;
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  private _near(g: InternalGuest, c: number, r: number): boolean {
    return Math.hypot(g.col - c, g.row - r) < ARRIVE_EPSILON;
  }
}
