// GuestVisualControllerV2.ts — V2-only visual guest layer.
//
// Mirrors the population/state-machine pattern of V1's GuestSprites
// (spawn at lobby → walk to a functional attraction's interaction tile
// via GuestRouter → idle/dwell → maybe visit more → leave to lobby).
// All state lives here; gameState is read-only. No revenue, rating,
// goals, saves, or reservations on gameState are touched.
//
// V1's GuestSprites remains the authority for V1 rendering — V2 owns
// its own controller so V1 stays untouched. After V2 fully ships,
// the shared behaviour can be deduplicated.
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
  state       : 'walking' | 'idle' | 'leaving';
  targetObjId?: string;
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
}

// Visible-crowd sizing — mirrors V1's MIN/MAX/ratio. Caps at 36 so
// even a packed casino renders smoothly on a single Graphics layer.
const MIN_VISIBLE        = 4;
const MAX_VISIBLE        = 36;
const VISIBLE_PER_GUEST  = 0.25;
const SPAWN_INTERVAL_SEC = 1.0;
const WALK_TILES_PER_SEC = 1.0;
const BOB_RATE_RAD       = 8.0;

// Stuck-recovery cascade (game-seconds). Cheaper than V1's full
// four-tier cascade since V2 is visual-only; two tiers suffice.
const STUCK_REPICK_SEC  = 4.0;
const STUCK_EXIT_SEC    = 8.0;

const DWELL_FALLBACK: [number, number] = [3, 6];

// Distance (in tile units) at which a guest "arrives" at a target.
const ARRIVE_EPSILON = 0.05;

export class GuestVisualControllerV2 {
  private guests        : InternalGuest[] = [];
  private spawnCooldown = 0;
  private reservedTiles = new Set<string>();
  private _nextId       = 0;

  // Called every frame from PresentationSceneV2.update. dtMs is real
  // milliseconds; we scale by the current game speed so paused = freeze
  // and 4× = guests walk 4× faster (matches V1).
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
      // Total of 3..5 attractions per guest (matches V1).
      visitsLeft  : 2 + Math.floor(Math.random() * 3),
      stuck       : 0,
      route       : findRoute(gameState.tiles, exit.col, exit.row, tCol, tRow) ?? [],
      reservedKey : key,
    };
  }

  // Random lobby tile centre — same range as V1.
  private _lobbySpawn(): { col: number; row: number } {
    const span = GC.LOBBY_END_COL - GC.LOBBY_START_COL + 1;
    const c    = GC.LOBBY_START_COL + Math.floor(Math.random() * span);
    const r    = 19 + Math.floor(Math.random() * 4);
    return { col: c + 0.5, row: r + 0.5 };
  }

  // Usage-weighted attraction picker → an interaction tile. Skips
  // already-reserved tiles so V2 guests don't all aim at the same seat.
  private _pickInteractionTile(): { tile: GC.Vec2; obj: GC.PlacedObj } | null {
    interface Candidate { obj: GC.PlacedObj; weight: number; tiles: GC.Vec2[]; }
    const candidates: Candidate[] = [];
    let total = 0;
    for (const obj of gameState.placedObjs) {
      if (!gameState.functionalIds.has(obj.id)) continue;
      const weight = GC.getDef(obj.type).targetWeight;
      if (weight <= 0) continue;
      const all = OV.getInteractionTiles(obj, gameState.tiles);
      const tiles = all.filter(t => !this.reservedTiles.has(this._tileKey(t.x, t.y)));
      if (tiles.length === 0) continue;
      candidates.push({ obj, weight, tiles });
      total += weight;
    }
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r < 0) {
        const tile = c.tiles[Math.floor(Math.random() * c.tiles.length)];
        return { tile, obj: c.obj };
      }
    }
    const last = candidates[candidates.length - 1];
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
    if (g.state === 'walking') {
      g.state   = 'idle';
      g.idleSec = this._dwellFor(g.curKind);
    }
    // 'leaving' arrival is handled by the despawn check in update().
  }

  private _dwellFor(kind: GC.ObjType | null): number {
    const range = kind != null ? GC.getDef(kind).dwellRange : DWELL_FALLBACK;
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  private _near(g: InternalGuest, c: number, r: number): boolean {
    return Math.hypot(g.col - c, g.row - r) < ARRIVE_EPSILON;
  }
}
