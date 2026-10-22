/**
 * IronManFlight.ts
 * Iron Man flight identity: repulsor audio feedback on top of the shared
 * FlightSystem. Physics, restrictions and landing live in the shared system.
 */

import { audioSystem } from '../../AudioSystem';
import { CharacterFlightAbility } from '../../systems/flight/CharacterFlightAbility';
import type { FlightSystem } from '../../systems/flight/FlightSystem';

export class IronManFlight extends CharacterFlightAbility {
  constructor(system: FlightSystem) {
    super('ironman', system, {
      onStart: () => audioSystem.playFlightToggle(true),
      onStop: () => audioSystem.playFlightToggle(false),
    });
  }
}
