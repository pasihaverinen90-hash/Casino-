// SaveSlots.ts — slot-based save storage for the start screen.
// Three localStorage slots plus a "last used" pointer. The actual save
// payload format is defined by GameState; this module only deals with
// keys, peeking summaries, and migrating any pre-slot legacy save.

const LEGACY_KEY    = 'casino_resort_v1';
const LAST_USED_KEY = 'casino_resort_last_used_slot';

export const SLOT_COUNT = 3;

export function slotKey(slot: number): string {
  return `casino_resort_save_slot_${slot}`;
}

export interface SlotSummary {
  empty   : boolean;
  day?    : number;
  cash?   : number;
  rating? : number;
  guests? : number;
}

// Peek at a slot's save without going through GameState.
export function getSummary(slot: number): SlotSummary {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return { empty: true };
    const d = JSON.parse(raw);
    // Latest stats record holds rating + guests; not present on a fresh
    // save where no day has advanced yet.
    const last = Array.isArray(d.stats) && d.stats.length > 0
      ? d.stats[d.stats.length - 1] : null;
    return {
      empty : false,
      day   : d.day,
      cash  : d.cash,
      rating: last ? last.rating       : undefined,
      guests: last ? last.total_guests : undefined,
    };
  } catch {
    return { empty: true };
  }
}

export function deleteSlot(slot: number): void {
  try { localStorage.removeItem(slotKey(slot)); } catch { /* ignore */ }
}

export function getLastUsed(): number | null {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return n >= 1 && n <= SLOT_COUNT ? n : null;
  } catch { return null; }
}

export function setLastUsed(slot: number): void {
  try { localStorage.setItem(LAST_USED_KEY, String(slot)); } catch { /* ignore */ }
}

// One-shot migration: if a pre-slot save exists and slot 1 is empty, move it.
// Idempotent — the legacy key is removed once migrated.
export function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(slotKey(1))) {
      localStorage.setItem(slotKey(1), legacy);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}
