/**
 * IronManUnibeam.ts
 * Ability 3 module for Iron Man: chest Arc Reactor Unibeam.
 * Charges the chest core, then fires a heavy Bézier energy blast with AoE damage.
 * Faithful port of the real gameplay implementation.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { activeIronManConfig } from './IronManConfig';
import type { BezierMissile } from './IronManMicroMissiles';
import type { IronManExplosionCallback } from './IronManRepulsor';

export type IronManHitStopCallback = (seconds: number) => void;

export class IronManUnibeam {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private getAimDestination?: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private getCustomColor?: () => string | null;
  private onExplosion?: IronManExplosionCallback;
  private onHitStop?: IronManHitStopCallback;

  private charging = false;
  private chargeTimer = 0;
  private chargeDuration = 0.3;
  private chargeMesh: THREE.Mesh | null = null;
  private chargeLight: THREE.PointLight | null = null;
  private lastAim: { pos: THREE.Vector3; target: TargetDummy | null } | null = null;
  private missiles: BezierMissile[] = [];

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    getAimDestination?: () => { pos: THREE.Vector3; target: TargetDummy | null },
    getCustomColor?: () => string | null,
    onExplosion?: IronManExplosionCallback,
    onHitStop?: IronManHitStopCallback
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.getAimDestination = getAimDestination;
    this.getCustomColor = getCustomColor;
    this.onExplosion = onExplosion;
    this.onHitStop = onHitStop;

    this.initChargeMeshes();
  }

  public get isCharging(): boolean {
    return this.charging;
  }

  private resolveCustomColor(fallback: number): number {
    const custom = this.getCustomColor?.();
    if (!custom) return fallback;
    const parsed = parseInt(custom.replace('#', ''), 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private initChargeMeshes(): void {
    const chargeGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const chargeMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
    this.chargeMesh.visible = false;
    this.scene.add(this.chargeMesh);

    this.chargeLight = new THREE.PointLight(0xff3b00, 0, 6);
    this.scene.add(this.chargeLight);
  }

  public fire(aimDestination: { pos: THREE.Vector3; target: TargetDummy | null }): boolean {
    if (this.charging) return false;

    this.charging = true;
    this.chargeTimer = 0;
    this.chargeDuration = Math.max(0, activeIronManConfig.unibeam.chargeTime);
    this.lastAim = {
      pos: aimDestination.pos.clone(),
      target: aimDestination.target,
    };

    if (this.chargeMesh && this.chargeLight) {
      const chargeCol = this.resolveCustomColor(0xff3b00);
      (this.chargeMesh.material as THREE.MeshBasicMaterial).color.setHex(chargeCol);
      this.chargeLight.color.setHex(chargeCol);
      this.chargeMesh.visible = true;
      this.chargeLight.intensity = 1.0;
    }

    audioSystem.playUnibeamCharge();
    this.onShake(0.04);
    return true;
  }

  private launchConcentratedBlast(): void {
    const aim = this.getAimDestination?.() || this.lastAim;
    if (!aim) return;

    const dest = aim.pos.clone();
    const target = aim.target;

    const chestPos = new THREE.Vector3();
    this.stickman.upperTorso.getWorldPosition(chestPos);

    const p0 = chestPos.clone().add(new THREE.Vector3(0, 0.2, -0.4));
    const p1 = p0.clone().add(new THREE.Vector3(0, 1.2, -4));
    const p2 = dest.clone().add(new THREE.Vector3(0, 0.6, 3));
    const p3 = dest.clone();

    const blastCol = this.resolveCustomColor(0xff3b00);
    const heavyModel = this.createHeavyEnergyBlastModel(blastCol);
    heavyModel.position.copy(p0);
    this.scene.add(heavyModel);

    this.missiles.push({
      p0,
      p1,
      p2,
      p3,
      target,
      targetPos: dest,
      t: 0,
      duration: 0.72,
      mesh: heavyModel,
      trailTimer: 0,
      isDead: false,
      isHeavy: true,
    });

    audioSystem.playMissileLaunch();
    this.onShake(0.12);
  }

  private createHeavyEnergyBlastModel(color: number): THREE.Group {
    const grp = new THREE.Group();

    const coreGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.2, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    grp.add(core);

    const glowGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.4, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    grp.add(glow);

    const ringGeo = new THREE.TorusGeometry(0.44, 0.045, 8, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.y = Math.PI / 4;
    grp.add(ring);

    const light = new THREE.PointLight(color, 4.5, 9);
    grp.add(light);
    return grp;
  }

  public update(dt: number, dummies: TargetDummy[], playerRotationY: number = 0): void {
    const cfg = activeIronManConfig.unibeam;

    if (this.charging) {
      this.chargeTimer += dt;
      const chestPos = new THREE.Vector3();
      this.stickman.upperTorso.getWorldPosition(chestPos);
      const chestForward = new THREE.Vector3(-Math.sin(playerRotationY), 0, -Math.cos(playerRotationY));
      const auraPos = chestPos.clone().add(new THREE.Vector3(0, 0.2, 0)).addScaledVector(chestForward, 0.35);

      if (this.chargeMesh && this.chargeLight) {
        this.chargeMesh.position.copy(auraPos);
        this.chargeLight.position.copy(auraPos);
        const duration = Math.max(0.0001, this.chargeDuration);
        const p = this.chargeTimer / duration;
        const scale = 0.25 + p * 0.70 + (Math.random() - 0.5) * 0.08;
        this.chargeMesh.scale.set(scale, scale, scale);
        this.chargeLight.intensity = p * 4.5;
      }

      if (this.chargeTimer >= this.chargeDuration) {
        this.charging = false;
        if (this.chargeMesh) this.chargeMesh.visible = false;
        if (this.chargeLight) this.chargeLight.intensity = 0;
        this.launchConcentratedBlast();
      }
    }

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.t += dt / Math.max(0.05, m.duration);

      if (m.t >= 1.0) {
        const hitPos = m.p3.clone();
        hitPos.y = Math.max(0.2, hitPos.y);

        const aoeRadius = 5.0;
        this.onExplosion?.(hitPos, aoeRadius, 0xff4500);
        audioSystem.playExplosion();
        this.onShake(0.18);
        this.onHitStop?.(0.055);

        const damagedSet = new Set<number>();
        for (const dummy of dummies) {
          if (dummy.isDead || damagedSet.has(dummy.id)) continue;
          const dist = dummy.getCenter().distanceTo(hitPos);
          if (dist <= aoeRadius) {
            damagedSet.add(dummy.id);
            const kbDir = dummy.getCenter().sub(hitPos).normalize().multiplyScalar(10);
            kbDir.y = 2.5;
            this.onDamageDealt(dummy, cfg.damage, dummy.getCenter(), kbDir);
          }
        }

        this.scene.remove(m.mesh);
        this.missiles.splice(i, 1);
        continue;
      }

      const u = m.t;
      const invU = 1 - u;
      const pos = new THREE.Vector3()
        .addScaledVector(m.p0, invU * invU * invU)
        .addScaledVector(m.p1, 3 * invU * invU * u)
        .addScaledVector(m.p2, 3 * invU * u * u)
        .addScaledVector(m.p3, u * u * u);

      const tangent = new THREE.Vector3()
        .addScaledVector(m.p1.clone().sub(m.p0), 3 * invU * invU)
        .addScaledVector(m.p2.clone().sub(m.p1), 6 * invU * u)
        .addScaledVector(m.p3.clone().sub(m.p2), 3 * u * u)
        .normalize();

      m.mesh.position.copy(pos);
      m.mesh.lookAt(pos.clone().add(tangent));
    }
  }

  public dispose(): void {
    if (this.chargeMesh) {
      this.scene.remove(this.chargeMesh);
      this.chargeMesh = null;
    }
    if (this.chargeLight) {
      this.scene.remove(this.chargeLight);
      this.chargeLight = null;
    }
    for (const missile of this.missiles) {
      this.scene.remove(missile.mesh);
    }
    this.missiles = [];
    this.charging = false;
  }
}
