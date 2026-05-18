// keyboardShortcuts.ts — registers the document-level keydown handler
// extracted from main.ts in Phase 11B.
//
// Shortcut map (preserves the prior main.ts behaviour byte-for-byte):
//   B / H / S / G / D  — toggle Build / Hotel / Stats / Stats→Goals / Demolish
//   Esc                 — close every panel + clear bottom-bar highlight
//   Space               — toggle pause
//   1 / 2 / 4           — set speed 1× / 2× / 4×
//   R                   — rotation; handled inside InputControllerV2
//   Ctrl+Shift+R        — dev: print Rating breakdown
//   Ctrl+Shift+C        — dev: start Slot-Promotion challenge
//   Ctrl+Shift+1/2/3    — dev: grant 10k / 50k / 250k cash
//
// Shortcuts are inert while StartScreen is up (`isStarted()` returns
// false) and while focus is inside an input/textarea.
import { gameState } from '../state/GameState';
import { time } from '../state/TimeController';
import type { BottomBarV2 } from '../v2/ui/BottomBarV2';
import type { V2PanelCoordinator } from '../v2/ui/V2PanelCoordinator';

export interface KeyboardShortcutArgs {
  isStarted   : () => boolean;
  coordinator : V2PanelCoordinator;
  bottomBar   : BottomBarV2;
}

export function wireKeyboardShortcuts(args: KeyboardShortcutArgs): void {
  const { isStarted, coordinator, bottomBar } = args;

  document.addEventListener('keydown', e => {
    // Don't fire while typing inside an input field.
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Ignore shortcuts until the start screen has been dismissed.
    if (!isStarted()) return;

    // Hidden dev/test shortcuts: Ctrl+Shift+R/C/1/2/3. Use e.code
    // (layout-independent) since Shift maps '1' → '!' on US keyboards.
    // Handled before the speed switch so Ctrl+Shift+1 doesn't fall
    // through to "set speed 1×".
    if (e.ctrlKey && e.shiftKey) {
      if (e.code === 'KeyR') {
        e.preventDefault();
        gameState.debugRatingBreakdown();
        return;
      }
      if (e.code === 'KeyC') {
        e.preventDefault();
        gameState.debugStartSlotPromotionChallenge();
        return;
      }
      let amount = 0;
      if      (e.code === 'Digit1') amount = 10_000;
      else if (e.code === 'Digit2') amount = 50_000;
      else if (e.code === 'Digit3') amount = 250_000;
      if (amount > 0) {
        e.preventDefault();
        gameState.debugAddCash(amount);
        return;
      }
    }

    switch (e.key) {
      case 'Escape':
        coordinator.closeAllAndClearBar();
        break;

      case 'b':
      case 'B':
        bottomBar.pressButton('build');
        break;

      case 'h':
      case 'H':
        bottomBar.pressButton('hotel');
        break;

      case 's':
      case 'S':
        bottomBar.pressButton('stats');
        break;

      case 'd':
      case 'D':
        bottomBar.pressDemolish();
        break;

      case 'g':
      case 'G': {
        // G opens Stats → Goals tab directly. Close any other panel
        // first so the underlying pressButton('stats') always opens
        // rather than toggling Stats closed if it was already active.
        coordinator.closeAllAndClearBar();
        coordinator.openStatsGoals();
        break;
      }

      case ' ':
        e.preventDefault();
        time.togglePause();
        break;

      case '1':
        time.setSpeed(1);
        break;

      case '2':
        time.setSpeed(2);
        break;

      case '4':
        time.setSpeed(4);
        break;
    }
  });
}
