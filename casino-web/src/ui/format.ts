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
