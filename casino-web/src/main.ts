// main.ts — entry point. Bootstraps Phaser and all HTML UI components.
import Phaser from 'phaser';
import { PresentationSceneV2 } from './v2/scene/PresentationSceneV2';
import { uiBus }       from './events/UIBus';
import { gameState }   from './state/GameState';
import { time }       from './state/TimeController';
import { GoalTicker }  from './ui/GoalTicker';
import { Toast }       from './ui/Toast';
import { ChallengeTicker } from './ui/ChallengeTicker';
import { GoalCompletePopup } from './ui/GoalCompletePopup';
import { StartScreen } from './ui/StartScreen';
import { openActiveGoalDetail } from './v2/ui/openActiveGoalDetail';
import { openReturnToMenuModal } from './v2/ui/returnToMenuModal';
import { TopHUDV2 }    from './v2/ui/TopHUDV2';
import { BottomBarV2 } from './v2/ui/BottomBarV2';
import { BuildPanelV2 } from './v2/ui/BuildPanelV2';
import { HotelPanelV2 } from './v2/ui/HotelPanelV2';
import { StatsPanelV2 } from './v2/ui/StatsPanelV2';
import { V2PanelCoordinator } from './v2/ui/V2PanelCoordinator';
import * as Slots      from './state/SaveSlots';
// V2 UI styles — scoped under .v2-* class selectors and .v2-root overrides.
import './v2/ui/styleV2.css';

// ── DOM structure ─────────────────────────────────────────────────────────
const appEl  = document.getElementById('app')!;
const uiRoot = document.createElement('div');
uiRoot.id    = 'ui-root';
appEl.appendChild(uiRoot);

// V2 chrome class — applied unconditionally now that V1 is retired. Lets
// styleV2.css scope overrides for the shared modal/toast/ticker classes
// without rewriting those components.
uiRoot.classList.add('v2-root');

// ── Phaser game (renders the grid canvas, fills the window) ───────────────
new Phaser.Game({
  type      : Phaser.AUTO,
  width     : window.innerWidth,
  height    : window.innerHeight,
  parent    : 'app',
  backgroundColor: '#0a0c14',
  scene     : [PresentationSceneV2],
  input     : { touch: true, mouse: true },
  scale     : {
    mode      : Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render    : { antialias: false },
});

// ── HTML UI components ────────────────────────────────────────────────────
const topHUD = new TopHUDV2(uiRoot);
new Toast(uiRoot);
new ChallengeTicker(uiRoot);
new GoalCompletePopup(uiRoot);

const statsPanel = new StatsPanelV2(uiRoot);
const hotelPanel = new HotelPanelV2(uiRoot);
const buildPanel = new BuildPanelV2(uiRoot, () => bottomBar.closeAll(_closeAll));

// GoalTicker click opens the shared objective-detail modal for the
// single active goal. StatsPanelV2 → Goals tab still hosts the full list.
new GoalTicker(uiRoot, () => openActiveGoalDetail(uiRoot));

// Migrate any pre-slot save into slot 1 the first time we boot.
Slots.migrateLegacy();

// ── TimeController wiring ────────────────────────────────────────────────
// GameState gets the hourly revenue drip and end-of-day rollup. TopHUD
// shows the 15-minute clock. The start screen pauses time until a slot is
// picked.
time.on('hour', () => gameState.tickHour());
time.on('day_end', () => gameState.endDay());
time.on<number>('clock', idx => topHUD.setClock(idx));
time.setSpeed(0);

let started = false;
const startScreen = new StartScreen(uiRoot, () => {
  // Slot has been picked and gameState is populated. GameState owns the
  // in-day clock: _newGame resets to 00:00 for fresh slots, _apply
  // restores the saved minute for loaded ones — so main.ts only needs
  // to resume the speed.
  started = true;
  time.setSpeed(1);
});
startScreen.show();

const bottomBar = new BottomBarV2(uiRoot, _bottomBarCallbacks());
const coordinator = new V2PanelCoordinator({ buildPanel, hotelPanel, statsPanel, bottomBar });

function _bottomBarCallbacks(): {
  onBuild: () => void; onHotel: () => void; onStats: () => void;
  onDemolish: (active: boolean) => void;
  onSave: () => void; onMenu: () => void; onCloseAll: () => void;
} { return {
  onBuild   : () => coordinator.openBuild(),
  onHotel   : () => coordinator.openHotel(),
  onStats   : () => coordinator.openStats(),
  onDemolish: (active: boolean) => (active ? coordinator.enterDemolish() : coordinator.exitDemolish()),
  onSave    : () => {
    if (gameState.save()) gameState.emit('toast_requested', '✓ Game saved');
  },
  onMenu    : () => {
    coordinator.closeAllAndClearBar();
    openReturnToMenuModal({
      parent   : uiRoot,
      onConfirm: () => {
        started = false;
        gameState.clearActiveSlot();
        startScreen.show();
      },
    });
  },
  onCloseAll: () => coordinator.closeAll(),
}; }

// Thin shim around coordinator.closeAll for callers that take a bare
// function reference (BuildPanelV2's X-button hook, the keyboard
// handler). Coordinator owns the logic; this just adapts the shape.
function _closeAll(): void { coordinator.closeAll(); }

// ── Keyboard shortcuts ────────────────────────────────────────────────────
// B = Build       H = Hotel       S = Stats       G = Goals
// Space = pause   1 = 1×          2 = 2×          4 = 4×
// Escape = close all     R = rotate ghost (handled in InputControllerV2)

document.addEventListener('keydown', e => {
  // Don't fire while typing inside an input field
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  // Ignore shortcuts until the start screen has been dismissed.
  if (!started) return;

  // Hidden dev/test shortcut: Ctrl+Shift+1/2/3 grants cash for faster
  // progression testing in production. Use e.code (layout-independent) —
  // Shift maps '1' → '!' on US keyboards, so e.key would miss the digit.
  // Handled before the speed switch so Ctrl+Shift+1 doesn't fall through
  // to "set speed 1×".
  if (e.ctrlKey && e.shiftKey) {
    // Ctrl+Shift+R prints the live Rating V2 category breakdown for tuning.
    // Handled here (and returned early) so it doesn't fall through to the
    // single-key 'R' rotation. InputControllerV2's keydown-R listener also
    // skips rotation when both modifiers are held.
    if (e.code === 'KeyR') {
      e.preventDefault();
      gameState.debugRatingBreakdown();
      return;
    }
    // Ctrl+Shift+C — Random Challenges V1 manual trigger. Starts Slot
    // Machine Promotion if no challenge is active; otherwise toasts a
    // "already active" message handled inside GameState.
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
      _closeAll();
      bottomBar.closeAll();
      break;

    case 'b':
    case 'B':
      hotelPanel.close(); statsPanel.close();
      bottomBar.pressButton('build');          // toggles via existing button logic
      break;

    case 'h':
    case 'H':
      buildPanel.close(); statsPanel.close();
      bottomBar.pressButton('hotel');
      break;

    case 's':
    case 'S':
      buildPanel.close(); hotelPanel.close();
      bottomBar.pressButton('stats');
      break;

    case 'd':
    case 'D':
      bottomBar.pressDemolish();
      break;

    case 'g':
    case 'G': {
      // G now opens Stats → Goals tab directly (V1 GoalsPanel retired).
      // Close any other panel first so pressButton('stats') always opens
      // rather than toggling Stats closed if it was already active.
      _closeAll();
      bottomBar.closeAll();
      bottomBar.pressButton('stats');
      statsPanel.setTab(2);
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
