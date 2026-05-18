// UIBus.ts — singleton event bus between HTML UI and the Phaser scene
// (PresentationSceneV2 / InputControllerV2). Keeps panels and the scene
// loosely coupled.
import { EventEmitter } from '../state/EventEmitter';

export const uiBus = new EventEmitter();

// Events fired by HTML UI → consumed by InputControllerV2:
//   'start_placement'   { type: ObjType, variant: string }
//   'exit_placement'
//   'toggle_demolish'   boolean

// Events fired by InputControllerV2 → consumed by HTML UI:
//   'placement_confirmed'
//   'placement_cancelled'
//   'demolish_cancelled'
//   'object_tapped'      string (obj_id)
