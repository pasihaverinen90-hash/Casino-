// main.ts — entry point. Bootstraps Phaser and all HTML UI components.
import Phaser from 'phaser';
import { GridScene } from './game/GridScene';
import { PresentationSceneV2 } from './v2/scene/PresentationSceneV2';
import { getRendererId } from './state/RendererFlag';
import { uiBus }       from './events/UIBus';
import { gameState }   from './state/GameState';
import { time }       from './state/TimeController';
import { TopHUD }      from './ui/TopHUD';
import { BottomBar }   from './ui/BottomBar';
import { GoalTicker }  from './ui/GoalTicker';
import { BuildPanel }  from './ui/BuildPanel';
import { HotelPanel }  from './ui/HotelPanel';
import { StatsPanel }  from './ui/StatsPanel';
import { GoalsPanel }  from './ui/GoalsPanel';
import { Toast }       from './ui/Toast';
import { ChallengeTicker } from './ui/ChallengeTicker';
import { GoalCompletePopup } from './ui/GoalCompletePopup';
import { StartScreen } from './ui/StartScreen';
import { TopHUDV2 }    from './v2/ui/TopHUDV2';
import { BottomBarV2 } from './v2/ui/BottomBarV2';
import { SummaryCardV2 } from './v2/ui/SummaryCardV2';
import { BuildPanelV2 } from './v2/ui/BuildPanelV2';
import * as Slots      from './state/SaveSlots';
// V2 UI styles. Scoped under .v2-* class selectors so loading them in
// V1 mode is harmless (no .v2-* roots exist in V1).
import './v2/ui/styleV2.css';

// ── DOM structure ─────────────────────────────────────────────────────────
const appEl  = document.getElementById('app')!;
const uiRoot = document.createElement('div');
uiRoot.id    = 'ui-root';
appEl.appendChild(uiRoot);

// ── Phaser game (renders the grid canvas, fills the window) ───────────────
// Renderer selection: Phase 1 wires both V1 (GridScene) and V2
// (PresentationSceneV2) into the scene list. Phaser auto-starts the first
// scene only, so putting the selected renderer first chooses which one
// boots without altering the other's registration. Default stays 'v1';
// ?renderer=v2 in the URL forces V2 (see state/RendererFlag.ts).
const _rendererId = getRendererId();
const _sceneList  = _rendererId === 'v2'
  ? [PresentationSceneV2, GridScene]
  : [GridScene, PresentationSceneV2];

new Phaser.Game({
  type      : Phaser.AUTO,
  width     : window.innerWidth,
  height    : window.innerHeight,
  parent    : 'app',
  backgroundColor: '#0a0c14',
  scene     : _sceneList,
  input     : { touch: true, mouse: true },
  scale     : {
    mode      : Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render    : { antialias: false },
});

// ── HTML UI components ────────────────────────────────────────────────────
// Top HUD: V2 (premium casino-sim shell) when renderer=v2, else V1.
// Both classes expose `setClock(idx)` so the TimeController wiring
// below doesn't need a branch.
const _v2Ui = _rendererId === 'v2';
const topHUD: { setClock: (i: number) => void } = _v2Ui
  ? new TopHUDV2(uiRoot)
  : new TopHUD(uiRoot);
new Toast(uiRoot);
new ChallengeTicker(uiRoot);
new GoalCompletePopup(uiRoot);

const goalsPanel = new GoalsPanel(uiRoot);
const statsPanel = new StatsPanel(uiRoot);
const hotelPanel = new HotelPanel(uiRoot);
// Build sidebar's X button routes through BottomBar.closeAll so the Build
// button highlight is cleared and `_closeAll` runs (which emits
// exit_placement and hides any other panels). V2 path uses the premium
// BuildPanelV2 (left sidebar with 2×2 category grid); V1 keeps the
// original BuildPanel. Both share the same public surface (open/close)
// and the same uiBus 'start_placement' contract.
const buildPanel: { open(): void; close(): void } = _v2Ui
  ? new BuildPanelV2(uiRoot, () => bottomBar.closeAll(_closeAll))
  : new BuildPanel  (uiRoot, () => bottomBar.closeAll(_closeAll));

new GoalTicker(uiRoot, () => {
  _closeAll();
  goalsPanel.open();
});

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
  // Slot has been picked and gameState is populated. Reset clock and resume.
  started = true;
  time.resetClock();
  time.setSpeed(1);
});
startScreen.show();

// Summary card (V2-only): bottom-right "Today" pill.
if (_v2Ui) new SummaryCardV2(uiRoot);

