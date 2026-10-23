/**
 * DoctorStrangeAbilities.ts
 * Central Character Controller & Ability Coordinator for Doctor Strange
 * (Cinematic Mystic Arts Combat System). Coordinates modular ability
 * implementations (each under src/game/abilities/strange/):
 * - StrangeMysticDisc (Basic attack: Orange Mystic Disc)
 * - StrangeMysticBeam (Ability 1: Orange Mystic Beam)
 * - StrangeMysticShield (Ability 2: Mystic Shield)
 * - StrangeGreenExplosion (Ability 3: Green Mystic Explosion)
 * - StrangeMysticFlight (Mobility: Mystic Flight with the Cloak of Levitation)
 * - StrangePortalStep (Dash: Mystic Portal Step)
 * - DoctorStrangeConfig (Tunable settings)
 */

import * as THREE from 'three';
import { TargetDummy } from './TargetDummy';
import { StickmanNodes } from './StickmanRig';
import { StrangeFx } from './abilities/strange/StrangeFx';
import { StrangeMysticDisc } from './abilities/strange/StrangeMysticDisc';
import { StrangeMysticBeam } from './abilities/strange/StrangeMysticBeam';
import { StrangeMysticShield } from './abilities/strange/StrangeMysticShield';
import { StrangeGreenExplosion } from './abilities/strange/StrangeGreenExplosion';
import { StrangeMysticFlight } from './abilities/strange/StrangeMysticFlight';
import { StrangePortalStep, PortalStepApi } from './abilities/strange/StrangePortalStep';
import {
  activeStrangeConfig,
  updateStrangeConfig,
  resetStrangeConfig,
  DoctorStrangeAbilitySettings,
} from './abilities/strange/DoctorStrangeConfig';

export { activeStrangeConfig, updateStrangeConfig, resetStrangeConfig };
export type { DoctorStrangeAbilitySettings };

export interface StrangeFlightInfo {
  speed: number;
  accelerationDamp: number;
}

export class DoctorStrangeAbilities {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;

  private fx: StrangeFx;

  // Modular ability instances
  public discModule: StrangeMysticDisc;
  public beamModule: StrangeMysticBeam;
  public shieldModule: StrangeMysticShield;
  public explosionModule: StrangeGreenExplosion;
  public flightModule: StrangeMysticFlight;
  public portalModule: StrangePortalStep;

  public onDiscCast?: (aimPitch: number) => void;

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null },
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.getAimDestination = getAimDestination;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;

    this.fx = new StrangeFx(scene);

    this.discModule = new StrangeMysticDisc(scene, stickman, getAimDestination, onDamageDealt, onShake, this.fx);
    this.beamModule = new StrangeMysticBeam(scene, stickman, getAimDestination, onDamageDealt, onShake, this.fx);
    this.shieldModule = new StrangeMysticShield(scene, stickman, onShake, this.fx);
    this.explosionModule = new StrangeGreenExplosion(scene, stickman, getAimDestination, onDamageDealt, onShake, this.fx);
    this.flightModule = new StrangeMysticFlight(scene, stickman);
    this.portalModule = new StrangePortalStep(scene, onShake, this.fx);

    this.discModule.onDiscCast = (aimPitch) => {
      if (this.onDiscCast) {
        this.onDiscCast(aimPitch);
      }
    };
  }

  // ==========================================
  // DISPATCH METHODS
  // ==========================================

  public fireDisc(aimPitch: number = 0): boolean {
    return this.discModule.fire(aimPitch);
  }

  public startBeam(): boolean {
    return this.beamModule.start();
  }

  public stopBeam(): void {
    this.beamModule.stop();
  }

  public toggleBeam(): boolean {
    if (this.beamModule.isActive) {
      this.beamModule.stop();
      return true;
    }
    return this.beamModule.start();
  }

  public get isBeamActive(): boolean {
    return this.beamModule.isActive;
  }

  public triggerShield(playerPos: THREE.Vector3, playerRotationY: number, dummies: TargetDummy[]): boolean {
    return this.shieldModule.activate(playerPos, playerRotationY, dummies);
  }

  public get isShieldActive(): boolean {
    return this.shieldModule.isActive;
  }

  public triggerExplosion(): boolean {
    return this.explosionModule.fire();
  }

  public get isExplosionCharging(): boolean {
    return this.explosionModule.isCharging;
  }

  public syncFlightState(isFlying: boolean): void {
    this.flightModule.syncFlightState(isFlying);
  }

  /** Explicit take-off hook (called by GameScene.toggleFlight). */
  public triggerMysticFlight(
    playerPos: THREE.Vector3 = new THREE.Vector3(),
    _playerRotationY: number = 0
  ): boolean {
    this.flightModule.syncFlightState(true);
    if (!this.flightModule.isCapeVisible) {
      this.flightModule.update(0.016, playerPos, _playerRotationY);
    }
    return true;
  }

  /** Explicit landing hook (called by GameScene.toggleFlight). */
  public cancelMysticFlight(
    _playerPos: THREE.Vector3 = new THREE.Vector3(),
    _playerRotationY: number = 0
  ): void {
    this.flightModule.syncFlightState(false);
  }

  public getFlightInfo(): StrangeFlightInfo {
    return {
      speed: this.flightModule.getFlightSpeed(),
      accelerationDamp: this.flightModule.getFlightAccelerationDamp(),
    };
  }

  public triggerPortalStep(
    playerPos: THREE.Vector3,
    inputDir: THREE.Vector3,
    structureBoxes: THREE.Box3[],
    api: PortalStepApi
  ): boolean {
    return this.portalModule.execute(playerPos, inputDir, structureBoxes, api);
  }

  public get isPortalStepActive(): boolean {
    return this.portalModule.isActive;
  }

  public getPortalAnimSpeed(): number {
    return this.portalModule.getPortalAnimSpeed();
  }

  // ==========================================
  // FRAME UPDATE LOOP
  // ==========================================
  public update(
    dt: number,
    playerPos: THREE.Vector3,
    dummies: TargetDummy[],
    playerRotationY: number,
    isFlying: boolean
  ): void {
    this.discModule.update(dt, dummies);
    this.beamModule.update(dt, dummies);
    this.shieldModule.update(dt, playerPos, playerRotationY, dummies);
    this.explosionModule.update(dt, dummies);
    this.flightModule.syncFlightState(isFlying);
    this.flightModule.update(dt, playerPos, playerRotationY);
    this.portalModule.update(dt);
    this.fx.update(dt);
  }

  public cancelAll(): void {
    this.discModule.dispose();
    this.beamModule.reset();
    this.shieldModule.cancel();
    this.explosionModule.cancel();
    this.flightModule.cancel();
    this.portalModule.cancel();
  }

  public dispose(): void {
    this.discModule.dispose();
    this.beamModule.dispose();
    this.shieldModule.dispose();
    this.explosionModule.dispose();
    this.flightModule.dispose();
    this.portalModule.dispose();
    this.fx.dispose();
  }
}
