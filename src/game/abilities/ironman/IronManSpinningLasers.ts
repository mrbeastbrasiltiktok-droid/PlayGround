/**
 * IronManSpinningLasers.ts
 * Ability 4 module for Iron Man: dual cutting lasers that sweep a full 360°.
 * Faithful port of the real gameplay implementation.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { activeIronManConfig } from './IronManConfig';
import type { IronManExplosionCallback } from './IronManRepulsor';

export class IronManSpinningLasers {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private getCustomColor?: () => string | null;
  private onExplosion?: IronManExplosionCallback;

  private active = false;
  private timer = 0;
  private duration = 1.5;
  private angle = 0;
  private slicedDummies: Set<number> = new Set();

  private leftLaserMesh: THREE.Mesh;
  private rightLaserMesh: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    getCustomColor?: () => string | null,
    onExplosion?: IronManExplosionCallback
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.getCustomColor = getCustomColor;
    this.onExplosion = onExplosion;

    const laserGeo = new THREE.CylinderGeometry(0.07, 0.07, 7.5, 12);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    this.leftLaserMesh = new THREE.Mesh(laserGeo, laserMat);
    this.rightLaserMesh = new THREE.Mesh(laserGeo, laserMat);
    this.leftLaserMesh.visible = false;
    this.rightLaserMesh.visible = false;
    this.scene.add(this.leftLaserMesh);
    this.scene.add(this.rightLaserMesh);
  }

  public get isActive(): boolean {
    return this.active;
  }

  public trigger(currentRy: number = 0): void {
    this.active = true;
    this.timer = 0;
    this.duration = Math.max(0.1, activeIronManConfig.spinningLasers.duration);
    this.angle = currentRy;
    this.slicedDummies.clear();
    this.leftLaserMesh.visible = true;
    this.rightLaserMesh.visible = true;
    audioSystem.playLaserSpin();
    this.onShake(0.06);
  }

  public stop(): void {
    this.active = false;
    this.leftLaserMesh.visible = false;
    this.rightLaserMesh.visible = false;
  }

  public update(
    dt: number,
    dummies: TargetDummy[],
    _playerRotationY: number = 0,
    setPlayerRotationY?: (ry: number) => void
  ): void {
    if (!this.active) return;

    const cfg = activeIronManConfig.spinningLasers;
    this.timer += dt;
    if (this.timer >= this.duration) {
      this.stop();
      return;
    }

    const custom = this.getCustomColor?.();
    if (custom) {
      const activeColor = new THREE.Color(custom);
      (this.leftLaserMesh.material as THREE.MeshBasicMaterial).color.copy(activeColor);
      (this.rightLaserMesh.material as THREE.MeshBasicMaterial).color.copy(activeColor);
    }

    const spinSpeed = (Math.PI * 4.0) / this.duration;
    this.angle += spinSpeed * dt;
    setPlayerRotationY?.(this.angle);

    const leftHandPos = new THREE.Vector3();
    const rightHandPos = new THREE.Vector3();
    this.stickman.leftHand.getWorldPosition(leftHandPos);
    this.stickman.rightHand.getWorldPosition(rightHandPos);

    const leftDir = new THREE.Vector3(-Math.cos(this.angle), 0, Math.sin(this.angle)).normalize();
    const rightDir = leftDir.clone().negate();

    const laserStartOffset = 0.45;
    const leftStart = leftHandPos.clone().addScaledVector(leftDir, laserStartOffset);
    const rightStart = rightHandPos.clone().addScaledVector(rightDir, laserStartOffset);

    const laserLength = cfg.radius;
    const leftEnd = leftStart.clone().addScaledVector(leftDir, laserLength);
    const rightEnd = rightStart.clone().addScaledVector(rightDir, laserLength);

    this.orientLaser(this.leftLaserMesh, leftStart, leftEnd);
    this.orientLaser(this.rightLaserMesh, rightStart, rightEnd);

    for (const dummy of dummies) {
      if (dummy.isDead) continue;
      if (this.slicedDummies.has(dummy.id)) continue;

      const center = dummy.getCenter();
      const distL = this.distPointToSegment(center, leftStart, leftEnd);
      const distR = this.distPointToSegment(center, rightStart, rightEnd);

      if (distL <= dummy.radius + 0.4 || distR <= dummy.radius + 0.4) {
        this.slicedDummies.add(dummy.id);
        const kb = center.clone().sub(leftHandPos).normalize().multiplyScalar(6);
        kb.y = 1.2;
        this.onDamageDealt(dummy, cfg.damage, center, kb);
        this.onExplosion?.(center, 1.2, 0xff0044);
        audioSystem.playImpact();
        this.onShake(0.04);
      }
    }
  }

  private orientLaser(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
    const dist = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.scale.set(1, dist / 14, 1);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
  }

  private distPointToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = b.clone().sub(a);
    const ap = p.clone().sub(a);
    const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
    const closest = a.clone().addScaledVector(ab, t);
    return closest.distanceTo(p);
  }

  public dispose(): void {
    this.active = false;
    this.scene.remove(this.leftLaserMesh);
    this.scene.remove(this.rightLaserMesh);
  }
}
