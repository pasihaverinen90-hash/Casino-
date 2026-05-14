// GridScene.ts — Phaser scene that renders the casino grid and handles input.
// All game logic lives in GameState. This scene is purely presentation + input.
import Phaser from 'phaser';
import * as GC from '../logic/GameConstants';
import * as PV from '../logic/PlacementValidator';
import { gameState } from '../state/GameState';
import { uiBus }     from '../events/UIBus';
import { paintObject, paintSeat, type WallSide } from './ObjectArt';
import { GuestSprites } from './GuestSprites';
import { time } from '../state/TimeController';

// Fixed layout zone heights (px). CSS must match these values.
export const HUD_H       = 56;
export const TICKER_H    = 40;
export const BOTTOMBAR_H = 80;
export const GRID_AREA_Y = HUD_H;

const TILE_MIN     = 10;
const TILE_MAX     = 48;
const TILE_DEFAULT = 24;

export class GridScene extends Phaser.Scene {
  private gfx!      : Phaser.GameObjects.Graphics;
  // Visible guest layer — presentation only, driven by aggregate state.
  private guests!   : GuestSprites;
  // Persistent text labels for wall services (WC, BAR, $) — kept in a pool
  // so we don't churn Text objects on every redraw.
  private labelPool : Map<string, Phaser.GameObjects.Text> = new Map();

  // Zoom-able tile size
  private tileSize = TILE_DEFAULT;

  // View pan offset (logical canvas pixels)
  private ox = 0;
  private oy = 0;

  // Placement state
  private placing     = false;
  private placeType   = 0;
  // 4-direction facing for the placement ghost. R cycles N→E→S→W.
  private placeFacing : GC.Orientation = 'S';
  private placeVar    = '';
  private ghostCol    = -1;
  private ghostRow    = -1;
  private ghostOk     = false;

  // Demolish state
  private demolishing = false;

  // Drag tracking (used to distinguish a click from a pan)
  private dragStartX  = 0;
  private dragStartY  = 0;
  private dragStartOX = 0;
  private dragStartOY = 0;
  private dragged     = false;

  constructor() {
    super({ key: 'GridScene' });
  }

