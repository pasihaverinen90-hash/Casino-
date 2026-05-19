// InputControllerV2.ts — pointer + keyboard input for Presentation V2.
//
// Owns placement / demolish / hover state and converts pointer
// coordinates to grid coordinates through ProjectionV2. Event contracts:
//   uiBus → 'start_placement' / 'exit_placement' / 'toggle_demolish'
//   uiBus ← 'placement_confirmed' / 'placement_cancelled' /
//           'demolish_cancelled' / 'object_tapped'
// Validation goes through PlacementValidator and commit through
// gameState.tryPlace / gameState.demolish — this controller never
// duplicates placement rules. The only renderer-specific UX is wall-
// service snap (cursor near the N or W wall snaps the anchor to that
// wall), which is purely a convenience and never bypasses the validator.
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as PV from '../../logic/PlacementValidator';
import { gameState } from '../../state/GameState';
import { uiBus } from '../../events/UIBus';
import * as Proj from '../render/ProjectionV2';
import { CameraControllerV2 } from './CameraControllerV2';
import { GuestVisualControllerV2 } from '../guests/GuestVisualControllerV2';

export interface PlacementGhostV2 {
  active : boolean;
  type   : GC.ObjType;
  variant: string;
  col    : number;
  row    : number;
  w      : number;
  h      : number;
  facing : GC.Orientation;
  ok     : boolean;
  message: string;
}

// Snap a wall-service cursor toward the N or W wall when the cursor
// is within this many tile-rows / columns of the wall plane.
const WALL_SNAP_TILES = 4;

// Drag threshold (screen px). Distinguishes a click from a pan so a
// small jitter while clicking still registers as a tap.
const DRAG_THRESHOLD_PX = 6;

type ChangeCb = () => void;

export class InputControllerV2 {
  // ── Placement state ─────────────────────────────────────────────────────
  private placing      = false;
  private placeType    : GC.ObjType = GC.ObjType.SLOT_MACHINE;
  private placeVariant = '';
  private placeFacing  : GC.Orientation = 'S';
  // Last cursor tile (integer). -1 when off-grid.
  private cursorCol    = -1;
  private cursorRow    = -1;
  // Cached ghost — recomputed in _revalidateGhost.
  private ghost        : PlacementGhostV2 | null = null;

  // ── Demolish / hover ────────────────────────────────────────────────────
  private demolishing  = false;
  private hoveredObjId : string | null = null;

  // ── Drag tracking (separate from CameraControllerV2's own state) ────────
  // Used to distinguish a click from a pan. Both controllers track this
  // independently against the same pointer events, then only this one's
  // value gates _tap().
  private dragStartX   = 0;
  private dragStartY   = 0;
  private dragged      = false;

  // ── Wiring ──────────────────────────────────────────────────────────────
  private scene    : Phaser.Scene;
  private camera   : CameraControllerV2;
  private guests   : GuestVisualControllerV2;
  private onChange : ChangeCb;

  // Bound listeners (so we can off() cleanly).
  private _onStartPlacement = (e: { type: number; variant: string }): void => {
    this.placing      = true;
    this.placeType    = e.type as GC.ObjType;
    this.placeVariant = e.variant;
    this.placeFacing  = 'S';      // default facing
    this.demolishing  = false;
    this.cursorCol    = -1;
    this.cursorRow    = -1;
    this.ghost        = null;
    this._setCursor('crosshair');
    this.onChange();
  };

  private _onExitPlacement = (): void => {
    if (!this.placing) return;
    this.placing   = false;
    this.cursorCol = -1;
    this.cursorRow = -1;
    this.ghost     = null;
    this._setCursor('default');
    this.onChange();
  };

  private _onToggleDemolish = (enabled: boolean): void => {
    this.demolishing = enabled;
    if (enabled) {
      // Demolish cancels any in-progress placement.
      this.placing   = false;
      this.cursorCol = -1;
      this.cursorRow = -1;
      this.ghost     = null;
    } else {
      this.hoveredObjId = null;
    }
    this._setCursor(enabled ? 'no-drop' : 'default');
    this.onChange();
  };

  private _onPointerDown = (ptr: Phaser.Input.Pointer): void => {
    if (!this._inGridArea(ptr.y)) return;
    this.dragStartX = ptr.x;
    this.dragStartY = ptr.y;
    this.dragged    = false;

    // Right-click rotates the ghost.
    if (ptr.rightButtonDown() && this.placing) {
      this.placeFacing = GC.nextFacing(this.placeFacing);
      this._updateGhost(ptr.x, ptr.y);
      this.onChange();
    }
  };

