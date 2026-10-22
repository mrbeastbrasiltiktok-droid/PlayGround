/**
 * IronManBeamClash.ts
 * Beam Clash minigame module: rival beam, clash sphere, tap momentum and resolution.
 * Owns the clash state used by the HUD (BeamClashBanner / App.tsx).
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { audioSystem } from '../../AudioSystem';
import type { IronManExplosionCallback } from './IronManRepulsor';

export interface BeamClashState {
  active: boolean;
  rival: TargetDummy | null;
  progress: number;
  clashPoint: THREE.Vector3;
  duration: number;
  maxDuration: number;
  lastTapTime: number;
}

export class IronManBeamClash {
  private scene: THREE.Scene;
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private onExplosion?: IronManExplosionCallback;

  public clashState: BeamClashState = {
    active: false,
    rival: null,
    progress: 0.5,
    clashPoint: new THREE.Vector3(),
    duration: 0,
    maxDuration: 6.0,
    lastTapTime: 0,
  };

  private rivalBeamMesh: THREE.Line;
  private rivalBeamGlow: THREE.Mesh;
  private clashSphere: THREE.Mesh;
  private clashLight: THREE.PointLight;

  constructor(
    scene: THREE.Scene,
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    onExplosion?: IronManExplosionCallback
  ) {
    this.scene = scene;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.onExplosion = onExplosion;

    const rivalMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 3 });
    const rivalGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.rivalBeamMesh = new THREE.Line(rivalGeom, rivalMat);
    this.rivalBeamMesh.visible = false;
    this.scene.add(this.rivalBeamMesh);

    const glowGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 12, 1, true);
    const rivalGlowMat = new THREE.MeshBasicMaterial({
      color: 0xaa00ff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.rivalBeamGlow = new THREE.Mesh(glowGeo, rivalGlowMat);
    this.rivalBeamGlow.visible = false;
    this.scene.add(this.rivalBeamGlow);

    const clashGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const clashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    this.clashSphere = new THREE.Mesh(clashGeo, clashMat);
    this.clashSphere.visible = false;
    this.clashLight = new THREE.PointLight(0xffaa00, 3, 8);
    this.clashSphere.add(this.clashLight);
    this.scene.add(this.clashSphere);
  }

  public get isActive(): boolean {
    return this.clashState.active;
  }

  public onTap(): void {
    if (!this.clashState.active) return;
    this.clashState.progress = Math.min(1.0, this.clashState.progress + 0.15);
    this.clashState.lastTapTime = performance.now();
    audioSystem.playBeamClash();
    this.onShake(0.1);

    if (this.clashState.progress >= 1.0) {
      this.resolve(true);
    }
  }

  public update(
    dt: number,
    midHand: THREE.Vector3,
    endPoint: THREE.Vector3,
    dummies: TargetDummy[],
    aimTarget: TargetDummy | null,
    maxRange: number
  ): THREE.Vector3 {
    let clashTarget: TargetDummy | null = null;
    for (const dummy of dummies) {
      if (!dummy.isRival || dummy.isDead || dummy.rivalCooldown > 0) continue;
      const center = dummy.getCenter();
      if (midHand.distanceTo(center) <= maxRange) {
        const segmentDistance = this.distPointToSegment(center, midHand, endPoint);
        if (segmentDistance <= dummy.radius + 1.2 || (aimTarget && aimTarget.id === dummy.id)) {
          clashTarget = dummy;
          break;
        }
      }
    }

    if (clashTarget) {
      if (!this.clashState.active) {
        this.clashState.active = true;
        this.clashState.rival = clashTarget;
        this.clashState.progress = 0.5;
        this.clashState.duration = 0;
        clashTarget.rivalBeamActive = true;
        this.clashSphere.visible = true;
        this.rivalBeamMesh.visible = true;
        this.rivalBeamGlow.visible = true;
        audioSystem.playBeamClash();
      }

      this.clashState.duration += dt;
      this.clashState.progress = Math.max(0, this.clashState.progress - dt * 0.09);

      const rivalHandPos = clashTarget.getCenter();
      this.clashState.clashPoint.lerpVectors(
        midHand,
        rivalHandPos,
        1 - this.clashState.progress
      );

      endPoint.copy(this.clashState.clashPoint);
      this.updateBeamMesh(
        this.rivalBeamMesh,
        this.rivalBeamGlow,
        rivalHandPos,
        this.clashState.clashPoint,
        0.18
      );

      this.clashSphere.position.copy(this.clashState.clashPoint);
      const pulse = 0.55 + Math.sin(performance.now() * 0.02) * 0.15;
      this.clashSphere.scale.set(pulse, pulse, pulse);
      this.onShake(0.04);

      if (this.clashState.duration >= this.clashState.maxDuration) {
        this.resolve(this.clashState.progress > 0.5);
      }
    } else if (this.clashState.active) {
      this.resolve(false);
    }

    return endPoint;
  }

  public resolve(playerWon: boolean): void {
    if (!this.clashState.active) return;
    const rival = this.clashState.rival;

    if (rival) {
      rival.rivalCooldown = 10.0;
    }

    if (playerWon && rival && !rival.isDead) {
      const finishPos = rival.getCenter();
      this.onExplosion?.(finishPos, 5.0, 0xffaa00);
      const fling = new THREE.Vector3(0, 4.0, -18);
      this.onDamageDealt(rival, 80, finishPos, fling);
      audioSystem.playExplosion();
      this.onShake(0.42);
    }

    this.clashState.active = false;
    this.clashSphere.visible = false;
    this.rivalBeamMesh.visible = false;
    this.rivalBeamGlow.visible = false;
    if (rival) {
      rival.rivalBeamActive = false;
    }
  }

  public stop(): void {
    this.resolve(false);
  }

  private updateBeamMesh(
    line: THREE.Line,
    glow: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
    thickness: number
  ): void {
    const geom = line.geometry as THREE.BufferGeometry;
    geom.setFromPoints([start, end]);

    const dist = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5);

    glow.position.copy(mid);
    glow.scale.set(thickness, dist, thickness);
    glow.quaternion.setFromUnitVectors(
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
    this.resolve(false);
    this.scene.remove(this.rivalBeamMesh);
    this.scene.remove(this.rivalBeamGlow);
    this.scene.remove(this.clashSphere);
  }
}
