/**
 * FlightSystem.ts
 * Single source of truth for flight physics shared by every character.
 * Characters only provide a CharacterFlightProfile plus their own
 * ability/animation/VFX modules.
 */

import * as THREE from 'three';
import type { CharacterFlightProfile } from './CharacterFlightConfig';

export type FlightEndReason =
  | 'toggle'
  | 'landed'
  | 'duration'
  | 'interrupted'
  | 'disabled'
  | 'restricted';

export interface FlightFrameInput {
  magnitude: number;
  ascend: number;
  descend: number;
  turnDelta: number;
}

export interface FlightState {
  active: boolean;
  landing: boolean;
  altitude: number;
  baseAltitude: number;
  verticalVelocity: number;
  speed: number;
  bankRoll: number;
  elapsed: number;
  durationRemaining: number;
  event: 'activated' | 'deactivated' | 'landed' | null;
  endReason: FlightEndReason | null;
}

export interface FlightSystemOptions {
  getProfile: () => CharacterFlightProfile;
  getPlayerPosition: () => THREE.Vector3;
  getStructures: () => THREE.Box3[];
  getCollisionRadius: () => number;
  canActivate: () => boolean;
  getSpeedMultiplier?: () => number;
}

const PLAYER_HEIGHT = 1.7;

export class FlightSystem {
  private options: FlightSystemOptions;

  private active = false;
  private landing = false;
  private altitude = 0;
  private targetAltitude = 0;
  private verticalVelocity = 0;
  private speed = 0;
  private bankRoll = 0;
  private elapsed = 0;
  private bounceReturnAt = 0;
  private endReason: FlightEndReason | null = null;

  constructor(options: FlightSystemOptions) {
    this.options = options;
  }

  public isActive(): boolean {
    return this.active;
  }

  public isLanding(): boolean {
    return this.landing;
  }

  public activate(): boolean {
    const profile = this.options.getProfile();
    if (!profile.enabled || !this.options.canActivate()) return false;

    const floor = this.computeFloor(this.options.getPlayerPosition(), this.altitude, profile);
    const ceiling = this.computeCeiling(this.options.getPlayerPosition(), this.altitude, profile);
    const startAltitude = Math.max(this.altitude, floor);

    this.active = true;
    this.landing = false;
    this.elapsed = 0;
    this.verticalVelocity = 0;
    this.bounceReturnAt = 0;
    this.endReason = null;
    this.targetAltitude = THREE.MathUtils.clamp(
      Math.max(startAltitude, profile.hoverAltitude),
      floor,
      Math.min(profile.maxAltitude, ceiling)
    );
    this.altitude = THREE.MathUtils.clamp(startAltitude, floor, Math.min(profile.maxAltitude, ceiling));
    return true;
  }

  public deactivate(reason: FlightEndReason = 'toggle'): FlightEndReason {
    if (this.active) {
      this.active = false;
      this.landing = true;
      this.verticalVelocity = 0;
      this.bounceReturnAt = 0;
      this.endReason = reason;
    }
    return reason;
  }

  public interrupt(reason: FlightEndReason = 'interrupted'): void {
    this.deactivate(reason);
  }

  public bounce(height: number): void {
    const profile = this.options.getProfile();
    if (!profile.enabled) return;

    const wasActive = this.active;
    if (!wasActive) {
      this.active = true;
      this.landing = false;
      this.elapsed = 0;
      this.verticalVelocity = 0;
      this.endReason = null;
    }

    const floor = this.computeFloor(this.options.getPlayerPosition(), this.altitude, profile);
    const ceiling = this.computeCeiling(this.options.getPlayerPosition(), this.altitude, profile);
    const maxAltitude = Math.min(profile.maxAltitude, ceiling);
    this.targetAltitude = THREE.MathUtils.clamp(
      Math.max(this.targetAltitude, this.altitude) + Math.max(0, height),
      floor,
      maxAltitude
    );
    this.altitude = this.targetAltitude;
    this.bounceReturnAt = this.elapsed + 0.9;
  }

  public setAltitude(altitude: number): void {
    const profile = this.options.getProfile();
    const floor = this.computeFloor(this.options.getPlayerPosition(), altitude, profile);
    const ceiling = this.computeCeiling(this.options.getPlayerPosition(), altitude, profile);
    this.altitude = THREE.MathUtils.clamp(altitude, floor, Math.min(profile.maxAltitude, ceiling));
    this.targetAltitude = this.altitude;
  }

