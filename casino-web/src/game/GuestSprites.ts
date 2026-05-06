// GuestSprites.ts — visible guest presentation layer.
//
// Strict scope: this is *not* the source of truth for the economy. It is a
// scaled-down visual layer driven by aggregate state. Guests spawn at the
// lobby, walk to a usage-weighted attraction's seat / interaction tile,
// idle while "using" it, visit a few more attractions, then return to the
// lobby and despawn. Movement uses simple axis stepping with wall-sliding
// against non-walkable tiles — no pathfinding, intentional.
//
// P2.1: targets are seat/use tiles only. For slots that's the chair tile
// inside the footprint (walkable thanks to the is_seat flag); for tables
// it's an open-floor tile on a player side; for wall services it's the
// inward door tile. Dwell time per visit and visits-per-guest are scaled
// up so the floor reads like an active casino, not a hallway.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';
import * as OV from '../logic/OperationalValidator';
import * as PV from '../logic/PlacementValidator';
import { gameState } from '../state/GameState';

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
  // Subtle per-guest tint variation so the crowd doesn't look uniform.
  tint  : number;
}

// Modestly fuller floor than the previous 12/0.06 setting. Caps the
// visible crowd to keep draw + state cost bounded; the ratio scales it
// against the aggregate guests/day.
const MAX_VISIBLE        = 24;
const VISIBLE_PER_GUEST  = 0.10;
const WALK_TILES_PER_SEC = 2.5;
// If a guest can't advance on either axis for this many in-game seconds,
// allow non-walkable movement until they make progress again. Keeps
// pathological layouts from freezing the crowd.
const STUCK_BYPASS_SEC   = 1.2;

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
    const target = Math.max(0, Math.min(MAX_VISIBLE, Math.round(gameState.totalGuests * VISIBLE_PER_GUEST)));
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

    const step = WALK_TILES_PER_SEC * dt;
    const dx   = g.tCol - g.col;
    const dy   = g.tRow - g.row;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      // Snap to target, even if the final tile is the interaction slot.
      g.col = g.tCol;
      g.row = g.tRow;
      g.stuck = 0;
      this._onArrive(g);
      return;
    }

    // Try to advance with wall-sliding so guests don't visibly cross
    // through placed objects. Larger axis goes first so motion reads
    // straight when unobstructed.
    const wantCol = g.col + (dx / dist) * step;
    const wantRow = g.row + (dy / dist) * step;
    const xFirst  = Math.abs(dx) >= Math.abs(dy);
    const allowClip = g.stuck >= STUCK_BYPASS_SEC;

    let moved = false;
    if (this._walkable(wantCol, wantRow, allowClip)) {
      g.col = wantCol; g.row = wantRow; moved = true;
    } else if (xFirst && this._walkable(wantCol, g.row, allowClip)) {
      g.col = wantCol; moved = true;
    } else if (!xFirst && this._walkable(g.col, wantRow, allowClip)) {
      g.row = wantRow; moved = true;
    } else if (xFirst && this._walkable(g.col, wantRow, allowClip)) {
      g.row = wantRow; moved = true;
    } else if (!xFirst && this._walkable(wantCol, g.row, allowClip)) {
      g.col = wantCol; moved = true;
    }

    g.stuck = moved ? 0 : g.stuck + dt;
  }

  // Decide what to do after an idle has finished: visit another attraction
  // or head for the exit. Falling back to exit when no targets are left
  // ensures the crowd doesn't pile up at one attraction.
  private _chooseNextLeg(g: Guest): void {
    if (g.visitsLeft > 0) {
      const next = this._pickInteractionTile();
      if (next) {
        g.tCol = next.tile.x + 0.5;
        g.tRow = next.tile.y + 0.5;
        g.curKind = next.kind;
        g.state = 'to_target';
        g.visitsLeft--;
        g.stuck = 0;
        return;
      }
    }
    g.state = 'to_exit';
    g.tCol  = g.exitCol;
    g.tRow  = g.exitRow;
    g.curKind = null;
    g.stuck = 0;
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

  // Walkable for guest movement: open floor, lobby, or a slot's chair tile
  // (the chair is occupied by the slot, but the guest is meant to stand on
  // it). `allowClip` lets a stuck guest punch through obstacles so a layout
  // change can never permanently strand them.
  private _walkable(col: number, row: number, allowClip: boolean): boolean {
    if (allowClip) return true;
    const tc = Math.floor(col);
    const tr = Math.floor(row);
    return PV.isWalkable(gameState.tiles, tc, tr);
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  private _spawn(): Guest | null {
    const target = this._pickInteractionTile();
    if (!target) return null;
    const exit = this._lobbySpawn();
    return {
      col   : exit.col,
      row   : exit.row,
      tCol  : target.tile.x + 0.5,
      tRow  : target.tile.y + 0.5,
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
    const r = Math.max(2, Math.round(ts * 0.22));
    for (const guest of this.guests) {
      const x = baseX + guest.col * ts;
      const y = baseY + guest.row * ts;
      // Soft shadow.
      g.fillStyle(0x000000, 0.35);
      g.fillCircle(x, y + Math.max(1, r * 0.45), Math.max(1, r * 0.7));
      // Body.
      g.fillStyle(guest.tint, 1);
      g.fillCircle(x, y, r);
      // Subtle highlight.
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(x - r * 0.3, y - r * 0.3, Math.max(1, r * 0.35));
    }
  }
}
