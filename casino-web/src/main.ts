// main.ts — entry point. Bootstraps Phaser, mounts the V2 HTML UI shell,
// wires GameState ↔ TimeController, and registers the keyboard shortcuts.
//
// Panel open/close/demolish coordination lives in V2PanelCoordinator;
// the active-goal detail modal, return-to-menu modal, and keyboard
// shortcuts each live in their own helper modules so this file stays
// pure wiring.
import Phaser from 'phaser';
import { PresentationSceneV2 } from './v2/scene/PresentationSceneV2';
import { gameState }   from './state/GameState';
import { time }       from './state/TimeController';
import { GoalTicker }  from './ui/GoalTicker';
import { Toast }       from './ui/Toast';
import { ChallengeTicker } from './ui/ChallengeTicker';
import { GoalCompletePopup } from './ui/GoalCompletePopup';
import { StartScreen } from './ui/StartScreen';
import { TopHUDV2 }    from './v2/ui/TopHUDV2';
import { BottomBarV2 } from './v2/ui/BottomBarV2';
import { BuildPanelV2 } from './v2/ui/BuildPanelV2';
import { HotelPanelV2 } from './v2/ui/HotelPanelV2';
import { StatsPanelV2 } from './v2/ui/StatsPanelV2';
import { V2PanelCoordinator } from './v2/ui/V2PanelCoordinator';
import { openActiveGoalDetail } from './v2/ui/openActiveGoalDetail';
import { openReturnToMenuModal } from './v2/ui/returnToMenuModal';
import { wireKeyboardShortcuts } from './bootstrap/keyboardShortcuts';
import * as Slots      from './state/SaveSlots';
import './v2/ui/styleV2.css';

// ── DOM root ──────────────────────────────────────────────────────────────
const appEl  = document.getElementById('app')!;
const uiRoot = document.createElement('div');
uiRoot.id    = 'ui-root';
appEl.appendChild(uiRoot);

// ── Phaser game ───────────────────────────────────────────────────────────
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
// BuildPanelV2's X button routes through bottomBar.closeAll so the Build
// button highlight clears in sync. The fallback delegates to coordinator.
const buildPanel = new BuildPanelV2(uiRoot, () => bottomBar.closeAll(() => coordinator.closeAll()));

new GoalTicker(uiRoot, () => openActiveGoalDetail(uiRoot));

// Migrate any pre-slot save into slot 1 the first time we boot.
Slots.migrateLegacy();

// ── TimeController ↔ GameState wiring ─────────────────────────────────────
time.on('hour', () => gameState.tickHour());
time.on('day_end', () => gameState.endDay());
time.on<number>('clock', idx => topHUD.setClock(idx));
time.setSpeed(0);

let started = false;
const startScreen = new StartScreen(uiRoot, () => {
  // Slot has been picked and gameState is populated. GameState owns the
  // in-day clock; _newGame resets to 00:00 for fresh slots, _apply
  // restores the saved minute for loaded ones — main.ts only resumes speed.
  started = true;
  time.setSpeed(1);
});
startScreen.show();

const bottomBar = new BottomBarV2(uiRoot, {
  onBuild   : () => coordinator.openBuild(),
  onHotel   : () => coordinator.openHotel(),
  onStats   : () => coordinator.openStats(),
  onDemolish: active => (active ? coordinator.enterDemolish() : coordinator.exitDemolish()),
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
});

const coordinator = new V2PanelCoordinator({ buildPanel, hotelPanel, statsPanel, bottomBar });

// ── Keyboard shortcuts ────────────────────────────────────────────────────
// Map lives in bootstrap/keyboardShortcuts.ts; R rotation is owned by
// InputControllerV2 inside the Phaser scene.
wireKeyboardShortcuts({
  isStarted  : () => started,
  coordinator,
  bottomBar,
});
