/**
 * StrangeMysticShield.ts
 * Ability 2 Module for Doctor Strange: Mystic Shield.
 * Projects a large circular mandala of orange energy in front of Strange with
 * concentric rings, runes and a luminous rim. Integrates with the real combat
 * system through the IsShield restriction while resistance lasts. On expiry or
 * break, mystical butterflies emerge and dissolve away, leaving nothing behind.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { gameplayRestrictions } from '../../GameplayRestrictions';
import { StrangeFx } from './StrangeFx';
import { activeStrangeConfig } from './DoctorStrangeConfig';

const SHIELD_SOURCE = 'strange-mystic-shield';

export class StrangeMysticShield {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private onShake: (amount: number) => void;
  private fx: StrangeFx;

  public isActive: boolean = false;
  public shieldHealth: number = 0;

  private timer: number = 0;
  private group: THREE.Group;
  private runeLayer: THREE.Mesh;
  private innerRing: THREE.Mesh;
  private runeLayerMat: THREE.MeshBasicMaterial;
  private discMat: THREE.MeshBasicMaterial;
  private light: THREE.PointLight;
  private sparkTimer: number = 0;

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    onShake: (amount: number) => void,
    fx: StrangeFx
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.onShake = onShake;
    this.fx = fx;

    const cfg = activeStrangeConfig.mysticShield;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Core translucent disc
    const discGeo = new THREE.CircleGeometry(cfg.radius, 48);
    this.discMat = new THREE.MeshBasicMaterial({
      color: cfg.discColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.group.add(new THREE.Mesh(discGeo, this.discMat));

    // Rune mandala layer (spins slowly around the shield normal)
    const runeTex = this.fx.getRuneTexture('#ffb347', 14);
    const runeGeo = new THREE.CircleGeometry(cfg.radius * 0.94, 48);
    this.runeLayerMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      color: cfg.runeColor,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.runeLayer = new THREE.Mesh(runeGeo, this.runeLayerMat);
    this.group.add(this.runeLayer);

    // Concentric energy rings
    const ring1Geo = new THREE.RingGeometry(cfg.radius * 0.62, cfg.radius * 0.68, 48);
    const ring1 = new THREE.Mesh(ring1Geo, this.runeLayerMat);
    this.group.add(ring1);

    const ring2Geo = new THREE.RingGeometry(cfg.radius * 0.38, cfg.radius * 0.42, 40);
    this.innerRing = new THREE.Mesh(ring2Geo, this.discMat);
    this.group.add(this.innerRing);

    // Luminous rim
    const rimGeo = new THREE.TorusGeometry(cfg.radius, 0.06, 12, 56);
    const rimMat = new THREE.MeshBasicMaterial({
      color: cfg.rimColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.group.add(new THREE.Mesh(rimGeo, rimMat));

    this.light = new THREE.PointLight(cfg.discColor, 0, 10);
    this.group.add(this.light);
  }

  public activate(playerPos: THREE.Vector3, playerRotationY: number, dummies: TargetDummy[]): boolean {
    const cfg = activeStrangeConfig.mysticShield;
    if (this.isActive) return false;

    this.isActive = true;
    this.timer = cfg.duration;
    this.shieldHealth = cfg.shieldHealth;
    this.group.visible = true;
    this.light.intensity = 3.4;

    gameplayRestrictions.applyRestriction('IsShield', SHIELD_SOURCE, cfg.duration);

    this.updateTransform(playerPos, playerRotationY);

    // Opening spark burst on the shield surface
    this.fx.spawnBurst(this.group.position.clone(), 16, cfg.discColor, 1.5, 4.0, 0.11, 3.0);
    audioSystem.playRunicWard?.();
    this.onShake(0.04);

    return true;
  }

  private updateTransform(playerPos: THREE.Vector3, playerRotationY: number): void {
    const cfg = activeStrangeConfig.mysticShield;
    const forward = new THREE.Vector3(-Math.sin(playerRotationY), 0, -Math.cos(playerRotationY)).normalize();
    const anchor = playerPos.clone().add(new THREE.Vector3(0, cfg.heightOffset, 0)).addScaledVector(forward, cfg.frontalOffset);

    this.group.position.copy(anchor);
    this.group.lookAt(anchor.clone().add(forward));
  }

  public update(dt: number, playerPos: THREE.Vector3, playerRotationY: number, dummies: TargetDummy[]): void {
    if (!this.isActive) return;

    const cfg = activeStrangeConfig.mysticShield;
    this.timer -= dt;

    this.updateTransform(playerPos, playerRotationY);

    const now = performance.now();
    this.runeLayer.rotation.z += dt * 0.9;
    this.innerRing.rotation.z -= dt * 0.6;

    const pulse = 0.82 + Math.sin(now * 0.004) * 0.1;
    this.discMat.opacity = 0.3 * pulse;
    this.runeLayerMat.opacity = 0.85 * pulse;
    this.light.intensity = 2.6 + Math.sin(now * 0.005) * 0.8;

    // Frontal blocking: resistance is consumed by blows intercepted in the shield arc
    const forward = new THREE.Vector3(-Math.sin(playerRotationY), 0, -Math.cos(playerRotationY)).normalize();
    const cosBlock = Math.cos(THREE.MathUtils.degToRad(cfg.blockAngleDeg));
    let drain = 0;
    let contact = false;

    for (const dummy of dummies) {
      if (dummy.isDead) continue;
      const toDummy = dummy.getCenter().sub(playerPos);
      const flat = new THREE.Vector3(toDummy.x, 0, toDummy.z);
      const dist = flat.length();
      if (dist > cfg.blockRadius || dist < 0.001) continue;
      flat.normalize();
      if (flat.dot(forward) < cosBlock) continue;

      contact = true;
      drain += cfg.contactDrainPerSecond;
      if (dummy.rivalBeamActive) {
        drain += cfg.rivalBeamDrainPerSecond;
      }
    }

    if (contact && drain > 0) {
      this.shieldHealth -= drain * dt;
      this.sparkTimer += dt;
      if (this.sparkTimer > 0.22) {
        this.sparkTimer = 0;
        const hitPoint = this.group.position.clone().addScaledVector(forward, 0.15);
        this.fx.spawnBurst(hitPoint, 5, cfg.rimColor, 1.0, 3.0, 0.09, 3.5);
        audioSystem.playImpact();
        this.onShake(0.02);
      }
    }

    if (this.shieldHealth <= 0) {
      this.end(true, dummies);
      return;
    }

    if (this.timer <= 0) {
      this.end(false, dummies);
    }
  }

  private end(broken: boolean, dummies: TargetDummy[]): void {
    const cfg = activeStrangeConfig.mysticShield;
    this.isActive = false;

    gameplayRestrictions.clearRestrictionsBySource(SHIELD_SOURCE);

    // Butterflies emerge from the disc and disperse organically
    const center = this.group.position.clone();
    this.fx.spawnButterflies(center, cfg.butterflyCount, cfg.rimColor, cfg.butterflyDuration);
    this.fx.spawnFlash(center, cfg.discColor, 0.5, broken ? 2.2 : 1.4, 0.4, true, 0.7);
    this.fx.spawnBurst(center, broken ? 22 : 12, cfg.discColor, 1.5, 4.5, 0.1, 3.0);

    if (broken) {
      audioSystem.playExplosion();
      this.onShake(0.08);
    } else {
      audioSystem.playRunicWard?.();
    }

    this.group.visible = false;
    this.light.intensity = 0;
  }

  public cancel(): void {
    if (!this.isActive) {
      gameplayRestrictions.clearRestrictionsBySource(SHIELD_SOURCE);
      return;
    }
    this.isActive = false;
    gameplayRestrictions.clearRestrictionsBySource(SHIELD_SOURCE);
    this.group.visible = false;
    this.light.intensity = 0;
  }

  public dispose(): void {
    this.cancel();
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}
