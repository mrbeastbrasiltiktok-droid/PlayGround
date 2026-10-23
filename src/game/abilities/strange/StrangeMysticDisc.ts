/**
 * StrangeMysticDisc.ts
 * Basic Attack Module for Doctor Strange: Orange Mystic Disc.
 * Throws a small, tilted, spinning orange energy disc from the right hand that
 * travels through real space and only damages on actual projectile collision.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { StrangeFx } from './StrangeFx';
import { activeStrangeConfig } from './DoctorStrangeConfig';

export interface MysticDiscInstance {
  mesh: THREE.Group;
  discPlane: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  startPos: THREE.Vector3;
  maxRange: number;
  maxLifetime: number;
  age: number;
  spinSpeed: number;
  impactScale: number;
  isDead: boolean;
}

export class StrangeMysticDisc {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private fx: StrangeFx;
  public onDiscCast?: (aimPitch: number) => void;

  private discs: MysticDiscInstance[] = [];

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null },
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    fx: StrangeFx
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.getAimDestination = getAimDestination;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.fx = fx;
  }

  public fire(aimPitch: number = 0): boolean {
    const cfg = activeStrangeConfig.mysticDisc;

    const handPos = new THREE.Vector3();
    this.stickman.rightHand.getWorldPosition(handPos);

    const aim = this.getAimDestination();
    const dir = aim.pos.clone().sub(handPos).normalize();

    if (this.onDiscCast) {
      this.onDiscCast(aimPitch);
    }

    const group = new THREE.Group();
    const tiltGroup = new THREE.Group();
    const discPlane = new THREE.Group();
    tiltGroup.add(discPlane);
    group.add(tiltGroup);

    // Luminous core disc (flat faces look along the flight direction)
    const coreGeo = new THREE.CylinderGeometry(cfg.discRadius, cfg.discRadius, 0.025, 28);
    const coreMat = new THREE.MeshBasicMaterial({
      color: cfg.coreColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    discPlane.add(core);

    // Hot rim edge (3D depth: the disc reads from every angle, never billboarded)
    const rimGeo = new THREE.TorusGeometry(cfg.discRadius, 0.035, 10, 36);
    const rimMat = new THREE.MeshBasicMaterial({
      color: cfg.rimColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    discPlane.add(new THREE.Mesh(rimGeo, rimMat));

    // Discrete mystic rune detail on both faces
    const runeTex = this.fx.getRuneTexture('#ffb347', 8);
    const runeGeo = new THREE.CircleGeometry(cfg.discRadius * 0.82, 28);
    const runeMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      color: cfg.discColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    discPlane.add(new THREE.Mesh(runeGeo, runeMat));
    const runeFaceBack = new THREE.Mesh(runeGeo, runeMat);
    runeFaceBack.rotation.y = Math.PI;
    discPlane.add(runeFaceBack);

    // Soft outer halo shell for volumetric feel
    const haloGeo = new THREE.SphereGeometry(cfg.discRadius * 1.05, 16, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color: cfg.glowColor,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    discPlane.add(new THREE.Mesh(haloGeo, haloMat));

    const light = new THREE.PointLight(cfg.glowColor, 2.4, 5.5);
    group.add(light);

    group.position.copy(handPos);
    this.scene.add(group);

    // Slight inclination layered under the spin axis
    tiltGroup.rotation.x = cfg.tilt;

    this.discs.push({
      mesh: group,
      discPlane,
      pos: handPos.clone(),
      vel: dir.multiplyScalar(cfg.speed),
      startPos: handPos.clone(),
      maxRange: cfg.maxRange,
      maxLifetime: cfg.maxLifetime,
      age: 0,
      spinSpeed: 14 + Math.random() * 6,
      impactScale: cfg.impactFxScale,
      isDead: false,
    });

    audioSystem.playArcaneBlast();
    this.onShake(cfg.shakeAmount);

    return true;
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    const cfg = activeStrangeConfig.mysticDisc;

    for (let i = this.discs.length - 1; i >= 0; i--) {
      const disc = this.discs[i];

      if (disc.isDead) {
        this.removeDisc(i);
        continue;
      }

      disc.age += dt;
      if (disc.age >= disc.maxLifetime) {
        this.impact(disc, null);
        continue;
      }

      disc.pos.addScaledVector(disc.vel, dt);
      disc.mesh.position.copy(disc.pos);

      // Face plane perpendicular to velocity, spinning energetically around the flight axis
      const lookTarget = disc.pos.clone().add(disc.vel);
      disc.mesh.lookAt(lookTarget);
      disc.discPlane.rotation.z += disc.spinSpeed * dt;

      // Trail sparks
      if (Math.random() < 0.5) {
        this.fx.spawnBurst(disc.pos, 1, cfg.glowColor, 0.3, 1.2, 0.1, 1.2);
      }

      // Projectile collision against live targets
      let hitDummy: TargetDummy | null = null;
      for (const dummy of dummies) {
        if (dummy.isDead) continue;
        if (disc.pos.distanceTo(dummy.getCenter()) <= dummy.radius + 0.35) {
          hitDummy = dummy;
          break;
        }
      }

      const outOfRange = disc.pos.distanceTo(disc.startPos) > disc.maxRange;
      const belowGround = disc.pos.y <= 0.05;

      if (hitDummy) {
        const knockback = disc.vel.clone().normalize().multiplyScalar(4.0);
        knockback.y = 1.6;
        this.onDamageDealt(hitDummy, cfg.damage, disc.pos.clone(), knockback);
        this.impact(disc, hitDummy);
      } else if (outOfRange || belowGround) {
        this.impact(disc, null);
      }
    }
  }

  private impact(disc: MysticDiscInstance, hitDummy: TargetDummy | null): void {
    const cfg = activeStrangeConfig.mysticDisc;
    const fxScale = cfg.impactFxScale;

    this.fx.spawnFlash(disc.pos, cfg.rimColor, 0.25 * fxScale, 1.15 * fxScale, 0.32, true, 0.85);
    this.fx.spawnBurst(disc.pos, 14, cfg.glowColor, 2.0, 5.0, 0.12, 6.0);
    this.fx.spawnShockRing(disc.pos, cfg.discColor, 0.3 * fxScale, 1.6 * fxScale, 0.4);

    if (hitDummy) {
      audioSystem.playImpact();
      this.onShake(cfg.shakeAmount * 1.4);
    } else {
      audioSystem.playImpact();
    }

    disc.isDead = true;
  }

  private removeDisc(index: number): void {
    const disc = this.discs[index];
    this.scene.remove(disc.mesh);
    disc.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.discs.splice(index, 1);
  }

  public dispose(): void {
    for (let i = this.discs.length - 1; i >= 0; i--) {
      this.removeDisc(i);
    }
    this.discs = [];
  }
}