  create(): void {
    this.gfx    = this.add.graphics();
    this.guests = new GuestSprites(this);

    // Center grid horizontally on start
    const gridW = GC.GRID_COLS * this.tileSize;
    this.ox = (this.scale.width - gridW) / 2;

    // ── Window resize ─────────────────────────────────────────────────────
    this.scale.on('resize', () => {
      this._clampOffset();
      this._redraw();
    });

    // ── Game state events ─────────────────────────────────────────────────
    gameState.on('state_changed', () => this._redraw());

    // ── UI bus events ─────────────────────────────────────────────────────
    uiBus.on<{ type: number; variant: string }>('start_placement', ({ type, variant }) => {
      this.placing     = true;
      this.placeType   = type;
      this.placeVar    = variant;
      // Default facing: S so a freshly-picked slot has its chair toward
      // the lobby, and tables present the dealer-side band on top to the
      // player's eye. R cycles from there.
      this.placeFacing = 'S';
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

    // R = cycle ghost facing through N → E → S → W while placing.
    // Skip when Ctrl+Shift are held — that combo is reserved for the hidden
    // Rating V2 breakdown shortcut handled in main.ts.
    this.input.keyboard?.on('keydown-R', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) return;
      if (!this.placing) return;
      this.placeFacing = GC.nextFacing(this.placeFacing);
      if (this.ghostCol >= 0) this._revalidateGhost();
      this._redraw();
    });

    // ── Pointer (mouse / touch) ───────────────────────────────────────────
    this.input.on('pointerdown',  this._onDown, this);
    this.input.on('pointermove',  this._onMove, this);
    this.input.on('pointerup',    this._onUp,   this);

    // Right-click is used to rotate the placement ghost; suppress the
    // browser context menu so the rotation feels clean.
    this.input.mouse?.disableContextMenu();

    // ── Mouse-wheel zoom (non-passive so we can preventDefault) ───────────
    this.sys.game.canvas.addEventListener('wheel', (e: WheelEvent) => {
      this._onWheel(e);
    }, { passive: false });

    this._redraw();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private get _gridAreaH(): number {
    return this.scale.height - HUD_H - TICKER_H - BOTTOMBAR_H;
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private _inGrid(py: number): boolean {
    return py >= GRID_AREA_Y && py < GRID_AREA_Y + this._gridAreaH;
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

    // Right-click cycles ghost facing (same as R).
    if (ptr.rightButtonDown() && this.placing) {
      this.placeFacing = GC.nextFacing(this.placeFacing);
      this._updateGhost(ptr.x, ptr.y);
      this._redraw();
    }
  }

  private _onMove(ptr: Phaser.Input.Pointer): void {
    if (!ptr.isDown) {
      if (this.placing && this._inGrid(ptr.y)) {
        this._updateGhost(ptr.x, ptr.y);
        this._redraw();
      }
      return;
    }

    const dx = ptr.x - this.dragStartX;
    const dy = ptr.y - this.dragStartY;

    // Drag pans the view in any mode (placing too — this lets the player
    // reposition before committing). No drag-to-place: each placement is
    // an explicit click, which avoids accidental purchases.
    if (Math.hypot(dx, dy) > 6) {
      this.dragged = true;
      this._setCursor('grabbing');
      this.ox = this.dragStartOX + dx;
      this.oy = this.dragStartOY + dy;
      this._clampOffset();
      if (this.placing) this._updateGhost(ptr.x, ptr.y);
      this._redraw();
    }
  }

  private _onUp(ptr: Phaser.Input.Pointer): void {
    if (!this.dragged && this._inGrid(ptr.y)) this._tap(ptr);

    if (this.dragged && !this.placing && !this.demolishing) {
      this._setCursor('default');
    } else if (this.dragged && this.placing) {
      this._setCursor('crosshair');
    }
    this.dragged = false;
  }

  private _tap(ptr: Phaser.Input.Pointer): void {
    const coord = this._toTile(ptr.x, ptr.y);
    if (!coord) return;

    if (this.placing) {
      const a = this._placeAnchor(coord.col, coord.row);
      const objType = this.placeType as GC.ObjType;
      // Build-over-guest fix: gently move any visible guest standing on a
      // tile that's about to become non-walkable. Done *before* tryPlace so
      // the world isn't mutated if displacement fails (player gets a clean
      // toast). We pre-validate first — if the request would fail anyway
      // (out of bounds, locked, can't afford, etc.) we let tryPlace emit
      // its existing failure toast instead of preempting it here.
      const pre = PV.validate(
        { type: objType, col: a.col, row: a.row, facing: this.placeFacing },
        gameState.tiles, gameState.cash, gameState.barExists,
        gameState.isUnlocked(objType),
      );
      if (pre === GC.ValResult.VALID) {
        const blocked = this._computePlacementBlockedTiles(
          objType, a.col, a.row, this.placeFacing,
        );
        if (!this.guests.displaceGuestsFromTiles(blocked)) {
          gameState.emit('toast_requested', 'No safe place to move guests.');
          return;
        }
      }
      const ok = gameState.tryPlace(a.col, a.row, objType, this.placeFacing, this.placeVar);
      if (ok) {
        // Ctrl-click keeps placement mode open for repeat placements.
        const ev   = ptr.event as MouseEvent | PointerEvent | undefined;
        const ctrl = !!(ev && ev.ctrlKey);
        if (!ctrl) {
          this.placing  = false;
          this.ghostCol = -1;
          this.ghostRow = -1;
          this._setCursor('default');
          uiBus.emit('placement_confirmed');
        } else {
          this._revalidateGhost();
        }
      }
      this._redraw();
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
    const a = this._placeAnchor(this.ghostCol, this.ghostRow);
    const result = PV.validate(
      { type: this.placeType as GC.ObjType, col: a.col, row: a.row, facing: this.placeFacing },
      gameState.tiles, gameState.cash, gameState.barExists,
      gameState.isUnlocked(this.placeType as GC.ObjType),
    );
    this.ghostOk = result === GC.ValResult.VALID;
  }

  // Convert a cursor tile to the placement bounds top-left that storage and
  // validation expect. For slots the cursor is the cabinet tile and rotates
  // the chair around it (P2.2). For everything else the cursor already is
  // the bounds top-left.
  private _placeAnchor(curCol: number, curRow: number): { col: number; row: number } {
    if (this.placeType === GC.ObjType.SLOT_MACHINE) {
      const tl = GC.slotAnchorFromCursor(curCol, curRow, this.placeFacing);
      return { col: tl.x, row: tl.y };
    }
    // Tables: centre the footprint roughly under the cursor so rotating
    // doesn't fling the table off to one corner. P3A polish — slots had
    // their own cabinet anchor since P2.2; tables now feel similar.
    if (GC.isTableLike(this.placeType as GC.ObjType)) {
      const tl = GC.tableAnchorFromCursor(curCol, curRow, this.placeType as GC.ObjType, this.placeFacing);
      return { col: tl.x, row: tl.y };
    }
    return { col: curCol, row: curRow };
  }

  // Tiles that the planned placement will make unavailable for visible
  // guests. Used to displace anyone standing in the way before tryPlace
  // commits the placement.
  //   • Footprint always — covers slot cabinet+chair, table body, and
  //     the body of any wall service.
  //   • Table-likes also reserve seat tiles around the body, so we
  //     include those.
  //   • Wall services don't need their door-inward tile included — that
  //     tile remains open floor; a guest standing on it is in front of
  //     the new service, not trapped inside it.
  private _computePlacementBlockedTiles(
    type: GC.ObjType, col: number, row: number, facing: GC.Orientation,
  ): GC.Vec2[] {
    const { w, h } = GC.dimsFor(type, facing);
    const out: GC.Vec2[] = PV.computeFootprint(col, row, w, h);
    if (GC.isTableLike(type)) {
      out.push(...GC.tableSeatTiles(col, row, type, facing));
    }
    return out;
  }

  // ── Mouse-wheel zoom ───────────────────────────────────────────────────────

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();

    const canvas = this.sys.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    // Account for any browser zoom or CSS scaling on the canvas
    const scaleX = rect.width  / this.scale.width;
    const scaleY = rect.height / this.scale.height;
    const mx = (e.clientX - rect.left) / scaleX;
    const my = (e.clientY - rect.top)  / scaleY;

    if (!this._inGrid(my)) return;

    const oldTs = this.tileSize;
    const sign  = e.deltaY < 0 ? 1 : -1;
    const step  = Math.max(1, Math.round(oldTs * 0.08)); // smoother zoom at larger sizes
    const newTs = Math.max(TILE_MIN, Math.min(TILE_MAX, oldTs + sign * step));

    if (newTs === oldTs) return;

    // Zoom toward cursor: keep the tile under cursor fixed
    const col = (mx - this.ox)               / oldTs;
    const row = (my - GRID_AREA_Y - this.oy) / oldTs;

    this.tileSize = newTs;
    this.ox = mx              - col * newTs;
    this.oy = (my - GRID_AREA_Y) - row * newTs;

    this._clampOffset();
    this._redraw();
  }

  // ── Pan clamping ───────────────────────────────────────────────────────────

  private _clampOffset(): void {
    const ts     = this.tileSize;
    const gridW  = GC.GRID_COLS * ts;
    const gridH  = GC.GRID_ROWS * ts;
    const viewW  = this.scale.width;
    const viewH  = this._gridAreaH;
    const padX   = viewW * 0.5;
    const padY   = viewH * 0.5;

    this.ox = Math.max(viewW - gridW - padX, Math.min(padX, this.ox));
    this.oy = Math.max(viewH - gridH - padY, Math.min(padY, this.oy));
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  private _redraw(): void {
    const g     = this.gfx;
    const ts    = this.tileSize;
    const baseX = this.ox;
    const baseY = this.oy + GRID_AREA_Y;

    g.clear();

    // 1. Tiles — Phase V1 visual uplift. Floor and lobby get a richer
    // procedural carpet treatment; wall/blocked stay solid for clarity.
    // Pattern is deterministic from (col, row) only — no time, no random —
    // so pan/zoom/save/reload are visually stable.
    for (let row = 0; row < GC.GRID_ROWS; row++) {
      for (let col = 0; col < GC.GRID_COLS; col++) {
        const t = gameState.tiles[row * GC.GRID_COLS + col];
        this._paintTile(g, t, col, row, baseX, baseY, ts);
      }
    }

    // 2. Placed objects — non-functional ones (no open-floor adjacency)
    // render dimmed so the player can see at a glance which builds are inert.
    //
    // Depth-sort preparation (Phase P1 of the 2.5D plan): render in a stable
    // "back-to-front" tile order so future angled/oblique work doesn't have
    // to retro-fit draw ordering. Today's flat top-down art is visually
    // unaffected because object footprints don't overlap (placement rules
    // forbid it). Sort key:
    //   primary    — bottom-edge row     (obj.row + obj.h)
    //   secondary  — right-edge column   (obj.col + obj.w)
    //   tertiary   — original array index (stable; preserves save order
    //                where the primary/secondary keys tie)
    // We sort a shallow copy — gameState.placedObjs itself is never mutated,
    // so save order, object ids, and downstream callers are untouched.
    const placedOrder = gameState.placedObjs
      .map((obj, index) => ({ obj, index }))
      .sort((a, b) => {
        const da = a.obj.row + a.obj.h;
        const db = b.obj.row + b.obj.h;
        if (da !== db) return da - db;
        const xa = a.obj.col + a.obj.w;
        const xb = b.obj.col + b.obj.w;
        if (xa !== xb) return xa - xb;
        return a.index - b.index;
      });
    const usedIds = new Set<string>();
    for (const { obj } of placedOrder) {
      const isFunc = gameState.functionalIds.has(obj.id);
      const alpha  = isFunc ? 1 : 0.45;
      const def    = GC.getDef(obj.type);
      const wallSide = def.is_wall ? this._detectWallSide(obj) : null;
      paintObject(
        g, obj.type,
        baseX + obj.col * ts, baseY + obj.row * ts,
        obj.w * ts, obj.h * ts,
        alpha,
        wallSide,
        obj.facing,
        obj.variant,
      );

      // Reserved seat tiles for tables — render a small stool on each so
      // the player can see why those tiles are off-limits to other builds.
      // Backrest points away from the table centre. Same alpha as the body
      // so non-functional tables dim their seats too.
      if (obj.seats.length > 0 && ts >= 10) {
        const tCx = obj.col + obj.w / 2;
        const tCy = obj.row + obj.h / 2;
        for (const s of obj.seats) {
          const dx  = tCx - (s.x + 0.5);
          const dy  = tCy - (s.y + 0.5);
          const len = Math.hypot(dx, dy);
          const dxN = len > 0 ? dx / len : 0;
          const dyN = len > 0 ? dy / len : 0;
          paintSeat(g, baseX + s.x * ts, baseY + s.y * ts, ts, alpha, dxN, dyN);
        }
      }

      // Subtle red corner mark for non-functional objects so the dim
      // alpha isn't the only signal.
      if (!isFunc) {
        const m = Math.max(2, Math.round(ts * 0.18));
        g.fillStyle(0xff5050, 0.85);
        g.fillRect(baseX + obj.col * ts + 1, baseY + obj.row * ts + 1, m, m);
      }

      // Wall services keep a small letter label so they're unambiguous.
      const labelText = _wallLabel(obj.type);
      if (labelText) {
        usedIds.add(obj.id);
        let txt = this.labelPool.get(obj.id);
        if (!txt) {
          txt = this.add.text(0, 0, labelText, {
            fontSize: '11px', color: '#fff', fontFamily: 'monospace',
          }).setDepth(2);
          this.labelPool.set(obj.id, txt);
        }
        const visible = ts >= 14;
        txt.setVisible(visible);
        txt.setAlpha(isFunc ? 0.95 : 0.55);
        if (visible) {
          const cx = baseX + (obj.col + obj.w / 2) * ts;
          const cy = baseY + (obj.row + obj.h / 2) * ts;
          txt.setOrigin(0.5, 0.5);
          txt.setPosition(cx, cy);
        }
      }
    }

    // Destroy labels for removed objects
    for (const [id, txt] of this.labelPool) {
      if (!usedIds.has(id)) { txt.destroy(); this.labelPool.delete(id); }
    }

    // 3. Placement ghost — render the actual shape under a green/red tint
    // and a colored frame, so rotation and footprint read instantly. The
    // shape is drawn with the current facing so the cabinet/chair split
    // and the table dealer band rotate live with R / right-click. For
    // slots the cabinet stays under the cursor and only the chair rotates.
    if (this.placing && this.ghostCol >= 0) {
      const { w, h } = GC.dimsFor(this.placeType as GC.ObjType, this.placeFacing);
      const a   = this._placeAnchor(this.ghostCol, this.ghostRow);
      const gx  = baseX + a.col * ts;
      const gy  = baseY + a.row * ts;

      paintObject(
        g, this.placeType as GC.ObjType, gx, gy, w * ts, h * ts,
        0.6, null, this.placeFacing, this.placeVar,
      );

      // Color overlay
      g.fillStyle(this.ghostOk ? 0x33e64d : 0xe63333, 0.28);
      g.fillRect(gx, gy, w * ts, h * ts);

      // Outline frame
      g.lineStyle(2, this.ghostOk ? 0x33e64d : 0xe63333, 1);
      g.strokeRect(gx + 1, gy + 1, w * ts - 2, h * ts - 2);

      // Seat / use markers — small dots on the tiles guests will target.
      // Helps the player see which side of a table will host players, and
      // confirms which slot tile is the chair.
      this._drawGhostSeats(g, gx, gy, ts);
    }

    // 4. Demolish overlay
    if (this.demolishing) {
      for (const obj of gameState.placedObjs) {
        g.fillStyle(0xff3333, 0.32);
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

  // Phase V1 carpet/lobby tile painter. WALL and BLOCKED keep the legacy
  // solid fill. FLOOR gets a 2×2 deterministic carpet weave: every other
  // 2×2 group of tiles gets a low-alpha COL_FLOOR_ALT overlay so the
  // floor reads as a real carpet instead of one flat colour. LOBBY swaps
  // the muted brown for a richer red base with a thin gold border accent,
  // suggesting an entrance carpet runner. All effects degrade gracefully
  // below ts < 14 — at the smallest zoom only the base colours render so
  // the floor never looks noisy.
  private _paintTile(
    g: Phaser.GameObjects.Graphics,
    t: GC.Tile,
    col: number, row: number,
    baseX: number, baseY: number, ts: number,
  ): void {
    const x = baseX + col * ts;
    const y = baseY + row * ts;
    const w = ts - 1;
    const h = ts - 1;
    const detail = ts >= 14;

    if (t.tile_type === GC.TileType.WALL) {
      g.fillStyle(GC.COL_WALL, 1);
      g.fillRect(x, y, w, h);
      return;
    }
    if (t.tile_type === GC.TileType.BLOCKED) {
      g.fillStyle(GC.COL_BLOCKED, 1);
      g.fillRect(x, y, w, h);
      return;
    }
    if (t.tile_type === GC.TileType.LOBBY) {
      g.fillStyle(GC.COL_LOBBY_BASE, 1);
      g.fillRect(x, y, w, h);
      if (detail) {
        // Gold top + bottom stripes — reads as a carpet runner edge.
        g.fillStyle(GC.COL_LOBBY_ALT, 0.55);
        g.fillRect(x + 1, y + 1, w - 2, 1);
        g.fillRect(x + 1, y + h - 2, w - 2, 1);
        // Subtle deterministic inner weave on alternating tiles so the
        // lobby has visible texture without being noisy.
        if (((col + row) & 1) === 0) {
          const m = Math.max(2, Math.round(ts * 0.22));
          g.fillStyle(GC.COL_LOBBY_ALT, 0.10);
          g.fillRect(x + m, y + m, Math.max(1, w - 2 * m), Math.max(1, h - 2 * m));
        }
      } else {
        // At small zoom, a single thin gold edge still marks the lobby
        // boundary without adding visual noise.
        g.fillStyle(GC.COL_LOBBY_ALT, 0.45);
        g.fillRect(x, y, w, 1);
      }
      return;
    }

    // FLOOR — carpet base + a soft 2×2-group weave overlay.
    g.fillStyle(GC.COL_FLOOR, 1);
    g.fillRect(x, y, w, h);
    if (detail) {
      const altGroup = (((col >> 1) + (row >> 1)) & 1) === 0;
      if (altGroup) {
        g.fillStyle(GC.COL_FLOOR_ALT, 0.28);
        g.fillRect(x, y, w, h);
      }
      // Tiny darker pip in the top-left of every tile — implies grout
      // between carpet sections without any geometry change.
      g.fillStyle(GC.COL_SHADOW, 0.18);
      g.fillRect(x, y, 1, 1);
    }
  }

  private _setCursor(cursor: string): void {
    this.sys.game.canvas.style.cursor = cursor;
  }

  // Marks the seat / use tiles for the placement ghost. For slots that's
  // the chair tile inside the footprint; for tables it's the open-floor
  // tiles around the 3 player sides. Wall services don't need this — the
  // door cutout already communicates the use side.
  private _drawGhostSeats(
    g: Phaser.GameObjects.Graphics, gx: number, gy: number, ts: number,
  ): void {
    const t = this.placeType as GC.ObjType;
    const a = this._placeAnchor(this.ghostCol, this.ghostRow);
    if (t === GC.ObjType.SLOT_MACHINE) {
      const { seat } = GC.slotParts(a.col, a.row, this.placeFacing);
      const cx = gx + (seat.x - a.col + 0.5) * ts;
      const cy = gy + (seat.y - a.row + 0.5) * ts;
      g.lineStyle(2, 0xffffff, 0.7);
      g.strokeCircle(cx, cy, Math.max(2, ts * 0.18));
      return;
    }
    if (!GC.isTableLike(t)) return;

    const { w, h } = GC.dimsFor(t, this.placeFacing);
    const playerSides = GC.tablePlayerSides(this.placeFacing);
    // Same paintSeat glyph as placed tables, just with reduced alpha so it
    // reads as "preview". Backrest points away from the table centre.
    const tCx = a.col + w / 2;
    const tCy = a.row + h / 2;
    const seat = (col: number, row: number) => {
      const px = gx + (col - a.col) * ts;
      const py = gy + (row - a.row) * ts;
      const dx = tCx - (col + 0.5);
      const dy = tCy - (row + 0.5);
      const len = Math.hypot(dx, dy);
      const dxN = len > 0 ? dx / len : 0;
      const dyN = len > 0 ? dy / len : 0;
      paintSeat(g, px, py, ts, 0.6, dxN, dyN);
    };
    for (const side of playerSides) {
      if (side === 'N')      for (let c = 0; c < w; c++) seat(a.col + c, a.row - 1);
      else if (side === 'S') for (let c = 0; c < w; c++) seat(a.col + c, a.row + h);
      else if (side === 'W') for (let r2 = 0; r2 < h; r2++) seat(a.col - 1, a.row + r2);
      else                   for (let r2 = 0; r2 < h; r2++) seat(a.col + w, a.row + r2);
    }
  }

  // Find which side of a placed wall-service borders the wall. Returns
  // null only if the placement somehow no longer borders any wall (which
  // PlacementValidator prevents in the first place).
  private _detectWallSide(obj: GC.PlacedObj): WallSide | null {
    const tiles = gameState.tiles;
    if (this._sideAllWall(tiles, obj.col, obj.row - 1, obj.w, 1))      return 'N';
    if (this._sideAllWall(tiles, obj.col, obj.row + obj.h, obj.w, 1))  return 'S';
    if (this._sideAllWall(tiles, obj.col - 1, obj.row, 1, obj.h))      return 'W';
    if (this._sideAllWall(tiles, obj.col + obj.w, obj.row, 1, obj.h))  return 'E';
    return null;
  }

  private _sideAllWall(tiles: GC.Tile[], col: number, row: number, w: number, h: number): boolean {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) {
        if (c < 0 || c >= GC.GRID_COLS || r < 0 || r >= GC.GRID_ROWS) return false;
        if (tiles[r * GC.GRID_COLS + c].tile_type !== GC.TileType.WALL) return false;
      }
    }
    return true;
  }

  // Phaser per-frame hook — only used to drive the guest visual layer.
  // Grid tiles/objects redraw on state events (cheaper, static when idle).
  update(_: number, dtMs: number): void {
    if (!this.guests) return;
    const baseX = this.ox;
    const baseY = this.oy + GRID_AREA_Y;
    this.guests.update(dtMs, time.speed, baseX, baseY, this.tileSize);
  }
}

function _wallLabel(type: GC.ObjType): string {
  switch (type) {
    case GC.ObjType.WC:      return 'WC';
    case GC.ObjType.BAR:     return 'BAR';
    case GC.ObjType.CASHIER: return '$';
    case GC.ObjType.ATM:     return 'ATM';
  }
  return '';
}
