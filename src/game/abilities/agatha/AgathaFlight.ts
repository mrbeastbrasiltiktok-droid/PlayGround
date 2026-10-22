/**
 * AgathaFlight.ts
 * Agatha flight identity: arcane levitation audio and state flag on top of the
 * shared FlightSystem. No physics is duplicated here.
 */

import { audioSystem } from '../../AudioSystem';
import { CharacterFlightAbility } from '../../systems/flight/CharacterFlightAbility';
import type { FlightSystem } from '../../systems/flight/FlightSystem';

export class AgathaFlight extends CharacterFlightAbility {
  constructor(system: FlightSystem, onArcaneFlightChange?: (active: boolean) => void) {
    super('agatha', system, {
      onStart: () => {
        audioSystem.playArcaneFlight(true);
        onArcaneFlightChange?.(true);
      },
      onStop: () => {
        audioSystem.playArcaneFlight(false);
        onArcaneFlightChange?.(false);
      },
    });
  }
}
