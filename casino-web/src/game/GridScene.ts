// GridScene.ts — Phaser scene that renders the casino grid and handles input.
// All game logic lives in GameState. This scene is purely presentation + input.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';
import * as PV from '../logic/PlacementValidator';
import { gameState } from '../state/GameState';
import { uiBus }     from '../events/UIBus';

// Layout constants shared with HTML overlay (must match style.css zones)
export const GAME_W      = 390;
export const GAME_H      = 844;
export const HUD_H       = 56;
export const TICKER_H    = 40;
export const BOTTOMBAR_H = 80;
export const GRID_AREA_Y = HUD_H;
export const GRID_AREA_H = GAME_H - HUD_H - TICKER_H - BOTTOMBAR_H; // 668

const TILE_MIN = 10;
const TILE_MAX = 30;
const TILE_DEFAULT = 18;

export class GridScene extends Phaser.Scene {
  private gfx!      : Phaser.GameObjects.Graphics;
  private labelPool : Map<string, Phaser.GameObjects.Text> = new Map();

  // Zoom-able tile size
  private tileSize = TILE_DEFAULT;

  // View pan offset (logical canvas pixels)
  private ox = 0;
  private oy = 0;

  // Placement state
  private placing   = false;
  private placeType = 0;
  private placeRot  = false;
  private placeVar  = '';
  private ghostCol  = -1;
  private ghostRow  = -1;
  private ghostOk   = false;

  // Demolish state
  private demolishing = false;

  // Drag tracking
  private dragStartX  = 0;
  private dragStartY  = 0;
  private dragStartOX = 0;
  private dragStartOY = 0;
  private dragged     = false;

  constructor() {
    super({ key: 'GridScene' });
  }

