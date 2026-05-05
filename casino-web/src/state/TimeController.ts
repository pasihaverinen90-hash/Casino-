// TimeController.ts — drives in-game time.
// Owns the speed and the wall-clock interval, and emits three event channels:
//   • 'speed' — speed changed (for UI highlighting)
//   • 'second' — once per real-time second (for cash drip)
//   • 'clock' — half-hour boundary crossed within the day (for clock UI)
//   • 'day_end' — a full in-game day has elapsed (for stats rollup)
// Time logic is deliberately UI-free: GameState/UI subscribe to events.
import * as GC from '../logic/GameConstants';
import { EventEmitter } from './EventEmitter';

export type Speed = 0 | 1 | 2 | 4;

// 100 ms tick is fine enough that half-hours (0.125 real-sec at 4×) still
// fire smoothly, and coarse enough to be cheap on idle tabs.
const TICK_MS = 100;

const HALF_HOURS_PER_DAY = 48;
const HALF_HOUR_GAME_SEC = GC.DAY_DURATION_SEC / HALF_HOURS_PER_DAY; // 0.5s at 1×

class TimeController extends EventEmitter {
  speed: Speed = 0;

  // In-day game time, 0..DAY_DURATION_SEC.
  private _gameSec     = 0;
  // 0..47 inside the current day. Resets at day rollover.
  private _halfHourIdx = 0;
  // Real-time second accumulator (independent of speed).
  private _secAccum    = 0;

  constructor() {
    super();
    setInterval(() => this._step(), TICK_MS);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setSpeed(s: Speed): void {
    if (this.speed === s) return;
    this.speed = s;
    this.emit('speed', s);
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  get gameSec(): number     { return this._gameSec; }
  get halfHourIdx(): number { return this._halfHourIdx; }

  // Reset the in-day clock — called when a slot is loaded / new game starts
  // so the player always sees 00:00 at the start of a session day.
  resetClock(): void {
    this._gameSec     = 0;
    this._halfHourIdx = 0;
    this._secAccum    = 0;
    this.emit('clock', 0);
  }

  // ── Internal tick ─────────────────────────────────────────────────────────

  private _step(): void {
    if (this.speed === 0) return;
    const dtReal = TICK_MS / 1000;

    // 1) Per-real-second drip (independent of speed cadence — fires once per
    //    real second whenever time is running). Speed is forwarded so the
    //    listener can scale the increment.
    this._secAccum += dtReal;
    while (this._secAccum >= 1) {
      this._secAccum -= 1;
      this.emit('second', this.speed);
    }

    // 2) Game-time advance, scaled by speed.
    this._gameSec += dtReal * this.speed;

    // 3) Half-hour clock ticks — emit each crossed boundary.
    while (
      this._halfHourIdx < HALF_HOURS_PER_DAY - 1 &&
      this._gameSec >= (this._halfHourIdx + 1) * HALF_HOUR_GAME_SEC
    ) {
      this._halfHourIdx++;
      this.emit('clock', this._halfHourIdx);
    }

    // 4) Day rollover — wrap and emit.
    if (this._gameSec >= GC.DAY_DURATION_SEC) {
      this._gameSec    -= GC.DAY_DURATION_SEC;
      this._halfHourIdx = 0;
      this.emit('day_end');
      this.emit('clock', 0);
    }
  }
}

// Singleton — mirrors the gameState / uiBus pattern. UI and GameState
// import this directly.
export const time = new TimeController();

// Format a half-hour index 0..47 as "HH:MM" — used by TopHUD.
export function fmtClock(idx: number): string {
  const safeIdx = Math.max(0, Math.min(HALF_HOURS_PER_DAY - 1, idx));
  const h = Math.floor(safeIdx / 2);
  const m = (safeIdx % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
