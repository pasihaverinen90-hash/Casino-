// TimeController.ts — drives auto day progression.
// Owns the speed (0 paused, 1 = 1×, 2 = 2×) and a wall-clock interval that
// fires `onTick` every DAY_DURATION_SEC seconds of accumulated game-time.
import * as GC from '../logic/GameConstants';

export type Speed = 0 | 1 | 2;

export class TimeController {
  speed: Speed = 1;
  onChange: ((s: Speed) => void) | null = null;

  private _accum      = 0;
  private _onTick     : () => void;
  // Auto-pause stash: speed at the moment a Build/Hotel panel opened.
  // null means we are not currently auto-paused.
  private _savedSpeed : Speed | null = null;

  constructor(onTick: () => void) {
    this._onTick = onTick;
    setInterval(() => this._step(), 1000);
  }

  setSpeed(s: Speed): void {
    // Any explicit user action ends the auto-pause: closing the panel
    // afterwards must not override what the user just chose.
    this._savedSpeed = null;
    if (this.speed === s) return;
    this.speed = s;
    this.onChange?.(s);
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  // Auto-pause when Build/Hotel panels open. Idempotent: repeated true (or
  // panel-to-panel switches) won't overwrite the saved speed.
  setAutoPause(active: boolean): void {
    if (active) {
      if (this._savedSpeed !== null) return;          // already auto-paused
      this._savedSpeed = this.speed;
      if (this.speed === 0) return;                   // already at zero — nothing to broadcast
      this.speed = 0;
      this.onChange?.(0);
    } else {
      if (this._savedSpeed === null) return;          // nothing to restore
      const restore = this._savedSpeed;
      this._savedSpeed = null;
      if (this.speed === restore) return;
      this.speed = restore;
      this.onChange?.(restore);
    }
  }

  private _step(): void {
    if (this.speed === 0) return;
    this._accum += this.speed;
    while (this._accum >= GC.DAY_DURATION_SEC) {
      this._accum -= GC.DAY_DURATION_SEC;
      this._onTick();
    }
  }
}
