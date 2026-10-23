/**
 * StrangeGreenExplosion.ts
 * Ability 3 Module for Doctor Strange: Green Mystic Explosion.
 * Concentrates emerald energy during a windup, then releases an orb toward the
 * aim point that detonates into a volumetric spherical explosion, damaging every
 * target inside the radius exactly once per activation.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { gameplayRestrictions } from '../../GameplayRestrictions';
import { StrangeFx } from './StrangeFx';
import { activeStrangeConfig } from './DoctorStrangeConfig';

const EXPLOSION_SOURCE = 'strange-green-explosion';

interface OrbState {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  dest: THREE.Vector3;
  speed: number;
}

interface BlastState {
  group: THREE.Group;
  sphere: THREE.Mesh;
  innerSphere: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  pos: THREE.Vector3;
  radius: number;
  age: number;
  maxAge: number;
}

export class StrangeGreenExplosion {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private fx: StrangeFx;

  public isCharging: boolean = false;

  private windupTimer: number = 0;
  private chargeLeft: THREE.Mesh;
  private chargeRight: THREE.Mesh;
  private chargeLight: THREE.PointLight;
  private orb: OrbState | null = null;
  private blast: BlastState | null = null;
  private damagedThisBlast: Set<number> = new Set();

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

    const cfg = activeStrangeConfig.greenExplosion;

    const chargeGeo = new THREE.SphereGeometry(0.22, 14, 14);
    const chargeMat = new THREE.MeshBasicMaterial({
      color: cfg.glowColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.chargeLeft = new THREE.Mesh(chargeGeo, chargeMat);
    this.chargeRight = new THREE.Mesh(chargeGeo, chargeMat.clone());
    this.chargeLeft.visible = false;
    this.chargeRight.visible = false;
    this.scene.add(this.chargeLeft);
    this.scene.add(this.chargeRight);

    this.chargeLight = new THREE.PointLight(cfg.glowColor, 0, 7);
    this.scene.add(this.chargeLight);
  }

  public fire(): boolean {
    const cfg = activeStrangeConfig.greenExplosion;
    if (this.isCharging || this.orb || this.blast) return false;

    this.isCharging = true;
    this.windupTimer = 0;
    this.chargeLeft.visible = true;
    this.chargeRight.visible = true;
    this.chargeLight.intensity = 2.0;

    const safety = cfg.windup + 1.0;
    gameplayRestrictions.applyRestriction('NoMovement', EXPLOSION_SOURCE, safety);
    gameplayRestrictions.applyRestriction('NoPowers', EXPLOSION_SOURCE, safety);
    gameplayRestrictions.applyRestriction('NoBasicAttack', EXPLOSION_SOURCE, safety);

    audioSystem.playChaosOrbCast?.();

    return true;
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    const cfg = activeStrangeConfig.greenExplosion;

    if (this.isCharging) {
      this.windupTimer += dt;

      const leftPos = new THREE.Vector3();
      const rightPos = new THREE.Vector3();
      this.stickman.leftHand.getWorldPosition(leftPos);
      this.stickman.rightHand.getWorldPosition(rightPos);
      this.chargeLeft.position.copy(leftPos);
      this.chargeRight.position.copy(rightPos);
      this.chargeLight.position.copy(leftPos).add(rightPos).multiplyScalar(0.5);

      const progress = THREE.MathUtils.clamp(this.windupTimer / cfg.windup, 0, 1);
      const pulse = 0.55 + progress * 0.75 + Math.sin(performance.now() * 0.03) * 0.08;
      this.chargeLeft.scale.setScalar(pulse);
      this.chargeRight.scale.setScalar(pulse);
      this.chargeLight.intensity = 2.0 + progress * 4.5;

      if (Math.random() < 0.35) {
        this.fx.spawnBurst(this.chargeLight.position.clone(), 1, cfg.glowColor, 0.4, 1.6, 0.09, 2.0);
      }

      if (this.windupTimer >= cfg.windup) {
        this.isCharging = false;
        this.hideCharge();
        gameplayRestrictions.clearRestrictionsBySource(EXPLOSION_SOURCE);
        this.launchOrb();
      }
      return;
    }

    if (this.orb) {
      const orb = this.orb;
      const toDest = orb.dest.clone().sub(orb.pos);
      const remaining = toDest.length();

      if (remaining <= orb.speed * dt) {
        orb.pos.copy(orb.dest);
        this.scene.remove(orb.mesh);
        orb.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mat = obj.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat.dispose();
          }
        });
        this.orb = null;
        this.detonate(orb.dest, dummies);
      } else {
        orb.pos.addScaledVector(toDest.normalize(), orb.speed * dt);
        orb.mesh.position.copy(orb.pos);
        if (Math.random() < 0.6) {
          this.fx.spawnBurst(orb.pos, 1, cfg.glowColor, 0.3, 1.4, 0.1, 1.0);
        }
      }
      return;
    }

    if (this.blast) {
      const b = this.blast;
      b.age += dt;
      const progress = b.age / b.maxAge;

      if (progress >= 1) {
        this.scene.remove(b.group);
        b.sphere.geometry.dispose();
        b.innerSphere.geometry.dispose();
        b.ring.geometry.dispose();
        (b.sphere.material as THREE.Material).dispose();
        (b.innerSphere.material as THREE.Material).dispose();
        (b.ring.material as THREE.Material).dispose();
        this.blast = null;
        return;
      }

      // Expansion phase (fast growth, then smooth fade out)
      const growK = Math.min(1, progress / 0.3);
      const radius = 0.6 + (b.radius - 0.6) * Math.sin(growK * Math.PI * 0.5);
      const fade = 1 - Math.max(0, (progress - 0.3) / 0.7);

      b.sphere.scale.setScalar(radius);
      (b.sphere.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade;
      b.innerSphere.scale.setScalar(radius * 0.72);
      (b.innerSphere.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;

      const ringScale = 1 + progress * 2.4;
      b.ring.scale.setScalar(ringScale * b.radius * 0.8);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;

      b.light.intensity = 9 * fade;
    }
  }

  private launchOrb(): void {
    const cfg = activeStrangeConfig.greenExplosion;

    const handPos = new THREE.Vector3();
    this.stickman.rightHand.getWorldPosition(handPos);

    const aim = this.getAimDestination();
    let dest = aim.pos.clone();
    if (handPos.distanceTo(dest) > cfg.castRange) {
      const dir = dest.clone().sub(handPos).normalize();
      dest = handPos.clone().addScaledVector(dir, cfg.castRange);
    }

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshBasicMaterial({ color: cfg.coreColor })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 14, 14),
      new THREE.MeshBasicMaterial({
        color: cfg.glowColor,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const light = new THREE.PointLight(cfg.glowColor, 3.0, 7);
    group.add(core, halo, light);
    group.position.copy(handPos);
    this.scene.add(group);

    this.orb = {
      mesh: group,
      pos: handPos.clone(),
      dest,
      speed: cfg.orbSpeed,
    };

    audioSystem.playMissileLaunch();
    this.onShake(0.05);
  }

  private detonate(center: THREE.Vector3, dummies: TargetDummy[]): void {
    const cfg = activeStrangeConfig.greenExplosion;
    const hitPos = center.clone();
    hitPos.y = Math.max(0.4, hitPos.y);

    const group = new THREE.Group();
    group.position.copy(hitPos);

    const sphereGeo = new THREE.SphereGeometry(1, 24, 20);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: cfg.glowColor,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);

    const innerGeo = new THREE.SphereGeometry(1, 18, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: cfg.coreColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);

    const ringGeo = new THREE.RingGeometry(0.78, 1, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: cfg.deepColor,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -Math.min(0.6, hitPos.y - 0.1);

    const light = new THREE.PointLight(cfg.glowColor, 9, cfg.radius * 2.4);
    group.add(sphere, innerSphere, ring, light);
    this.scene.add(group);

    this.blast = {
      group,
      sphere,
      innerSphere,
      ring,
      light,
      pos: hitPos,
      radius: cfg.radius,
      age: 0,
      maxAge: cfg.visualDuration,
    };

    // Exactly one damage application per target per activation
    this.damagedThisBlast.clear();
    for (const dummy of dummies) {
      if (dummy.isDead || this.damagedThisBlast.has(dummy.id)) continue;
      const dCenter = dummy.getCenter();
      if (dCenter.distanceTo(hitPos) <= cfg.radius) {
        this.damagedThisBlast.add(dummy.id);
        const kbDir = dCenter.clone().sub(hitPos).normalize().multiplyScalar(7);
        kbDir.y = 2.2;
        this.onDamageDealt(dummy, cfg.damage, dCenter, kbDir);
      }
    }

    this.fx.spawnBurst(hitPos, cfg.particleCount, cfg.glowColor, 4.0, 10.0, 0.16, 8.0);
    this.fx.spawnBurst(hitPos, Math.floor(cfg.particleCount / 2), cfg.coreColor, 3.0, 8.0, 0.13, 8.0);
    this.fx.spawnShockRing(hitPos, cfg.glowColor, 1.0, cfg.radius * 1.35, 0.7);

    audioSystem.playExplosion();
    this.onShake(0.16);
  }

  private hideCharge(): void {
    this.chargeLeft.visible = false;
    this.chargeRight.visible = false;
    this.chargeLight.intensity = 0;
  }

  public cancel(): void {
    this.isCharging = false;
    this.hideCharge();
    gameplayRestrictions.clearRestrictionsBySource(EXPLOSION_SOURCE);

    if (this.orb) {
      this.scene.remove(this.orb.mesh);
      this.orb = null;
    }
  }

  public dispose(): void {
    this.cancel();
    if (this.blast) {
      this.scene.remove(this.blast.group);
      this.blast = null;
    }
    this.chargeLeft.geometry.dispose();
    (this.chargeLeft.material as THREE.Material).dispose();
    this.chargeRight.geometry.dispose();
    (this.chargeRight.material as THREE.Material).dispose();
    this.scene.remove(this.chargeLight);
  }
}
