// PaletteV2.ts — colour palette for the Presentation V2 renderer.
//
// V2 owns its own constants — V1's COL_* values in GameConstants.ts are
// not referenced and not mutated. When V1 retires, those legacy constants
// can be deleted without touching this file.
//
// All values are 0xRRGGBB integers, ready for Phaser.Graphics fillStyle()
// or Phaser.Text colour strings (call .toString(16).padStart(6, '0')).
//
// No imports. No functions. No side effects.

// ── Carpet & lobby ───────────────────────────────────────────────────────
// Burgundy floor with a slightly lighter alt tone used on alternating
// 2x2 groups for woven variation, and an antique-gold motif painted as
// a small centred dot at every 4x4 group centre tile.
export const CARPET_BASE       = 0x3a121a;
export const CARPET_ALT        = 0x4a1924;
export const CARPET_MOTIF      = 0xa67c2e;

// Reception zone — richer red than the regular floor, with a muted gold
// edge that reads as a carpet runner border.
export const LOBBY_BASE        = 0x5a1c26;
export const LOBBY_TRIM        = 0xb58a3a;

// ── Wood, panels, trim ───────────────────────────────────────────────────
// Dark wood paneling for wall bodies and table rims; mid-wood for the
// wainscoting band above the cap rail.
export const WOOD_DARK         = 0x2a1812;
export const WOOD_MID          = 0x4a2a1c;

// Main wall body fill (above the wainscoting) and the thin separator
// trim line between body and wainscoting.
export const WALL_PANEL        = 0x1f1410;
export const WALL_TRIM         = 0x6a4628;

// ── Brass accents ────────────────────────────────────────────────────────
// Primary brass for cap rails, column dividers, table rim trim, screen
// bezels; highlight is a brighter sheen painted as a thin top edge.
export const BRASS             = 0xa07820;
export const BRASS_HIGHLIGHT   = 0xe8c462;

// ── Shadows ──────────────────────────────────────────────────────────────
// Soft dark used for procedural drop shadows under objects.
export const SHADOW            = 0x06080c;

// ── Felt (tables) ────────────────────────────────────────────────────────
// Standard table felt (small / large / keno) and the deeper, redder
// high-stakes felt.
export const FELT_GREEN        = 0x1a5a32;
export const FELT_HIGH_STAKES  = 0x5a141a;

// ── Slot machine ─────────────────────────────────────────────────────────
// SLOT_BODY: the warm gold/brass cabinet face. More saturated than the
//   wood palette so a slot reads as a metal-housed machine, less bright
//   than BRASS_HIGHLIGHT so the top + rim trim still pop. Added Phase 4.
// SCREEN_DARK: dark inset for the slot screen, painted on the front face.
//   SCREEN_GLOW overlays it at high alpha to suggest a lit display.
export const SLOT_BODY         = 0xb89020;
export const SCREEN_DARK       = 0x0e1115;
export const SCREEN_GLOW       = 0xffb84a;

// ── UI accents ───────────────────────────────────────────────────────────
// Gold used for HUD text, sign lettering, and active item highlights.
// The dim variant marks inactive / locked items so the UI doesn't lose
// the gold theme on disabled controls.
export const UI_GOLD           = 0xe8c462;
export const UI_GOLD_DIM       = 0x8a6a2e;

// ── Scene backdrop ───────────────────────────────────────────────────────
// Dark surround behind the projected floor — slightly bluer than the
// wall panels so the room reads as lit warmer than its surroundings.
export const BG_DARK           = 0x0a0a14;

// ── Placement / demolish / selection overlays ────────────────────────────
// Bright green for a valid placement ghost; bright red for an invalid
// ghost and for demolish overlay/hover. Same hues V1 GridScene used so
// the green/red signal reads identically across renderers while V1 is
// still in tree.
export const GHOST_OK          = 0x33e64d;
export const GHOST_BAD         = 0xe63333;
