// main.ts — entry point. Bootstraps Phaser and all HTML UI components.
import Phaser from 'phaser';
import { GridScene } from './game/GridScene';
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
import { EndScreen }   from './ui/EndScreen';
import { StartScreen } from './ui/StartScreen';
import * as Slots      from './state/SaveSlots';

// ── DOM structure ─────────────────────────────────────────────────────────
const appEl  = document.getElementById('app')!;
const uiRoot = document.createElement('div');
uiRoot.id    = 'ui-root';
appEl.appendChild(uiRoot);

// ── Phaser game (renders the grid canvas, fills the window) ───────────────
new Phaser.Game({
  type      : Phaser.AUTO,
  width     : window.innerWidth,
  height    : window.innerHeight,
  parent    : 'app',
  backgroundColor: '#0a0c14',
  scene     : [GridScene],
  input     : { touch: true, mouse: true },
  scale     : {
    mode      : Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render    : { antialias: false },
});

// ── HTML UI components ────────────────────────────────────────────────────
const topHUD = new TopHUD(uiRoot);
new Toast(uiRoot);
new EndScreen(uiRoot);

const goalsPanel = new GoalsPanel(uiRoot);
const statsPanel = new StatsPanel(uiRoot);
const hotelPanel = new HotelPanel(uiRoot);
const buildPanel = new BuildPanel(uiRoot);

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

const bottomBar = new BottomBar(uiRoot, {
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
});

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
// When placement is confirmed the user has left placement mode; reset bar.
uiBus.on('placement_confirmed', () => {
  bottomBar.closeAll(_closeAll);
});
