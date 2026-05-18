// V2PanelCoordinator.ts — centralizes panel open/close/demolish behavior.
//
// Before Phase 11B, main.ts open-fired each panel in 10+ places with the
// same "close the other two + exit demolish + open this one" pattern.
// This coordinator owns that contract end-to-end so callers (bottom-bar
// callbacks, keyboard shortcuts, GoalTicker → Stats-Goals route) say
// what they mean — "open the Hotel panel" — instead of repeating the
// surrounding cleanup steps.
//
// Behaviour is byte-identical to the previous inline logic in main.ts:
//   • openBuild / openHotel / openStats close the other panels, drop
//     demolish mode, then open the target panel.
//   • enterDemolish closes every panel, exits any in-flight placement,
//     and toggles demolish on via uiBus. exitDemolish toggles it off.
//   • closeAll closes every panel and resets both uiBus contracts.
//   • openStatsGoals is a thin wrapper: open Stats then setTab(2).
//
// uiBus is the same surface InputControllerV2 already subscribes to.
import { uiBus } from '../../events/UIBus';
import type { BuildPanelV2 } from './BuildPanelV2';
import type { HotelPanelV2 } from './HotelPanelV2';
import type { StatsPanelV2 } from './StatsPanelV2';
import type { BottomBarV2 } from './BottomBarV2';

export interface V2PanelCoordinatorArgs {
  buildPanel : BuildPanelV2;
  hotelPanel : HotelPanelV2;
  statsPanel : StatsPanelV2;
  bottomBar  : BottomBarV2;
}

export class V2PanelCoordinator {
  private readonly buildPanel: BuildPanelV2;
  private readonly hotelPanel: HotelPanelV2;
  private readonly statsPanel: StatsPanelV2;
  private readonly bottomBar : BottomBarV2;

  constructor(args: V2PanelCoordinatorArgs) {
    this.buildPanel = args.buildPanel;
    this.hotelPanel = args.hotelPanel;
    this.statsPanel = args.statsPanel;
    this.bottomBar  = args.bottomBar;
  }

  openBuild(): void {
    this.hotelPanel.close();
    this.statsPanel.close();
    uiBus.emit('toggle_demolish', false);
    this.buildPanel.open();
  }

  openHotel(): void {
    this.buildPanel.close();
    this.statsPanel.close();
    uiBus.emit('toggle_demolish', false);
    this.hotelPanel.open();
  }

  openStats(): void {
    this.buildPanel.close();
    this.hotelPanel.close();
    uiBus.emit('toggle_demolish', false);
    this.statsPanel.open();
  }

  // Convenience for the G keyboard shortcut: open Stats and snap to the
  // Goals tab. statsPanel.open() resets to Today, so setTab fires after.
  openStatsGoals(): void {
    this.openStats();
    this.statsPanel.setTab(2);
  }

  enterDemolish(): void {
    // Demolish takes the floor — close every overlay so the player can
    // click anywhere on the grid, and drop any in-progress placement.
    this.buildPanel.close();
    this.hotelPanel.close();
    this.statsPanel.close();
    uiBus.emit('exit_placement');
    uiBus.emit('toggle_demolish', true);
  }

  exitDemolish(): void {
    uiBus.emit('toggle_demolish', false);
  }

  // Close every panel + reset placement/demolish. Mirrors the previous
  // _closeAll helper in main.ts. Does NOT touch the bottom-bar highlight;
  // callers that also need the highlight cleared should follow this with
  // `bottomBar.closeAll()` as before.
  closeAll(): void {
    this.buildPanel.close();
    this.hotelPanel.close();
    this.statsPanel.close();
    uiBus.emit('exit_placement');
    uiBus.emit('toggle_demolish', false);
  }

  // Convenience wrapper for callers that always pair closeAll() with a
  // bottom-bar highlight reset (the Esc shortcut, the Menu callback).
  closeAllAndClearBar(): void {
    this.closeAll();
    this.bottomBar.closeAll();
  }
}
