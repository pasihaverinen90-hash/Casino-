// CameraControllerV2.ts — pan/zoom camera for Presentation V2.
//
// Owns (offsetX, offsetY, tileSize) and exposes them as read-only fields.
// Pan: pointer drag past a threshold updates offsets. Zoom: mouse wheel
// changes tileSize and re-anchors so the projected world position under the
// cursor stays under the cursor. Clamps against ProjectionV2.projectedBounds()
// so the grid never disappears entirely.
//
// Tells the scene when state changed via an onChange callback — caller
// repaints. The controller does not own a Graphics object or call gameState.
//
// No placement, no hit-testing, no input handlers beyond pan/zoom. Click
// dispatch lands in InputControllerV2 (Phase 7).
import Phaser from 'phaser';
import * as GC from '../../logic/GameConstants';
import * as Proj from '../render/ProjectionV2';

const TILE_DEFAULT = 28;
const TILE_MIN     = 10;
const TILE_MAX     = 64;
const DRAG_THRESHOLD_PX = 6;

export class CameraControllerV2 {
  offsetX  = 0;
  offsetY  = 0;
  tileSize = TILE_DEFAULT;

  private scene    : Phaser.Scene;
  private onChange : () => void;

  private dragStartX  = 0;
  private dragStartY  = 0;
  private dragStartOX = 0;
  private dragStartOY = 0;
  private dragging    = false;

  // Bound handler kept so we can removeEventListener on destroy.
  private _wheelHandler: (e: WheelEvent) => void;

  constructor(scene: Phaser.Scene, onChange: () => void) {
    this.scene    = scene;
    this.onChange = onChange;

    // Initial framing: centre the projected bounds in the canvas. Done
    // before any input wiring so the first paint is correctly framed.
    this._centreOnGrid();

    scene.input.on('pointerdown', this._onPointerDown, this);
    scene.input.on('pointermove', this._onPointerMove, this);
    scene.input.on('pointerup',   this._onPointerUp,   this);

    // Native wheel listener so we can call preventDefault — without this
    // the page scrolls instead of zooming. Mirrors V1 GridScene's pattern.
    this._wheelHandler = (e: WheelEvent) => this._onWheel(e);
    scene.sys.game.canvas.addEventListener('wheel', this._wheelHandler, { passive: false });
  }

  // Called by the scene when the window resizes — we re-centre rather than
  // try to preserve the old offset, because the visible area changed.
  onResize(): void {
    this._centreOnGrid();
    this.onChange();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this._onPointerDown, this);
    this.scene.input.off('pointermove', this._onPointerMove, this);
    this.scene.input.off('pointerup',   this._onPointerUp,   this);
    this.scene.sys.game.canvas.removeEventListener('wheel', this._wheelHandler);
  }

  // ── Pan ───────────────────────────────────────────────────────────────────

  private _onPointerDown(ptr: Phaser.Input.Pointer): void {
    this.dragStartX  = ptr.x;
    this.dragStartY  = ptr.y;
    this.dragStartOX = this.offsetX;
    this.dragStartOY = this.offsetY;
    this.dragging    = false;
  }

  private _onPointerMove(ptr: Phaser.Input.Pointer): void {
    if (!ptr.isDown) return;
    const dx = ptr.x - this.dragStartX;
    const dy = ptr.y - this.dragStartY;
    if (!this.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    this.dragging = true;
    this.offsetX  = this.dragStartOX + dx;
    this.offsetY  = this.dragStartOY + dy;
    this._clamp();
    this.onChange();
  }

  private _onPointerUp(_ptr: Phaser.Input.Pointer): void {
    this.dragging = false;
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();

    // Convert the browser event coordinates into Phaser logical pixels —
    // accounts for any CSS scaling on the canvas (high-DPI etc.).
    const canvas = this.scene.sys.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = rect.width  / this.scene.scale.width;
    const scaleY = rect.height / this.scene.scale.height;
    const mx = (e.clientX - rect.left) / scaleX;
    const my = (e.clientY - rect.top)  / scaleY;

    const oldTs = this.tileSize;
    const sign  = e.deltaY < 0 ? 1 : -1;
    // Step scales with current size for a smooth zoom feel at all levels.
    const step  = Math.max(1, Math.round(oldTs * 0.08));
    const newTs = Math.max(TILE_MIN, Math.min(TILE_MAX, oldTs + sign * step));
    if (newTs === oldTs) return;

    // Anchor: keep the world coordinate under the cursor fixed.
    const worldBefore = Proj.screenToWorld(mx - this.offsetX, my - this.offsetY, oldTs);
    this.tileSize = newTs;
    const screenAfter = Proj.worldToScreen(worldBefore.colFloat, worldBefore.rowFloat, newTs);
    this.offsetX = mx - screenAfter.x;
    this.offsetY = my - screenAfter.y;

    this._clamp();
    this.onChange();
  }

  // ── Framing helpers ───────────────────────────────────────────────────────

  // Position the projected bounds at the canvas centre. Used on construction
  // and on window resize.
  private _centreOnGrid(): void {
    const b = Proj.projectedBounds(GC.GRID_COLS, GC.GRID_ROWS, this.tileSize);
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.offsetX = (w - b.width)  / 2 - b.minX;
    this.offsetY = (h - b.height) / 2 - b.minY;
  }

  // Clamp the offset so the projected grid keeps at least padX/padY of its
  // body inside the canvas — V1's "generous pan" behaviour: half-canvas pad
  // on each axis, so the user can push the grid mostly off-screen but never
  // lose it entirely.
  private _clamp(): void {
    const b     = Proj.projectedBounds(GC.GRID_COLS, GC.GRID_ROWS, this.tileSize);
    const viewW = this.scene.scale.width;
    const viewH = this.scene.scale.height;
    const padX  = viewW * 0.5;
    const padY  = viewH * 0.5;

    const minOX = padX - b.maxX;
    const maxOX = viewW - padX - b.minX;
    const minOY = padY - b.maxY;
    const maxOY = viewH - padY - b.minY;

    if (this.offsetX < minOX) this.offsetX = minOX;
    if (this.offsetX > maxOX) this.offsetX = maxOX;
    if (this.offsetY < minOY) this.offsetY = minOY;
    if (this.offsetY > maxOY) this.offsetY = maxOY;
  }
}