  create(): void {
    this.gfx = this.add.graphics();

    // Center grid horizontally on start (grid 36×18 = 648 > 390 viewport)
    const gridW = GC.GRID_COLS * this.tileSize;
    this.ox = Math.min(0, (GAME_W - gridW) / 2);

    // ── Game state events ─────────────────────────────────────────────────
    gameState.on('state_changed', () => this._redraw());

    // ── UI bus events ─────────────────────────────────────────────────────
    uiBus.on<{ type: number; variant: string }>('start_placement', ({ type, variant }) => {
      this.placing     = true;
      this.placeType   = type;
      this.placeVar    = variant;
      this.placeRot    = false;
      this.demolishing = false;
      this.ghostCol    = -1;
      this.ghostRow    = -1;
      this._setCursor('crosshair');
      this._redraw();
    });

    uiBus.on('exit_placement', () => {
      this.placing  = false;
      this.ghostCol = -1;
      this.ghostRow = -1;
      this._setCursor('default');
      this._redraw();
    });

    uiBus.on<boolean>('toggle_demolish', enabled => {
      this.demolishing = enabled;
      this.placing     = false;
      this._setCursor(enabled ? 'no-drop' : 'default');
      this._redraw();
    });

    // ── Keyboard ─────────────────────────────────────────────────────────
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.placing) {
        this.placing = false; this.ghostCol = -1; this.ghostRow = -1;
        this._setCursor('default');
        this._redraw();
        uiBus.emit('placement_cancelled');
      } else if (this.demolishing) {
        this.demolishing = false;
        this._setCursor('default');
        this._redraw();
        uiBus.emit('demolish_cancelled');
      }
    });

    // R = rotate ghost while placing
    this.input.keyboard?.on('keydown-R', () => {
      if (!this.placing) return;
      this.placeRot = !this.placeRot;
      if (this.ghostCol >= 0) this._revalidateGhost();
      this._redraw();
    });

    // ── Pointer (mouse / touch) ───────────────────────────────────────────
    this.input.on('pointerdown',  this._onDown, this);
    this.input.on('pointermove',  this._onMove, this);
    this.input.on('pointerup',    this._onUp,   this);

    // ── Mouse-wheel zoom (non-passive so we can preventDefault) ───────────
    this.sys.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      this._onWheel(e);
    }, { passive: false });

    this._redraw();
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private _inGrid(py: number): boolean {
    return py >= GRID_AREA_Y && py < GRID_AREA_Y + GRID_AREA_H;
  }

  /** Convert logical canvas position → grid tile, or null if out of bounds. */
  private _toTile(px: number, py: number): { col: number; row: number } | null {
    const col = Math.floor((px - this.ox) / this.tileSize);
    const row = Math.floor((py - GRID_AREA_Y - this.oy) / this.tileSize);
    if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return null;
    return { col, row };
  }

  private _onDown(ptr: Phaser.Input.Pointer): void {
    if (!this._inGrid(ptr.y)) return;

    this.dragStartX  = ptr.x;
    this.dragStartY  = ptr.y;
    this.dragStartOX = this.ox;
    this.dragStartOY = this.oy;
    this.dragged     = false;

    // Right-click / two-finger tap = rotate ghost
    if (ptr.rightButtonDown() && this.placing) {
      this.placeRot = !this.placeRot;
      this._updateGhost(ptr.x, ptr.y);
      this._redraw();
    }
  }

  private _onMove(ptr: Phaser.Input.Pointer): void {
    if (!ptr.isDown) {
      // Hover: update ghost and cursor
      if (this.placing && this._inGrid(ptr.y)) {
        this._updateGhost(ptr.x, ptr.y);
        this._redraw();
      }
      return;
    }

    const dx = ptr.x - this.dragStartX;
    const dy = ptr.y - this.dragStartY;

    if (Math.hypot(dx, dy) > 6) {
      this.dragged = true;

      if (this.placing) {
        this._updateGhost(ptr.x, ptr.y);
      } else {
        this._setCursor('grabbing');
        this.ox = this.dragStartOX + dx;
        this.oy = this.dragStartOY + dy;
        this._clampOffset();
      }
      this._redraw();
    }
  }

  private _onUp(ptr: Phaser.Input.Pointer): void {
    if (!this.dragged && this._inGrid(ptr.y)) this._tap(ptr.x, ptr.y);

    // Restore cursor after drag
    if (this.dragged && !this.placing && !this.demolishing) {
      this._setCursor('default');
    }
    this.dragged = false;
  }

  private _tap(px: number, py: number): void {
    const coord = this._toTile(px, py);
    if (!coord) return;

    if (this.placing) {
      gameState.tryPlace(coord.col, coord.row, this.placeType as GC.ObjType, this.placeRot, this.placeVar);
      this.placing = false;
      this.ghostCol = -1; this.ghostRow = -1;
      this._setCursor('default');
      this._redraw();
      uiBus.emit('placement_confirmed');
      return;
    }

    if (this.demolishing) {
      const t = gameState.tiles[coord.row * GC.GRID_COLS + coord.col];
      if (t.obj_id) gameState.demolish(t.obj_id);
      return;
    }

    const t = gameState.tiles[coord.row * GC.GRID_COLS + coord.col];
    if (t.obj_id) uiBus.emit('object_tapped', t.obj_id);
  }

  private _updateGhost(px: number, py: number): void {
    const coord = this._toTile(px, py);
    if (!coord) { this.ghostCol = -1; this.ghostRow = -1; return; }
    this.ghostCol = coord.col;
    this.ghostRow = coord.row;
    this._revalidateGhost();
  }

  private _revalidateGhost(): void {
    if (this.ghostCol < 0) return;
    const result = PV.validate(
      { type: this.placeType as GC.ObjType, col: this.ghostCol, row: this.ghostRow, rotated: this.placeRot },
      gameState.tiles, gameState.placedObjs, gameState.cash, gameState.barExists,
    );
    this.ghostOk = result === GC.ValResult.VALID;
  }

  // ── Mouse-wheel zoom ───────────────────────────────────────────────────────

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();

    // Convert screen position → logical canvas coordinates,
    // accounting for any CSS transform (scale) applied to #app.
    const canvas = this.sys.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    const cssScaleX = rect.width  / GAME_W;
    const cssScaleY = rect.height / GAME_H;
    const mx = (e.clientX - rect.left) / cssScaleX;
    const my = (e.clientY - rect.top)  / cssScaleY;

    if (!this._inGrid(my)) return;

    const oldTs = this.tileSize;
    // Trackpad sends small fractional deltas; clamp to ±1 per event
    const sign  = e.deltaY < 0 ? 1 : -1;
    const newTs = Math.max(TILE_MIN, Math.min(TILE_MAX, oldTs + sign));

    if (newTs === oldTs) return;

    // Zoom toward cursor: keep the tile under the cursor in place.
    // col = (mx - ox) / oldTs  →  ox_new = mx - col * newTs
    const col = (mx - this.ox)              / oldTs;
    const row = (my - GRID_AREA_Y - this.oy) / oldTs;

    this.tileSize = newTs;
    this.ox = mx            - col * newTs;
    this.oy = (my - GRID_AREA_Y) - row * newTs;

    this._clampOffset();
    this._redraw();
  }

  // ── Pan clamping ───────────────────────────────────────────────────────────

  private _clampOffset(): void {
    const ts    = this.tileSize;
    const gridW = GC.GRID_COLS * ts;
    const gridH = GC.GRID_ROWS * ts;

    // Allow up to half a view of empty space on either side
    const padX = GAME_W    * 0.5;
    const padY = GRID_AREA_H * 0.5;

    this.ox = Math.max(GAME_W    - gridW - padX, Math.min(padX, this.ox));
    this.oy = Math.max(GRID_AREA_H - gridH - padY, Math.min(padY, this.oy));
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private _redraw(): void {
    const g     = this.gfx;
    const ts    = this.tileSize;
    const baseX = this.ox;
    const baseY = this.oy + GRID_AREA_Y;

    g.clear();

    // 1. Tiles
    for (let row = 0; row < GC.GRID_ROWS; row++) {
      for (let col = 0; col < GC.GRID_COLS; col++) {
        const t = gameState.tiles[row * GC.GRID_COLS + col];
        g.fillStyle(this._tileColor(t.tile_type), 1);
        g.fillRect(baseX + col * ts, baseY + row * ts, ts - 1, ts - 1);
      }
    }

    // 2. Placed objects
    const usedIds = new Set<string>();
    for (const obj of gameState.placedObjs) {
      const color = GC.OBJ_COLOURS[obj.type] ?? 0x888888;
      g.fillStyle(color, 1);
      g.fillRect(baseX + obj.col * ts, baseY + obj.row * ts, obj.w * ts - 1, obj.h * ts - 1);

      // Abbreviated label — only show when tiles are large enough to be readable
      usedIds.add(obj.id);
      let txt = this.labelPool.get(obj.id);
      if (!txt) {
        const def = GC.getDef(obj.type as GC.ObjType);
        txt = this.add.text(0, 0, def.label.slice(0, 2), {
          fontSize: '9px', color: '#fff', fontFamily: 'monospace',
        }).setDepth(2);
        this.labelPool.set(obj.id, txt);
      }
      const visible = ts >= 14;
      txt.setVisible(visible);
      if (visible) {
        txt.setPosition(baseX + obj.col * ts + 1, baseY + obj.row * ts + ts * 0.3);
      }
    }

    // Destroy labels for removed objects
    for (const [id, txt] of this.labelPool) {
      if (!usedIds.has(id)) { txt.destroy(); this.labelPool.delete(id); }
    }

    // 3. Placement ghost
    if (this.placing && this.ghostCol >= 0) {
      const def = GC.getDef(this.placeType as GC.ObjType);
      const w   = this.placeRot ? def.fh : def.fw;
      const h   = this.placeRot ? def.fw : def.fh;
      g.fillStyle(this.ghostOk ? 0x33e64d : 0xe63333, 0.5);
      g.fillRect(baseX + this.ghostCol * ts, baseY + this.ghostRow * ts, w * ts, h * ts);
    }

    // 4. Demolish overlay
    if (this.demolishing) {
      for (const obj of gameState.placedObjs) {
        g.fillStyle(0xff3333, 0.35);
        g.fillRect(baseX + obj.col * ts, baseY + obj.row * ts, obj.w * ts - 1, obj.h * ts - 1);
      }
    }
  }

  private _tileColor(t: GC.TileType): number {
    switch (t) {
      case GC.TileType.WALL:    return GC.COL_WALL;
      case GC.TileType.LOBBY:   return GC.COL_LOBBY;
      case GC.TileType.BLOCKED: return GC.COL_BLOCKED;
      default:                  return GC.COL_FLOOR;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _setCursor(cursor: string): void {
    this.sys.game.canvas.style.cursor = cursor;
  }
}
