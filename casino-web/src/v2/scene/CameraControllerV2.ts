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

// Discrete Hoyle-style zoom levels. Users snap between authored levels
// via the wheel or the on-screen zoom buttons.
//
// Phase 5.4 widened the spread so the far zoom shows the room shell
// nearly end-to-end while the close zoom is meaningfully closer than
// before:
//   0 → 14  far overview     (was 20)
//   1 → 22  medium overview  (was 24)
//   2 → 28  default play zoom (matches Phases 1–5.3 default)
//   3 → 46  close detail zoom (was 36)
export const ZOOM_LEVELS         = [14, 22, 28, 46] as const;
export const DEFAULT_ZOOM_INDEX  = 2;
const DRAG_THRESHOLD_PX          = 6;

export class CameraControllerV2 {
  offsetX  = 0;
  offsetY  = 0;
  // Explicit `number` type — without it, TS infers the literal type
  // `28` from ZOOM_LEVELS[DEFAULT_ZOOM_INDEX] (the array is `as const`)
  // and later assignments from other ZOOM_LEVELS entries fail typecheck.
  tileSize : number = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];

  private scene     : Phaser.Scene;
  private onChange  : () => void;
  private zoomIndex = DEFAULT_ZOOM_INDEX;

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

  canZoomIn(): boolean  { return this.zoomIndex < ZOOM_LEVELS.length - 1; }
  canZoomOut(): boolean { return this.zoomIndex > 0; }

  // Step one level closer (larger tileSize). If anchor coordinates are
  // omitted, the canvas centre is used — that's the right anchor for
  // button clicks, which should feel stable regardless of cursor position.
  zoomIn(anchorX?: number, anchorY?: number): void {
    if (!this.canZoomIn()) return;
    this._applyZoom(this.zoomIndex + 1, anchorX, anchorY);
  }

  zoomOut(anchorX?: number, anchorY?: number): void {
    if (!this.canZoomOut()) return;
    this._applyZoom(this.zoomIndex - 1, anchorX, anchorY);
  }

  private _applyZoom(newIndex: number, anchorX?: number, anchorY?: number): void {
    const oldTs = this.tileSize;
    const newTs = ZOOM_LEVELS[newIndex];
    if (newTs === oldTs) return;

    const mx = anchorX ?? this.scene.scale.width  / 2;
    const my = anchorY ?? this.scene.scale.height / 2;

    // Anchor: keep the world coordinate under the cursor (or canvas centre)
    // fixed across the zoom-level jump.
    const worldBefore = Proj.screenToWorld(mx - this.offsetX, my - this.offsetY, oldTs);
    this.zoomIndex = newIndex;
    this.tileSize  = newTs;
    const screenAfter = Proj.worldToScreen(worldBefore.colFloat, worldBefore.rowFloat, newTs);
    this.offsetX = mx - screenAfter.x;
    this.offsetY = my - screenAfter.y;

    this._clamp();
    this.onChange();
  }

  private _onWheel(e: WheelEvent): void {
    e.preventDefault();

    // Convert browser event coordinates into Phaser logical pixels —
    // accounts for any CSS scaling on the canvas (high-DPI etc.).
    const canvas = this.scene.sys.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = rect.width  / this.scene.scale.width;
    const scaleY = rect.height / this.scene.scale.height;
    const mx = (e.clientX - rect.left) / scaleX;
    const my = (e.clientY - rect.top)  / scaleY;

    if (e.deltaY < 0) this.zoomIn(mx, my);
    else              this.zoomOut(mx, my);
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
