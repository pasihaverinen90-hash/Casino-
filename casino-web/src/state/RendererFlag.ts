// RendererFlag.ts — selects between V1 (GridScene) and V2
// (PresentationSceneV2). Consumed by main.ts to pick which Phaser scene
// boots first and which set of HTML UI components mounts.
//
// Resolution order in getRendererId():
//   1. URL query parameter ?renderer=v1|v2 (wins over storage so a
//      query can recover a stuck localStorage preference during dev).
//   2. localStorage 'rendererV2' === 'v1' or 'v2' → that value.
//   3. Default 'v2'. V1 remains available as a fallback via
//      ?renderer=v1 until V1 is retired in a later cleanup phase.
//
// Storage reads/writes are wrapped in try/catch so private-mode browsers
// and quota errors are silent — mirrors the pattern in GameState._writeSave
// and SaveSlots.
//
// No Phaser. No gameState. Only window.location and localStorage.

export type RendererId = 'v1' | 'v2';

const STORAGE_KEY = 'rendererV2';

export function getRendererId(): RendererId {
  // 1. URL query parameter wins so devs can override a stuck preference
  //    with ?renderer=v1.
  const fromUrl = _readUrl();
  if (fromUrl !== null) return fromUrl;
  // 2. Persisted preference.
  const fromStorage = _readStorage();
  if (fromStorage !== null) return fromStorage;
  // 3. Default — V2 is now the default. V1 stays reachable via
  //    ?renderer=v1 until it's retired in a later cleanup phase.
  return 'v2';
}

export function setRendererId(id: RendererId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Quota exceeded / private mode — caller doesn't get persistence,
    // but getRendererId() still works for the current session if a
    // ?renderer=… query is present.
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

// Returns 'v1' / 'v2' if ?renderer=v1|v2 is present, otherwise null.
// Guards against non-browser environments where window/location are absent.
function _readUrl(): RendererId | null {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('renderer');
    if (v === 'v1' || v === 'v2') return v;
    return null;
  } catch {
    return null;
  }
}

// Returns the persisted choice or null if absent / unreadable / invalid.
function _readStorage(): RendererId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'v1' || raw === 'v2') return raw;
    return null;
  } catch {
    return null;
  }
}
