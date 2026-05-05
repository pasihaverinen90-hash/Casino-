// TimeController.ts — drives in-game time.
// Owns the speed and the wall-clock interval, and emits four event channels:
//   • 'speed'   — speed changed (for UI highlighting)
//   • 'clock'   — 15-minute boundary crossed within the day (for clock UI)
//   • 'hour'    — 1-hour boundary crossed within the day (for revenue drip)
//   • 'day_end' — a full in-game day has elapsed (for stats rollup)
// Time logic is deliberately UI-free: GameState/UI subscribe to events.
import { EventEmitter } from './EventEmitter';

export type Speed = 0 | 1 | 2 | 4;

// 100 ms tick is fine enough that quarter-hour boundaries (0.25 real-sec at
// 4×) still fire smoothly, and coarse enough to be cheap on idle tabs.
const TICK_MS = 100;

const MIN_PER_DAY     = 1440;
const MIN_PER_QUARTER = 15;
const MIN_PER_HOUR    = 60;
const QUARTERS_PER_DAY = MIN_PER_DAY / MIN_PER_QUARTER; // 96
const HOURS_PER_DAY    = MIN_PER_DAY / MIN_PER_HOUR;    // 24

// Time scale: at 1× speed, 1 real second = 15 in-game minutes.
// → 1 in-game hour = 4 real seconds; 1 in-game day = 96 real seconds.
const GAME_MIN_PER_REAL_SEC_AT_1X = 15;

class TimeController extends EventEmitter {
  speed: Speed = 0;

  // In-day game time, 0..MIN_PER_DAY (in in-game minutes).
  private _gameMin     = 0;
  // 0..QUARTERS_PER_DAY - 1 inside the current day. Resets at day rollover.
  private _quarterIdx  = 0;
  // Count of hour boundaries crossed within the current day (0..24).
  private _hourTicks   = 0;

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

  get gameMin(): number       { return this._gameMin; }
  get quarterHourIdx(): number { return this._quarterIdx; }

  // Reset the in-day clock — called when a slot is loaded / new game starts
  // so the player always sees 00:00 at the start of a session day.
  resetClock(): void {
    this._gameMin    = 0;
    this._quarterIdx = 0;
    this._hourTicks  = 0;
    this.emit('clock', 0);
  }

  // ── Internal tick ─────────────────────────────────────────────────────────

  private _step(): void {
    if (this.speed === 0) return;
    const dtReal = TICK_MS / 1000;

    // Advance in-game minutes scaled by speed.
    this._gameMin += dtReal * this.speed * GAME_MIN_PER_REAL_SEC_AT_1X;

    // Quarter-hour boundaries (drives the visible HH:MM clock).
    while (
      this._quarterIdx < QUARTERS_PER_DAY - 1 &&
      this._gameMin >= (this._quarterIdx + 1) * MIN_PER_QUARTER
    ) {
      this._quarterIdx++;
      this.emit('clock', this._quarterIdx);
    }

    // Hour boundaries (drives the hourly revenue drip).
    while (
      this._hourTicks < HOURS_PER_DAY &&
      this._gameMin >= (this._hourTicks + 1) * MIN_PER_HOUR
    ) {
      this._hourTicks++;
      this.emit('hour', this._hourTicks);
    }

    // Day rollover.
    if (this._gameMin >= MIN_PER_DAY) {
      this._gameMin   -= MIN_PER_DAY;
      this._quarterIdx = 0;
      this._hourTicks  = 0;
      this.emit('day_end');
      this.emit('clock', 0);
    }
  }
}

// Singleton — mirrors the gameState / uiBus pattern. UI and GameState
// import this directly.
export const time = new TimeController();

// Format a quarter-hour index 0..95 as "HH:MM" — used by TopHUD.
export function fmtClock(idx: number): string {
  const safeIdx = Math.max(0, Math.min(QUARTERS_PER_DAY - 1, idx));
  const h = Math.floor(safeIdx / 4);
  const m = (safeIdx % 4) * MIN_PER_QUARTER;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
