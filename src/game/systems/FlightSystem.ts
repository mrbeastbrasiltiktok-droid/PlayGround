import * as THREE from 'three';
import { AGATHA_FLIGHT_CONFIG } from './flight/AgathaFlightConfig';
import { IRON_MAN_FLIGHT_CONFIG } from './flight/IronManFlightConfig';

export type FlightCharacter = 'agatha' | 'ironman' | 'classic';

export interface FlightConfig {
  character: FlightCharacter;
  displayName: string;
  hoverHeight: number;
  maxSpeed: number;
  bankLimit: number;
  bankStrength: number;
  bobAmplitude: number;
  bobSpeed: number;
  accentColor: number;
  flightSound: 'arcane' | 'thruster';
}

export interface FlightUpdate {
  altitude: number;
  banking: number;
  isFlying: boolean;
  config: FlightConfig;
}

export interface FlightRestrictions {
  noFlight?: boolean;
  stunned?: boolean;
}

export class FlightSystem {
  private config: FlightConfig = IRON_MAN_FLIGHT_CONFIG;
  private flying = false;
  private targetAltitude = 0;
  private altitude = 0;
  private banking = 0;
  private speedLimit = IRON_MAN_FLIGHT_CONFIG.maxSpeed;

  public setCharacter(character: FlightCharacter): void {
    if (character === 'agatha') this.config = AGATHA_FLIGHT_CONFIG;
    else if (character === 'ironman') this.config = IRON_MAN_FLIGHT_CONFIG;
    else this.config = IRON_MAN_FLIGHT_CONFIG;
  }

  public setMaxSpeed(speed: number): void {
    this.speedLimit = Math.max(0, speed);
  }

  public get isFlying(): boolean {
    return this.flying;
  }

  public get currentAltitude(): number {
    return this.altitude;
  }

  public get targetHeight(): number {
    return this.targetAltitude;
  }

  public get bankRoll(): number {
    return this.banking;
  }

  public get activeConfig(): FlightConfig {
    return this.config;
  }

  public get maxSpeed(): number {
    return this.speedLimit;
  }

  public setFlying(value: boolean): void {
    this.flying = value;
    this.targetAltitude = value ? this.config.hoverHeight : 0;
  }

  public toggle(restrictions: FlightRestrictions = {}): { changed: boolean; flying: boolean } {
    if (restrictions.noFlight || restrictions.stunned) {
      return { changed: false, flying: this.flying };
    }
    this.setFlying(!this.flying);
    return { changed: true, flying: this.flying };
  }

  public bounce(power: number): void {
    this.flying = true;
    this.targetAltitude = Math.min(16, this.targetAltitude + power * 0.38);
    this.altitude = Math.min(16, this.altitude + power * 0.38);
  }

  public update(dt: number, extraAltitude = 0): FlightUpdate {
    if (this.flying) this.targetAltitude = this.config.hoverHeight;
    this.altitude = THREE.MathUtils.damp(this.altitude, this.targetAltitude, 6.0, dt);
    const bob = this.flying
      ? Math.sin(performance.now() * 0.001 * this.config.bobSpeed) * this.config.bobAmplitude
      : 0;

    return {
      altitude: this.altitude + bob + extraAltitude,
      banking: this.banking,
      isFlying: this.flying,
      config: this.config,
    };
  }

  public applyTurn(turnDelta: number, dt: number): number {
    const target = this.flying
      ? THREE.MathUtils.clamp(-turnDelta * this.config.bankStrength, -this.config.bankLimit, this.config.bankLimit)
      : 0;
    this.banking = THREE.MathUtils.damp(this.banking, target, this.flying ? 12.0 : 10.0, dt);
    return this.banking;
  }

  public reset(): void {
    this.flying = false;
    this.targetAltitude = 0;
    this.altitude = 0;
    this.banking = 0;
  }
}
