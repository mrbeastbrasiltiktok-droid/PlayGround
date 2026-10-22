import * as THREE from 'three';
import { audioSystem } from '../AudioSystem';
import { gameplayRestrictions } from '../GameplayRestrictions';
import { agathaFlightProfile } from './flight/AgathaFlightProfile';
import { ironManFlightProfile } from './flight/IronManFlightProfile';

export interface FlightProfile {
  id: 'agatha' | 'ironman';
  label: string;
  altitude: number;
  maxSpeed: number;
  hoverAmplitude: number;
  hoverFrequency: number;
  bankStrength: number;
  bankLimit: number;
  sound: 'arcane' | 'thruster';
  thrusterVisuals: boolean;
}

export const FLIGHT_PROFILES: Record<FlightProfile['id'], FlightProfile> = {
  agatha: agathaFlightProfile,
  ironman: ironManFlightProfile,
};

export class FlightSystem {
  private profile: FlightProfile = FLIGHT_PROFILES.ironman;
  private flying = false;
  private targetAltitude = 0;
  private currentAltitude = 0;
  private bank = 0;
  private speedOverride: number | null = null;

  public setProfile(id: FlightProfile['id']): void {
    this.profile = FLIGHT_PROFILES[id];
    if (!this.flying) this.targetAltitude = 0;
  }

  public get activeProfile(): FlightProfile {
    return this.profile;
  }

  public get isFlying(): boolean {
    return this.flying;
  }

  public get bankRoll(): number {
    return this.bank;
  }

  public get maxSpeed(): number {
    return this.speedOverride ?? this.profile.maxSpeed;
  }

  public setMaxSpeed(speed: number): void {
    this.speedOverride = Number.isFinite(speed) ? speed : null;
  }

  public toggle(): { active: boolean; blocked: boolean } {
    if (
      gameplayRestrictions.hasRestriction('NoFlight') ||
      gameplayRestrictions.hasRestriction('Stunned')
    ) {
      audioSystem.playError?.();
      return { active: this.flying, blocked: true };
    }

    this.flying = !this.flying;
    this.targetAltitude = this.flying ? this.profile.altitude : 0;
    if (this.profile.sound === 'arcane') {
      audioSystem.playArcaneFlight(this.flying);
    } else {
      audioSystem.playFlightToggle(this.flying);
    }
    return { active: this.flying, blocked: false };
  }

  public update(dt: number): number {
    this.currentAltitude = THREE.MathUtils.damp(
      this.currentAltitude,
      this.targetAltitude,
      6.0,
      dt
    );
    const hover = this.flying
      ? Math.sin(performance.now() * this.profile.hoverFrequency) *
        this.profile.hoverAmplitude
      : 0;
    return this.currentAltitude + hover;
  }

  public updateBank(turnDiff: number, banking: boolean, dt: number): void {
    const target = banking
      ? THREE.MathUtils.clamp(
          -turnDiff * this.profile.bankStrength,
          -this.profile.bankLimit,
          this.profile.bankLimit
        )
      : 0;
    this.bank = THREE.MathUtils.damp(this.bank, target, banking ? 12.0 : 10.0, dt);
  }

  public boost(height: number): void {
    this.flying = true;
    this.targetAltitude = Math.min(16, this.targetAltitude + height);
    this.currentAltitude = Math.min(16, this.currentAltitude + height);
  }

  public reset(): void {
    this.flying = false;
    this.targetAltitude = 0;
    this.currentAltitude = 0;
    this.bank = 0;
  }
}

export default FlightSystem;
