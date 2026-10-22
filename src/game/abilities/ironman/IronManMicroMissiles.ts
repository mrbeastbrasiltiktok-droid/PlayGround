/**
 * IronManMicroMissiles.ts
 * Ability 1 module for Iron Man: curved Bézier micro-missile volley.
 * Faithful port of the real gameplay implementation.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import {
  activeIronManConfig,
  DEFAULT_IRONMAN_CONFIG,
} from './IronManConfig';
import type { IronManExplosionCallback } from './IronManRepulsor';

export interface BezierMissile {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  target: TargetDummy | null;
  targetPos: THREE.Vector3;
  t: number;
  duration: number;
  mesh: THREE.Group;
  trailTimer: number;
  isDead: boolean;
  isHeavy: boolean;
}

export type IronManSmokeCallback = (
  pos: THREE.Vector3,
  size: number,
  maxAge: number
) => void;

export class IronManMicroMissiles {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private getCustomColor?: () => string | null;
  private onExplosion?: IronManExplosionCallback;
  private onSmoke?: IronManSmokeCallback;

  private missiles: BezierMissile[] = [];

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    getCustomColor?: () => string | null,
    onExplosion?: IronManExplosionCallback,
    onSmoke?: IronManSmokeCallback
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.getCustomColor = getCustomColor;
    this.onExplosion = onExplosion;
    this.onSmoke = onSmoke;
  }

  public fire(target: TargetDummy | null, aimPoint: THREE.Vector3): boolean {
    const cfg = activeIronManConfig.microMissiles;
    const dest = aimPoint.clone();
    const hitTarget = target && !target.isDead ? target : null;

    const shoulderL = new THREE.Vector3();
    const shoulderR = new THREE.Vector3();
    this.stickman.leftShoulder.getWorldPosition(shoulderL);
    this.stickman.rightShoulder.getWorldPosition(shoulderR);

    audioSystem.playMissileLaunch();
    this.onShake(0.05);

    const volleyCount = Math.max(1, Math.round(cfg.volleyCount));
    const speedRatio = DEFAULT_IRONMAN_CONFIG.microMissiles.speed / Math.max(1, cfg.speed);
    const arcRatio = cfg.arcHeight / Math.max(0.1, DEFAULT_IRONMAN_CONFIG.microMissiles.arcHeight);

    for (let i = 0; i < volleyCount; i++) {
      const isLeft = i < Math.ceil(volleyCount / 2);
      const indexInSide = i % Math.ceil(volleyCount / 2);
      const start = isLeft ? shoulderL.clone() : shoulderR.clone();
      const sideSign = isLeft ? -1 : 1;

      const arcWidth = 2.4 + indexInSide * 1.6;
      const arcHeight = (2.2 + indexInSide * 0.9) * Math.max(0.1, arcRatio);

      const p0 = start;
      const p1 = start.clone().add(new THREE.Vector3(sideSign * arcWidth, arcHeight, -3));
      const p2 = dest.clone().add(new THREE.Vector3(sideSign * (arcWidth * 0.5), arcHeight * 0.4, 4));
      const p3 = dest.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        0.5,
        (Math.random() - 0.5) * 1.2
      ));

      const model = this.createMissileModel(0.7, 0xbdc3c7);
      model.position.copy(p0);
      this.scene.add(model);

      const delay = i * 0.05;
      this.missiles.push({
        p0,
        p1,
        p2,
        p3,
        target: hitTarget,
        targetPos: dest,
        t: -delay,
        duration: (0.85 + indexInSide * 0.08) * speedRatio,
        mesh: model,
        trailTimer: 0,
        isDead: false,
        isHeavy: false,
      });
    }

    return true;
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    const cfg = activeIronManConfig.microMissiles;

    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.t += dt / Math.max(0.05, m.duration);

      if (m.t < 0) continue;

      if (m.t >= 1.0) {
        const hitPos = m.p3.clone();
        hitPos.y = Math.max(0.2, hitPos.y);

        const aoeRadius = 4.0;
        this.onExplosion?.(hitPos, aoeRadius, 0xff7700);
        audioSystem.playExplosion();
        this.onShake(0.12);

        const hitDummies = new Set<number>();
        for (const dummy of dummies) {
          if (dummy.isDead || hitDummies.has(dummy.id)) continue;
          if (dummy.getCenter().distanceTo(hitPos) <= aoeRadius) {
            hitDummies.add(dummy.id);
            const kbDir = dummy.getCenter().sub(hitPos).normalize().multiplyScalar(6);
            kbDir.y = 1.5;
            this.onDamageDealt(dummy, cfg.damagePerMissile, dummy.getCenter(), kbDir);
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

      m.trailTimer += dt;
      if (m.trailTimer > 0.04) {
        m.trailTimer = 0;
        this.onSmoke?.(pos.clone(), m.isHeavy ? 0.35 : 0.16, 0.45);
      }
    }
  }

  private createMissileModel(scale: number, color: number): THREE.Group {
    const grp = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.7 * scale, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    grp.add(body);

    const coneGeo = new THREE.ConeGeometry(0.085 * scale, 0.25 * scale, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, metalness: 0.5, roughness: 0.3 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.z = -0.45 * scale;
    cone.rotation.x = -Math.PI / 2;
    grp.add(cone);

    const flameGeo = new THREE.ConeGeometry(0.07 * scale, 0.3 * scale, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.z = 0.45 * scale;
    flame.rotation.x = Math.PI / 2;
    grp.add(flame);

    return grp;
  }

  public dispose(): void {
    for (const missile of this.missiles) {
      this.scene.remove(missile.mesh);
    }
    this.missiles = [];
  }
}