  private _onPointerMove = (ptr: Phaser.Input.Pointer): void => {
    if (ptr.isDown) {
      const dx = ptr.x - this.dragStartX;
      const dy = ptr.y - this.dragStartY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) this.dragged = true;
      if (this.dragged && this._inGridArea(ptr.y)) {
        // Dragging — update ghost + hover so they follow the pan.
        if (this.placing) this._updateGhost(ptr.x, ptr.y);
        if (this.demolishing) this._updateHover(ptr.x, ptr.y);
        this.onChange();
      }
      return;
    }
    // Mouse hover (no button) — update ghost or hover only.
    if (!this._inGridArea(ptr.y)) return;
    if (this.placing) {
      this._updateGhost(ptr.x, ptr.y);
      this.onChange();
    } else if (this.demolishing) {
      this._updateHover(ptr.x, ptr.y);
      this.onChange();
    } else {
      // Plain hover for selection feedback (no demolish, no placement).
      const prev = this.hoveredObjId;
      this._updateHover(ptr.x, ptr.y);
      if (prev !== this.hoveredObjId) this.onChange();
    }
  };

  private _onPointerUp = (ptr: Phaser.Input.Pointer): void => {
    if (!this.dragged && this._inGridArea(ptr.y)) this._tap(ptr);
    this.dragged = false;
  };

  private _onKeydownEsc = (): void => {
    if (this.placing) {
      this.placing   = false;
      this.cursorCol = -1;
      this.cursorRow = -1;
      this.ghost     = null;
      this._setCursor('default');
      uiBus.emit('placement_cancelled');
      this.onChange();
    } else if (this.demolishing) {
      this.demolishing  = false;
      this.hoveredObjId = null;
      this._setCursor('default');
      uiBus.emit('demolish_cancelled');
      this.onChange();
    }
  };

  private _onKeydownR = (event: KeyboardEvent): void => {
    // Skip Ctrl+Shift+R (reserved for the dev rating-breakdown shortcut).
    if (event.ctrlKey && event.shiftKey) return;
    if (!this.placing) return;
    this.placeFacing = GC.nextFacing(this.placeFacing);
    if (this.cursorCol >= 0) this._revalidateGhost();
    this.onChange();
  };

  constructor(
    scene: Phaser.Scene,
    camera: CameraControllerV2,
    guests: GuestVisualControllerV2,
    onChange: ChangeCb,
  ) {
    this.scene    = scene;
    this.camera   = camera;
    this.guests   = guests;
    this.onChange = onChange;

    // uiBus listeners — the BuildPanelV2 / BottomBarV2 contracts.
    uiBus.on('start_placement',   this._onStartPlacement);
    uiBus.on('exit_placement',    this._onExitPlacement);
    uiBus.on('toggle_demolish',   this._onToggleDemolish);

    // Phaser pointer events — fire in parallel with CameraControllerV2's
    // own pan handlers. Each controller tracks its own drag state.
    scene.input.on('pointerdown', this._onPointerDown, this);
    scene.input.on('pointermove', this._onPointerMove, this);
    scene.input.on('pointerup',   this._onPointerUp,   this);

    // Keyboard — R rotates the ghost, Esc cancels placement / demolish.
    scene.input.keyboard?.on('keydown-ESC', this._onKeydownEsc);
    scene.input.keyboard?.on('keydown-R',   this._onKeydownR);

    // Suppress the browser context menu so right-click can rotate.
    scene.input.mouse?.disableContextMenu();
  }

  destroy(): void {
    uiBus.off('start_placement',   this._onStartPlacement);
    uiBus.off('exit_placement',    this._onExitPlacement);
    uiBus.off('toggle_demolish',   this._onToggleDemolish);
    this.scene.input.off('pointerdown', this._onPointerDown, this);
    this.scene.input.off('pointermove', this._onPointerMove, this);
    this.scene.input.off('pointerup',   this._onPointerUp,   this);
    this.scene.input.keyboard?.off('keydown-ESC', this._onKeydownEsc);
    this.scene.input.keyboard?.off('keydown-R',   this._onKeydownR);
    this._setCursor('default');
  }

  // ── Public read-only accessors for the renderers ────────────────────────

  getGhost(): PlacementGhostV2 | null { return this.ghost; }
  isDemolishing(): boolean            { return this.demolishing; }
  getHoveredObjId(): string | null    { return this.hoveredObjId; }

  // ── Pointer → grid conversion ───────────────────────────────────────────

  // Approximate "inside grid area" check — input applies anywhere on
  // the canvas (the HTML overlays sit above the canvas and handle their
  // own pointer events).
  private _inGridArea(py: number): boolean {
    return py >= 0 && py < this.scene.scale.height;
  }

  // Convert canvas pixel to grid (col, row). Null when outside the grid.
  private _toTile(px: number, py: number): { col: number; row: number } | null {
    const sx = px - this.camera.offsetX;
    const sy = py - this.camera.offsetY;
    const w  = Proj.screenToWorld(sx, sy, this.camera.tileSize);
    const col = Math.floor(w.colFloat);
    const row = Math.floor(w.rowFloat);
    if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return null;
    return { col, row };
  }

  // Convert a cursor tile to the placement anchor (bounds top-left)
  // the validator and gameState.tryPlace expect. Slots + tables use
  // the shared GameConstants helpers; wall services use wall-snap UX.
  private _placeAnchor(curCol: number, curRow: number): { col: number; row: number } {
    const type = this.placeType;
    if (type === GC.ObjType.SLOT_MACHINE) {
      const tl = GC.slotAnchorFromCursor(curCol, curRow, this.placeFacing);
      return { col: tl.x, row: tl.y };
    }
    if (GC.isTableLike(type)) {
      const tl = GC.tableAnchorFromCursor(curCol, curRow, type, this.placeFacing);
      return { col: tl.x, row: tl.y };
    }
    const def = GC.getDef(type);
    if (def.is_wall) return this._wallSnapAnchor(curCol, curRow);
    return { col: curCol, row: curRow };
  }

  // Which buildable wall the cursor is currently nearest to, or null if
  // outside the snap radius. Drives both the snap anchor and the
  // auto-orient facing logic below so they always agree.
  private _wallSnapSide(curCol: number, curRow: number): 'N' | 'W' | null {
    const nearN = curRow <= WALL_SNAP_TILES;
    const nearW = curCol <= WALL_SNAP_TILES;
    if (nearN && (!nearW || curRow <= curCol)) return 'N';
    if (nearW) return 'W';
    return null;
  }

  // Wall-service auto-orient. Wall services have no genuine "user-
  // chosen" facing — the facing only controls the horiz/vert dimsFor
  // flip and the door-tile axis, both of which must match the wall the
  // service attaches to. Force the facing to match the snapped wall
  // side so the player never has to press R for a valid placement.
  // R is still wired (so the player can dodge a guest standing in the
  // way etc.), but the next hover normalizes the facing back.
  private _autoOrientForWall(curCol: number, curRow: number): void {
    const def = GC.getDef(this.placeType);
    if (!def.is_wall) return;
    const side = this._wallSnapSide(curCol, curRow);
    if      (side === 'N') this.placeFacing = 'S';
    else if (side === 'W') this.placeFacing = 'E';
    // Outside snap radius: leave the user's facing alone so the
    // validator rejects cleanly with the existing wall-side toast.
  }

  // Wall-service snap. The N/W-only validator rule rejects S/E walls;
  // this snap is purely UX — when the cursor is near the N or W wall,
  // pin the perpendicular coordinate to row=1 / col=1 so the player
  // doesn't have to find the exact row/col. The validator remains the
  // truth gate: a snap that produces an invalid anchor renders red and
  // tryPlace will refuse it.
  private _wallSnapAnchor(curCol: number, curRow: number): { col: number; row: number } {
    const side = this._wallSnapSide(curCol, curRow);
    if (side === 'N') return { col: curCol, row: 1 };
    if (side === 'W') return { col: 1,      row: curRow };
    // Out of snap radius — leave at cursor; validator will reject.
    return { col: curCol, row: curRow };
  }

  // ── Ghost state ─────────────────────────────────────────────────────────

  private _updateGhost(px: number, py: number): void {
    const coord = this._toTile(px, py);
    if (!coord) {
      this.cursorCol = -1;
      this.cursorRow = -1;
      this.ghost     = null;
      return;
    }
    this.cursorCol = coord.col;
    this.cursorRow = coord.row;
    this._revalidateGhost();
  }

  private _revalidateGhost(): void {
    if (this.cursorCol < 0) { this.ghost = null; return; }
    // Normalize facing for wall services BEFORE computing the anchor,
    // since dimsFor (used by _placeAnchor) depends on facing.
    this._autoOrientForWall(this.cursorCol, this.cursorRow);
    const a = this._placeAnchor(this.cursorCol, this.cursorRow);
    const { w, h } = GC.dimsFor(this.placeType, this.placeFacing);
    const result = PV.validate(
      { type: this.placeType, col: a.col, row: a.row, facing: this.placeFacing },
      gameState.tiles, gameState.cash, gameState.barExists,
      gameState.isUnlocked(this.placeType),
    );
    this.ghost = {
      active : true,
      type   : this.placeType,
      variant: this.placeVariant,
      col    : a.col,
      row    : a.row,
      w, h,
      facing : this.placeFacing,
      ok     : result === GC.ValResult.VALID,
      message: GC.valMessage(result),
    };
  }

  // ── Hover ────────────────────────────────────────────────────────────────

  private _updateHover(px: number, py: number): void {
    const coord = this._toTile(px, py);
    this.hoveredObjId = coord ? this._objectAtTile(coord.col, coord.row) : null;
  }

  // Tile → object id via the existing tile.obj_id index that GameState
  // already maintains for every footprint tile (and reserved seat tile).
  // Fast O(1) — no scan over placedObjs.
  private _objectAtTile(col: number, row: number): string | null {
    if (col < 0 || col >= GC.GRID_COLS || row < 0 || row >= GC.GRID_ROWS) return null;
    const t = gameState.tiles[row * GC.GRID_COLS + col];
    return t.obj_id || null;
  }

  // ── Tap / commit ────────────────────────────────────────────────────────

  private _tap(ptr: Phaser.Input.Pointer): void {
    const coord = this._toTile(ptr.x, ptr.y);
    if (!coord) return;

    if (this.placing) {
      this._commitPlacement(ptr, coord);
      return;
    }
    if (this.demolishing) {
      const id = this._objectAtTile(coord.col, coord.row);
      if (id) gameState.demolish(id);
      return;
    }
    const id = this._objectAtTile(coord.col, coord.row);
    if (id) uiBus.emit('object_tapped', id);
  }

  private _commitPlacement(
    ptr: Phaser.Input.Pointer, coord: { col: number; row: number },
  ): void {
    // Same auto-orient applied during hover — also belt-and-suspenders for
    // commits that fire without an intervening hover (e.g. tap right after
    // start_placement with the cursor already over the wall).
    this._autoOrientForWall(coord.col, coord.row);
    const a       = this._placeAnchor(coord.col, coord.row);
    const objType = this.placeType;

    // Pre-validate so we don't displace guests for a placement that will
    // fail anyway (lets gameState.tryPlace emit its own canonical
    // failure toast).
    const pre = PV.validate(
      { type: objType, col: a.col, row: a.row, facing: this.placeFacing },
      gameState.tiles, gameState.cash, gameState.barExists,
      gameState.isUnlocked(objType),
    );
    if (pre === GC.ValResult.VALID) {
      const blocked = this._computeBlockedTiles(objType, a.col, a.row, this.placeFacing);
      this.guests.displaceGuestsFromTiles(blocked);
    }

    const ok = gameState.tryPlace(a.col, a.row, objType, this.placeFacing, this.placeVariant);
    if (ok) {
      // Ctrl-click keeps placement mode open for repeated placements.
      const ev   = ptr.event as MouseEvent | PointerEvent | undefined;
      const ctrl = !!(ev && ev.ctrlKey);
      if (!ctrl) {
        this.placing   = false;
        this.cursorCol = -1;
        this.cursorRow = -1;
        this.ghost     = null;
        this._setCursor('default');
        uiBus.emit('placement_confirmed');
      } else {
        this._revalidateGhost();
      }
    }
    this.onChange();
  }

  // Tiles that will become unwalkable for visible guests after placement
  // — footprint plus seat reservations for table-likes. The guest layer
  // uses this to step out of the way before tryPlace mutates tiles.
  private _computeBlockedTiles(
    type: GC.ObjType, col: number, row: number, facing: GC.Orientation,
  ): GC.Vec2[] {
    const { w, h } = GC.dimsFor(type, facing);
    const out: GC.Vec2[] = PV.computeFootprint(col, row, w, h);
    if (GC.isTableLike(type)) {
      out.push(...GC.tableSeatTiles(col, row, type, facing));
    }
    return out;
  }

  // ── Cursor styling ──────────────────────────────────────────────────────

  private _setCursor(cursor: string): void {
    const canvas = this.scene.sys.game.canvas;
    if (canvas) canvas.style.cursor = cursor;
  }
}
