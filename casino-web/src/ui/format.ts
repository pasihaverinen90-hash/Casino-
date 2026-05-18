// format.ts — shared player-facing number formatters.
//
// All money values in the game are kept as precise floats internally (the
// hourly drip accumulates fractional cash). UI must always floor + group
// before display, otherwise rows render as "1234.5678901234".

export function fmtCash(v: number): string {
  const n = Math.floor(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}`;
  return String(n);
}

// Signed cash: explicit + for non-negative, − for negative. Uses fmtCash on
// the magnitude so big numbers still abbreviate.
export function fmtSignedCash(v: number): string {
  if (v < 0) return `−${fmtCash(-v)}`;
  return `+${fmtCash(v)}`;
}

export function fmtInt(v: number): string {
  return String(Math.round(v));
}

// Percent expects a 0..1 ratio in. Rounded to whole percent for compact rows.
export function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export function fmtRating(v: number): string {
  return v.toFixed(1);
}

// Hotel occupancy percent grounded in actual booked rooms vs total rooms.
// Independent of the underlying demand `occupancyRate` (a 0..1 fraction
// that can round to 99% while booked = floor(rooms * rate) only fills 11
// of 12 rooms). Clamped 0..100 and rounded for compact display.
export function occupancyPct(booked: number, roomCount: number): number {
  if (!Number.isFinite(roomCount) || roomCount <= 0) return 0;
  const pct = Math.round((booked / roomCount) * 100);
  return Math.max(0, Math.min(100, pct));
}

// "B / R · P%" string used by both HotelPanelV2 and StatsPanelV2 so the
// count and percent never disagree.
export function fmtOccupancy(booked: number, roomCount: number): string {
  if (roomCount <= 0) return '0 / 0 · 0%';
  return `${booked} / ${roomCount} · ${occupancyPct(booked, roomCount)}%`;
}