  public update(dt: number, input: FlightFrameInput): FlightState {
    const profile = this.options.getProfile();
    const position = this.options.getPlayerPosition();
    const multiplier = Math.max(0, this.options.getSpeedMultiplier?.() ?? 1);
    const maxSpeed = Math.max(0.1, profile.maxSpeed * multiplier);
    const magnitude = THREE.MathUtils.clamp(input.magnitude, 0, 1);

    let event: FlightState['event'] = null;

    if (this.active) {
      this.elapsed += dt;

      if (!profile.enabled) {
        this.deactivate('disabled');
        event = 'deactivated';
      } else if (!this.options.canActivate()) {
        this.deactivate('restricted');
        event = 'deactivated';
      } else if (profile.maxDuration > 0 && this.elapsed >= profile.maxDuration) {
        this.deactivate('duration');
        event = 'deactivated';
      }
    }

    if (this.active) {
      const floor = this.computeFloor(position, this.altitude, profile);
      const ceiling = Math.max(floor, this.computeCeiling(position, this.altitude, profile));
      const upperLimit = Math.min(profile.maxAltitude, ceiling);

      const ascend = profile.canAscend ? THREE.MathUtils.clamp(input.ascend, 0, 1) : 0;
      const descend = profile.canDescend ? THREE.MathUtils.clamp(input.descend, 0, 1) : 0;

      if (ascend > 0) {
        this.targetAltitude += profile.verticalSpeed * ascend * dt;
      } else if (descend > 0) {
        this.targetAltitude -= profile.verticalSpeed * descend * dt;
      } else if (this.bounceReturnAt > 0 && this.elapsed >= this.bounceReturnAt) {
        this.targetAltitude = THREE.MathUtils.damp(
          this.targetAltitude,
          profile.hoverAltitude,
          2.5,
          dt
        );
      }

      this.targetAltitude = THREE.MathUtils.clamp(this.targetAltitude, floor, upperLimit);

      const previousAltitude = this.altitude;
      this.altitude = THREE.MathUtils.damp(
        this.altitude,
        this.targetAltitude,
        Math.max(0.1, profile.inertia),
        dt
      );
      this.altitude = THREE.MathUtils.clamp(this.altitude, floor, upperLimit);
      this.verticalVelocity = dt > 0 ? (this.altitude - previousAltitude) / dt : 0;

      const targetSpeed = magnitude * maxSpeed;
      const rate = targetSpeed > this.speed ? profile.acceleration : profile.deceleration;
      this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, Math.max(0.1, rate), dt);
      if (this.speed < 0.005) this.speed = 0;

      const targetBank = magnitude > 0.05
        ? THREE.MathUtils.clamp(-input.turnDelta * 0.55, -0.42, 0.42)
        : 0;
      const bankRate = magnitude > 0.05 ? profile.stability : 10;
      this.bankRoll = THREE.MathUtils.damp(this.bankRoll, targetBank, Math.max(0.1, bankRate), dt);
    } else if (this.landing) {
      this.speed = THREE.MathUtils.damp(this.speed, 0, Math.max(0.1, profile.deceleration), dt);
      this.bankRoll = THREE.MathUtils.damp(this.bankRoll, 0, 10, dt);

      this.verticalVelocity -= Math.max(0, profile.gravity) * dt;
      this.altitude += this.verticalVelocity * dt;

      const floor = this.computeFloor(position, Math.max(0, this.altitude + 0.4), profile);
      if (this.altitude <= floor) {
        this.altitude = floor;
        this.verticalVelocity = 0;
        this.speed = 0;
        this.bankRoll = 0;
        this.landing = false;
        this.endReason = 'landed';
        event = 'landed';
      }
    } else {
      this.speed = 0;
      this.bankRoll = 0;
      this.verticalVelocity = 0;
      this.altitude = 0;
      this.targetAltitude = 0;
    }

    const hoverBob = this.active
      ? Math.sin(performance.now() * 0.0035) * 0.12
      : 0;
    const durationRemaining = profile.maxDuration > 0
      ? Math.max(0, profile.maxDuration - this.elapsed)
      : Number.POSITIVE_INFINITY;

    return {
      active: this.active,
      landing: this.landing,
      altitude: this.altitude + hoverBob,
      baseAltitude: this.altitude,
      verticalVelocity: this.verticalVelocity,
      speed: this.speed,
      bankRoll: this.bankRoll,
      elapsed: this.elapsed,
      durationRemaining,
      event,
      endReason: this.endReason,
    };
  }

  public getAltitude(): number {
    return this.altitude;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public getBankRoll(): number {
    return this.bankRoll;
  }

  public getDurationRemaining(): number {
    const profile = this.options.getProfile();
    return profile.maxDuration > 0 ? Math.max(0, profile.maxDuration - this.elapsed) : Number.POSITIVE_INFINITY;
  }

  public computeFloor(
    position: THREE.Vector3,
    altitude: number,
    profile?: CharacterFlightProfile
  ): number {
    const boxes = this.options.getStructures();
    const radius = this.options.getCollisionRadius();
    let floor = 0;

    for (const box of boxes) {
      if (position.x + radius < box.min.x || position.x - radius > box.max.x) continue;
      if (position.z + radius < box.min.z || position.z - radius > box.max.z) continue;
      if (box.max.y <= altitude + 0.35 && box.max.y > floor) {
        floor = box.max.y;
      }
    }

    const maxAltitude = profile?.maxAltitude ?? this.options.getProfile().maxAltitude;
    return Math.min(floor, maxAltitude);
  }

  public computeCeiling(
    position: THREE.Vector3,
    altitude: number,
    profile?: CharacterFlightProfile
  ): number {
    const boxes = this.options.getStructures();
    const radius = this.options.getCollisionRadius();
    let ceiling = profile?.maxAltitude ?? this.options.getProfile().maxAltitude;

    for (const box of boxes) {
      if (position.x + radius < box.min.x || position.x - radius > box.max.x) continue;
      if (position.z + radius < box.min.z || position.z - radius > box.max.z) continue;
      if (box.min.y >= altitude + PLAYER_HEIGHT * 0.5) {
        ceiling = Math.min(ceiling, box.min.y - PLAYER_HEIGHT);
      }
    }

    return Math.max(0, ceiling);
  }

  public reset(): void {
    this.active = false;
    this.landing = false;
    this.altitude = 0;
    this.targetAltitude = 0;
    this.verticalVelocity = 0;
    this.speed = 0;
    this.bankRoll = 0;
    this.elapsed = 0;
    this.bounceReturnAt = 0;
    this.endReason = null;
  }
}
