// main.ts — entry point. Bootstraps Phaser and all HTML UI components.
import Phaser from 'phaser';
import { GridScene } from './game/GridScene';
import { uiBus }       from './events/UIBus';
import { gameState }   from './state/GameState';
import { TopHUD }      from './ui/TopHUD';
import { BottomBar }   from './ui/BottomBar';
import { GoalTicker }  from './ui/GoalTicker';
import { BuildPanel }  from './ui/BuildPanel';
import { HotelPanel }  from './ui/HotelPanel';
import { StatsPanel }  from './ui/StatsPanel';
import { GoalsPanel }  from './ui/GoalsPanel';
import { Toast }       from './ui/Toast';
import { EndScreen }   from './ui/EndScreen';

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

const bottomBar = new BottomBar(uiRoot, {
  onBuild: () => {
    hotelPanel.close(); statsPanel.close(); goalsPanel.close();
    buildPanel.open();
  },
  onHotel: () => {
    buildPanel.close(); statsPanel.close(); goalsPanel.close();
    hotelPanel.open();
  },
  onStats: () => {
    buildPanel.close(); hotelPanel.close(); goalsPanel.close();
    statsPanel.open();
  },
  onCloseAll: _closeAll,
});

function _closeAll(): void {
  buildPanel.close();
  hotelPanel.close();
  statsPanel.close();
  goalsPanel.close();
  uiBus.emit('exit_placement');
  uiBus.emit('toggle_demolish', false);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
// B = Build panel toggle       H = Hotel panel toggle
// S = Stats panel toggle       G = Goals panel toggle
// Space / Enter = Advance day  Escape = close everything
// R = rotate placement ghost (handled inside GridScene)

document.addEventListener('keydown', e => {
  // Don't fire while typing inside an input field
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
    case 'Enter':
      e.preventDefault();
      _closeAll();
      bottomBar.closeAll();
      gameState.advanceDay();
      break;
  }
});

// ── Grid → sync BottomBar state ───────────────────────────────────────────
// When placement is confirmed the user has left placement mode; reset bar.
uiBus.on('placement_confirmed', () => {
  bottomBar.closeAll(_closeAll);
});
