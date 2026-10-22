/**
 * CharacterFlightAbility.ts
 * Activation / interruption rules layered on top of the shared FlightSystem.
 * Per-character modules only supply their identity and audio/state effects.
 */

import { gameplayRestrictions } from '../../GameplayRestrictions';
import type { FlightCharacterId } from './CharacterFlightConfig';
import {
  FlightSystem,
  type FlightEndReason,
  type FlightFrameInput,
  type FlightState,
} from './FlightSystem';

export interface CharacterFlightEffects {
  onStart: () => void;
  onStop: (reason: FlightEndReason) => void;
  onLand?: () => void;
}

export class CharacterFlightAbility {
  public readonly characterId: FlightCharacterId;
  private system: FlightSystem;
  private effects: CharacterFlightEffects;

  constructor(
    characterId: FlightCharacterId,
    system: FlightSystem,
    effects: CharacterFlightEffects
  ) {
    this.characterId = characterId;
    this.system = system;
    this.effects = effects;
  }

  public canActivate(): boolean {
    return (
      !gameplayRestrictions.hasRestriction('NoFlight') &&
      !gameplayRestrictions.hasRestriction('Stunned')
    );
  }

  public toggle(): boolean {
    if (this.system.isActive()) {
      this.system.deactivate('toggle');
      this.effects.onStop('toggle');
      return false;
    }

    if (!this.canActivate()) return false;
    if (!this.system.activate()) return false;

    this.effects.onStart();
    return true;
  }

  public update(dt: number, input: FlightFrameInput): FlightState {
    const state = this.system.update(dt, input);

    if (state.event === 'deactivated') {
      this.effects.onStop(state.endReason ?? 'interrupted');
    } else if (state.event === 'landed') {
      this.effects.onLand?.();
    }

    return state;
  }

  public interrupt(reason: FlightEndReason = 'interrupted'): void {
    if (!this.system.isActive() && !this.system.isLanding()) return;
    this.system.interrupt(reason);
    this.effects.onStop(reason);
  }

  public bounce(height: number): boolean {
    const wasActive = this.system.isActive();
    this.system.bounce(height);
    if (!wasActive && this.system.isActive()) {
      this.effects.onStart();
      return true;
    }
    return false;
  }

  public reset(): void {
    this.system.reset();
  }

  public getSystem(): FlightSystem {
    return this.system;
  }
}