// Bottom navigation: V2 premium nav when renderer=v2, else V1 bar.
// Both classes share the same callback shape and public methods
// (pressButton / pressDemolish / closeAll), so the keyboard shortcut
// handlers below work for either renderer.
const bottomBar = _v2Ui
  ? new BottomBarV2(uiRoot, _bottomBarCallbacks())
  : new BottomBar(uiRoot, _bottomBarCallbacks());

function _bottomBarCallbacks(): {
  onBuild: () => void; onHotel: () => void; onStats: () => void;
  onDemolish: (active: boolean) => void;
  onSave: () => void; onMenu: () => void; onCloseAll: () => void;
} { return {
  onBuild: () => {
    hotelPanel.close(); statsPanel.close(); goalsPanel.close();
    uiBus.emit('toggle_demolish', false);
    buildPanel.open();
  },
  onHotel: () => {
    buildPanel.close(); statsPanel.close(); goalsPanel.close();
    uiBus.emit('toggle_demolish', false);
    hotelPanel.open();
  },
  onStats: () => {
    buildPanel.close(); hotelPanel.close(); goalsPanel.close();
    uiBus.emit('toggle_demolish', false);
    statsPanel.open();
  },
  onDemolish: (active: boolean) => {
    if (active) {
      // Demolish takes the floor — close every overlay so the player can
      // click anywhere on the grid, and drop any in-progress placement.
      buildPanel.close(); hotelPanel.close(); statsPanel.close(); goalsPanel.close();
      uiBus.emit('exit_placement');
      uiBus.emit('toggle_demolish', true);
    } else {
      uiBus.emit('toggle_demolish', false);
    }
  },
  onSave: () => {
    if (gameState.save()) gameState.emit('toast_requested', '✓ Game saved');
  },
  onMenu: () => {
    _closeAll();
    bottomBar.closeAll();
    _confirmReturnToMenu();
  },
  onCloseAll: _closeAll,
}; }

function _confirmReturnToMenu(): void {
  // Pause while the modal is up; restore the player's prior speed on cancel.
  const prevSpeed = time.speed;
  time.setSpeed(0);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay interactive';

  const card = document.createElement('div');
  card.className = 'modal-card';

  const title = document.createElement('div');
  title.className   = 'modal-title';
  title.textContent = 'Return to Main Menu?';
  card.appendChild(title);

  const body = document.createElement('div');
  body.className   = 'modal-body';
  body.textContent = 'Unsaved progress will be lost.';
  card.appendChild(body);

  const btnGo = document.createElement('button');
  btnGo.className   = 'modal-btn danger';
  btnGo.textContent = 'Return to Menu';
  btnGo.onclick     = () => {
    overlay.remove();
    started = false;
    time.setSpeed(0);
    gameState.clearActiveSlot();
    startScreen.show();
  };
  card.appendChild(btnGo);

  const btnCancel = document.createElement('button');
  btnCancel.className   = 'modal-btn';
  btnCancel.textContent = 'Cancel';
  btnCancel.onclick     = () => {
    overlay.remove();
    time.setSpeed(prevSpeed);
  };
  card.appendChild(btnCancel);

  overlay.appendChild(card);
  uiRoot.appendChild(overlay);
}

function _closeAll(): void {
  buildPanel.close();
  hotelPanel.close();
  statsPanel.close();
  goalsPanel.close();
  uiBus.emit('exit_placement');
  uiBus.emit('toggle_demolish', false);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
// B = Build       H = Hotel       S = Stats       G = Goals
// Space = pause   1 = 1×          2 = 2×          4 = 4×
// Escape = close all     R = rotate ghost (handled in GridScene)

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
    // single-key 'R' rotation. GridScene's keydown-R listener also skips
    // rotation when both modifiers are held, since Phaser's keyboard plugin
    // fires independently of this document-level handler.
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
      hotelPanel.close(); statsPanel.close(); goalsPanel.close();
      bottomBar.pressButton('build');          // toggles via existing button logic
      break;

    case 'h':
    case 'H':
      buildPanel.close(); statsPanel.close(); goalsPanel.close();
      bottomBar.pressButton('hotel');
      break;

    case 's':
    case 'S':
      buildPanel.close(); hotelPanel.close(); goalsPanel.close();
      bottomBar.pressButton('stats');
      break;

    case 'd':
    case 'D':
      bottomBar.pressDemolish();
      break;

    case 'g':
    case 'G':
      _closeAll();
      bottomBar.closeAll();
      goalsPanel.open();
      break;

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

// ── Grid → sync BottomBar state ───────────────────────────────────────────
// The Build sidebar is sticky during placement: after a successful place
// we leave the sidebar open and the Build button highlighted so the player
// can pick another item without re-opening the menu. GridScene clears its
// own placement state — BuildPanel listens to `placement_confirmed` to
// drop its selection highlight.
