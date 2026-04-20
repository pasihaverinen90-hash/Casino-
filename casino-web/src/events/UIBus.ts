// UIBus.ts — singleton event bus for UI ↔ GridScene communication
// Keeps HTML panels and the Phaser scene loosely coupled.
import { EventEmitter } from '../state/EventEmitter';

export const uiBus = new EventEmitter();

// Events fired by HTML UI → consumed by GridScene:
//   'start_placement'   { type: ObjType, variant: string }
//   'exit_placement'
//   'toggle_demolish'   boolean

// Events fired by GridScene → consumed by HTML UI:
//   'placement_confirmed'
//   'placement_cancelled'
//   'demolish_cancelled'
//   'object_tapped'      string (obj_id)
