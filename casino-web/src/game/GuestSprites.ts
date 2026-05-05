// GuestSprites.ts — visible guest presentation layer.
//
// Strict scope: this is *not* the source of truth for the economy. It is a
// scaled-down visual layer driven by aggregate state. Guests spawn at the
// lobby, walk to a usage-weighted attraction (slot, table, cashier), idle
// briefly, then walk back out and despawn. Movement is straight-line lerp
// in pixel space — no pathfinding, intentional.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';
import { gameState } from '../state/GameState';

type GuestState = 'to_target' | 'idle' | 'to_exit';

interface Guest {
  // Float tile coordinates so pan/zoom auto-reposition without recomputing.
  col   : number;
  row   : number;
  // Tile-coordinate target.
  tCol  : number;
  tRow  : number;
  // Spawn tile — guest returns here before despawning.
  exitCol: number;
  exitRow: number;
  state : GuestState;
  // Remaining idle seconds (game-time).
  idle  : number;
  // Subtle per-guest tint variation so the crowd doesn't look uniform.
  tint  : number;
}

const MAX_VISIBLE       = 12;
const VISIBLE_PER_GUEST = 0.06; // visible:total ratio (cosmetic scale)
const WALK_TILES_PER_SEC = 2.5;
const IDLE_MIN_SEC = 3;
const IDLE_MAX_SEC = 6;

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
      if (g.idle <= 0) {
        g.state = 'to_exit';
        g.tCol  = g.exitCol;
        g.tRow  = g.exitRow;
      }
      return;
    }
    // Move toward target.
    const dx = g.tCol - g.col;
    const dy = g.tRow - g.row;
    const dist = Math.hypot(dx, dy);
    const step = WALK_TILES_PER_SEC * dt;
    if (dist <= step) {
      g.col = g.tCol;
      g.row = g.tRow;
      if (g.state === 'to_target') {
        g.state = 'idle';
        g.idle  = IDLE_MIN_SEC + Math.random() * (IDLE_MAX_SEC - IDLE_MIN_SEC);
      }
    } else {
      g.col += (dx / dist) * step;
      g.row += (dy / dist) * step;
    }
  }

  private _near(g: Guest, c: number, r: number): boolean {
    return Math.hypot(g.col - c, g.row - r) < 0.05;
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  private _spawn(): Guest | null {
    const target = this._pickTarget();
    if (!target) return null;
    const exit = this._lobbySpawn();
    return {
      col   : exit.col + (Math.random() - 0.5) * 0.6,
      row   : exit.row + (Math.random() - 0.5) * 0.4,
      tCol  : target.col,
      tRow  : target.row,
      exitCol: exit.col,
      exitRow: exit.row,
      state : 'to_target',
      idle  : 0,
      tint  : 0xffe28a + Math.floor(Math.random() * 0x40) * 0x010101,
    };
  }

  // Random lobby tile so multiple spawns don't stack on a single point.
  private _lobbySpawn(): { col: number; row: number } {
    const c = GC.LOBBY_START_COL + Math.random() * (GC.LOBBY_END_COL - GC.LOBBY_START_COL + 1);
    const r = 21 + Math.random() * 1.5;
    return { col: c, row: r };
  }

  // Usage-weighted attraction picker:
  //   slot     weight = funcSlot  × 1
  //   small    weight = funcSmall × 4   (matches table capacity weight)
  //   large    weight = funcLarge × 6   (matches large-table capacity weight)
  //   cashier  weight = funcCashier × 2 (smaller but regular share)
  private _pickTarget(): { col: number; row: number } | null {
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

    // Pick a random functional object of that type, then a random
    // approach tile (footprint center is fine — guests may visually clip
    // onto the attraction tile, which reads as "playing").
    const candidates = gameState.placedObjs.filter(
      o => o.type === kind && gameState.functionalIds.has(o.id),
    );
    if (candidates.length === 0) return null;
    const obj = candidates[Math.floor(Math.random() * candidates.length)];
    return { col: obj.col + obj.w / 2, row: obj.row + obj.h / 2 };
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
