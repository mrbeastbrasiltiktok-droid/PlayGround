/**
 * IronManRepulsor.ts
 * Independent Basic Attack ability module for Iron Man.
 * Alternates palm repulsor bolts with homing, impact explosions and miss sparks.
 * This is the real implementation used by the active game (hot-swappable).
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { activeIronManConfig } from './IronManConfig';

export interface RepulsorBolt {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  startPos: THREE.Vector3;
  maxRange: number;
  target: TargetDummy | null;
  homingStrength: number;
  isDead: boolean;
}

export type IronManExplosionCallback = (
  pos: THREE.Vector3,
  radius: number,
  color?: number
) => void;

export class IronManRepulsor {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private getCustomColor?: () => string | null;
  private onExplosion?: IronManExplosionCallback;
  public onRepulsorFired?: (hand: 'left' | 'right', aimPitch: number) => void;

  private currentHand: 'left' | 'right' = 'right';
  private bolts: RepulsorBolt[] = [];

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null },
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    getCustomColor?: () => string | null,
    onExplosion?: IronManExplosionCallback
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.getAimDestination = getAimDestination;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.getCustomColor = getCustomColor;
    this.onExplosion = onExplosion;
  }

  private resolveCustomColor(fallback: number): number {
    const custom = this.getCustomColor?.();
    if (!custom) return fallback;
    const parsed = parseInt(custom.replace('#', ''), 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  public fire(aimPitch: number = 0): boolean {
    const cfg = activeIronManConfig.repulsor;
    this.currentHand = this.currentHand === 'right' ? 'left' : 'right';
    const hand = this.currentHand;
    const handNode = hand === 'right' ? this.stickman.rightHand : this.stickman.leftHand;

    const handPos = new THREE.Vector3();
    handNode.getWorldPosition(handPos);

    const aim = this.getAimDestination();
    const dir = aim.pos.clone().sub(handPos).normalize();

    if (this.onRepulsorFired) {
      this.onRepulsorFired(hand, aimPitch);
    }

    const group = new THREE.Group();

    const coreGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.75, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    group.add(core);

    const glowColorHex = this.resolveCustomColor(cfg.beamColor);
    const glowGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.95, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: glowColorHex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    group.add(glow);

    const lightColorHex = this.resolveCustomColor(cfg.glowColor);
    const light = new THREE.PointLight(lightColorHex, 2.8, 4.5);
    group.add(light);

    group.position.copy(handPos);
    group.lookAt(handPos.clone().add(dir));
    this.scene.add(group);

    this.bolts.push({
      mesh: group,
      pos: handPos,
      vel: dir.multiplyScalar(cfg.speed),
      startPos: handPos.clone(),
      maxRange: cfg.maxRange,
      target: aim.target,
      homingStrength: aim.target ? cfg.homingStrength : 0,
      isDead: false,
    });

    audioSystem.playRepulsor();
    this.onShake(0.015);

    return true;
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    const cfg = activeIronManConfig.repulsor;

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      if (bolt.isDead) {
        this.scene.remove(bolt.mesh);
        this.bolts.splice(i, 1);
        continue;
      }

      if (bolt.target && !bolt.target.isDead && bolt.homingStrength > 0) {
        const dest = bolt.target.getCenter();
        const dir = dest.clone().sub(bolt.pos).normalize();
        bolt.vel.lerp(dir.multiplyScalar(cfg.speed), dt * bolt.homingStrength);
      }

      bolt.pos.addScaledVector(bolt.vel, dt);
      bolt.mesh.position.copy(bolt.pos);
      bolt.mesh.lookAt(bolt.pos.clone().add(bolt.vel));

      let hit = false;
      for (const dummy of dummies) {
        if (dummy.isDead) continue;
        if (bolt.pos.distanceTo(dummy.getCenter()) <= dummy.radius + 0.3) {
          hit = true;
          this.onDamageDealt(dummy, cfg.damage, bolt.pos.clone());
          this.onExplosion?.(bolt.pos.clone(), 1.2, 0xff2233);
          audioSystem.playImpact();
          break;
        }
      }

      if (!hit && (bolt.pos.y <= 0.05 || bolt.pos.distanceTo(bolt.startPos) > bolt.maxRange)) {
        hit = true;
        this.onExplosion?.(bolt.pos.clone(), 0.8, 0xff3344);
        audioSystem.playImpact();
      }

      if (hit) {
        this.scene.remove(bolt.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const bolt of this.bolts) {
      this.scene.remove(bolt.mesh);
    }
    this.bolts = [];
  }
}
