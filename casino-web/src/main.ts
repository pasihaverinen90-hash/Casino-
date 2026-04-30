// main.ts — entry point. Bootstraps Phaser and all HTML UI components.
import Phaser from 'phaser';
import { GridScene } from './game/GridScene';
import { uiBus }       from './events/UIBus';
import { gameState }   from './state/GameState';
import { TimeController } from './state/TimeController';
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
new TopHUD(uiRoot);
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

const time = new TimeController(() => gameState.advanceDay());
// Stay paused until the user picks a slot from the start screen.
time.setSpeed(0);

let started = false;
const startScreen = new StartScreen(uiRoot, () => {
  // Slot has been picked and gameState is populated. Resume time.
  started = true;
  time.setSpeed(1);
});
startScreen.show();

const bottomBar = new BottomBar(uiRoot, time, {
  onBuild: () => {
    hotelPanel.close(); statsPanel.close(); goalsPanel.close();
    buildPanel.open();
    time.setAutoPause(true);
  },
  onHotel: () => {
    buildPanel.close(); statsPanel.close(); goalsPanel.close();
    hotelPanel.open();
    time.setAutoPause(true);
  },
  onStats: () => {
    buildPanel.close(); hotelPanel.close(); goalsPanel.close();
    statsPanel.open();
    time.setAutoPause(false);
  },
  onSave: () => {
    if (gameState.save()) gameState.emit('toast_requested', '✓ Game saved');
  },
  onMenu: () => {
    _closeAll();
    bottomBar.closeAll();
    time.setAutoPause(true);   // pause while the confirm is up; restored on cancel
    _confirmReturnToMenu();
  },
  onCloseAll: _closeAll,
});

function _confirmReturnToMenu(): void {
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
    time.setAutoPause(false);
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
  time.setAutoPause(false);
  uiBus.emit('exit_placement');
  uiBus.emit('toggle_demolish', false);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
// B = Build panel toggle       H = Hotel panel toggle
// S = Stats panel toggle       G = Goals panel toggle
// Space = pause / resume       1 = 1× speed   2 = 2× speed
// Escape = close everything    R = rotate placement ghost (handled in GridScene)

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
  }
});

// ── Grid → sync BottomBar state ───────────────────────────────────────────
// When placement is confirmed the user has left placement mode; reset bar.
uiBus.on('placement_confirmed', () => {
  bottomBar.closeAll(_closeAll);
});
