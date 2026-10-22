import * as THREE from 'three';
import { TargetDummy } from './TargetDummy';
import { StickmanNodes } from './StickmanRig';
import { IronManRepulsor } from './abilities/ironman/IronManRepulsor';
import { IronManMicroMissiles } from './abilities/ironman/IronManMicroMissiles';
import { IronManUnibeam } from './abilities/ironman/IronManUnibeam';
import { IronManDualBeam } from './abilities/ironman/IronManDualBeam';
import { IronManSpinningLasers } from './abilities/ironman/IronManSpinningLasers';
import type { BeamClashState } from './abilities/ironman/IronManBeamClash';

export type { BezierMissile } from './abilities/ironman/IronManMicroMissiles';
export type { RepulsorBolt } from './abilities/ironman/IronManRepulsor';
export type { BeamClashState } from './abilities/ironman/IronManBeamClash';

export interface ExplosionFx {
  pos: THREE.Vector3;
  radius: number;
  maxRadius: number;
  age: number;
  maxAge: number;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  ringMesh?: THREE.Mesh;
}

interface SmokeParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  size: number;
}

/**
 * IronManAbilities is the coordinator for the real Iron Man combat modules.
 * Repulsor, micro-missiles and unibeam can be hot-swapped by ScriptRuntimeEngine;
 * dual beam/clash and spinning lasers are fixed modules whose behavior is fully
 * driven by the editable IronManConfig.
 */
export class IronManAbilities {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  public onRepulsorFired?: (hand: 'left' | 'right', aimPitch: number) => void;

  private repulsorModule: any = null;
  private microMissilesModule: any = null;
  private unibeamModule: any = null;
  private dualBeamModule: IronManDualBeam;
  private spinningLasersModule: IronManSpinningLasers;

  private explosions: ExplosionFx[] = [];
  public hitStopTimer: number = 0;
  public customPowerColor: string | null = null;

  private smokeParticles: SmokeParticle[] = [];
  private smokeInstancedMesh: THREE.InstancedMesh;
  private dummyMatrix = new THREE.Matrix4();

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

    const smokeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x99a2ad, transparent: true, opacity: 0.5 });
    this.smokeInstancedMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, 150);
    this.smokeInstancedMesh.count = 0;
    this.scene.add(this.smokeInstancedMesh);

    this.repulsorModule = this.createDefaultRepulsor();
    this.microMissilesModule = this.createDefaultMicroMissiles();
    this.unibeamModule = this.createDefaultUnibeam();
    this.dualBeamModule = new IronManDualBeam(
      scene,
      stickman,
      getAimDestination,
      onDamageDealt,
      onShake,
      () => this.customPowerColor,
      (pos, radius, color) => this.createExplosion(pos, radius, color)
    );
    this.spinningLasersModule = new IronManSpinningLasers(
      scene,
      stickman,
      onDamageDealt,
      onShake,
      () => this.customPowerColor,
      (pos, radius, color) => this.createExplosion(pos, radius, color)
    );
  }

  private createDefaultRepulsor(): IronManRepulsor {
    const module = new IronManRepulsor(
      this.scene,
      this.stickman,
      this.getAimDestination,
      this.onDamageDealt,
      this.onShake,
      () => this.customPowerColor,
      (pos, radius, color) => this.createExplosion(pos, radius, color)
    );
    module.onRepulsorFired = (hand, aimPitch) => {
      this.onRepulsorFired?.(hand, aimPitch);
    };
    return module;
  }

  private createDefaultMicroMissiles(): IronManMicroMissiles {
    return new IronManMicroMissiles(
      this.scene,
      this.stickman,
      this.onDamageDealt,
      this.onShake,
      () => this.customPowerColor,
      (pos, radius, color) => this.createExplosion(pos, radius, color),
      (pos, size, maxAge) => this.addSmoke(pos, size, maxAge)
    );
  }

  private createDefaultUnibeam(): IronManUnibeam {
    return new IronManUnibeam(
      this.scene,
      this.stickman,
      this.onDamageDealt,
      this.onShake,
      this.getAimDestination,
      () => this.customPowerColor,
      (pos, radius, color) => this.createExplosion(pos, radius, color),
      (seconds) => {
        this.hitStopTimer = Math.max(this.hitStopTimer, seconds);
      }
    );
  }

  public setRepulsorModule(module: any | null): void {
    if (this.repulsorModule === module) return;
    try {
      this.repulsorModule?.dispose?.();
    } catch {
      // Ignore module disposal failures.
    }
    this.repulsorModule = module ?? this.createDefaultRepulsor();
    if (this.repulsorModule) {
      this.repulsorModule.onRepulsorFired = (hand: 'left' | 'right', aimPitch: number) => {
        this.onRepulsorFired?.(hand, aimPitch);
      };
    }
  }

  public setMicroMissilesModule(module: any | null): void {
    if (this.microMissilesModule === module) return;
    try {
      this.microMissilesModule?.dispose?.();
    } catch {
      // Ignore module disposal failures.
    }
    this.microMissilesModule = module ?? this.createDefaultMicroMissiles();
  }

  public setUnibeamModule(module: any | null): void {
    if (this.unibeamModule === module) return;
    try {
      this.unibeamModule?.dispose?.();
    } catch {
      // Ignore module disposal failures.
    }
    this.unibeamModule = module ?? this.createDefaultUnibeam();
  }

  public getInstalledModules(): { repulsor: unknown; microMissiles: unknown; unibeam: unknown } {
    return {
      repulsor: this.repulsorModule,
      microMissiles: this.microMissilesModule,
      unibeam: this.unibeamModule,
    };
  }

  public get isDualBeamActive(): boolean {
    return this.dualBeamModule.isActive;
  }

  public get isSpinningLasersActive(): boolean {
    return this.spinningLasersModule.isActive;
  }

  public set isSpinningLasersActive(active: boolean) {
    if (!active) this.spinningLasersModule.stop();
  }

  public get isChargingHeavyBlast(): boolean {
    return !!this.unibeamModule?.isCharging;
  }

  public get clashState(): BeamClashState {
    return this.dualBeamModule.clashState;
  }

  public fireRepulsorShot(aimPitch: number = 0): void {
    this.repulsorModule?.fire?.(aimPitch);
  }

  public fireMissileVolley(): void {
    const aim = this.getAimDestination();
    this.microMissilesModule?.fire?.(aim.target, aim.pos);
  }

  public toggleDualBeam(): boolean {
    return this.dualBeamModule.toggle();
  }

  public stopDualBeam(): void {
    this.dualBeamModule.stop();
  }

  public onClashTap(): void {
    this.dualBeamModule.onClashTap();
  }

  public fireHeavyMissile(): void {
    this.unibeamModule?.fire?.(this.getAimDestination());
  }

  public triggerSpinningLasers(currentRy: number = 0): void {
    this.spinningLasersModule.trigger(currentRy);
  }

  public createSmokeParticle(pos: THREE.Vector3, size: number, maxAge: number): void {
    this.smokeParticles.push({
      pos: pos.clone(),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 0.4
      ),
      age: 0,
      maxAge,
      size,
    });
  }

  private addSmoke(pos: THREE.Vector3, size: number, maxAge: number): void {
    this.createSmokeParticle(pos, size, maxAge);
  }

  public createExplosion(pos: THREE.Vector3, radius: number, color: number = 0xff6600): void {
    if (this.customPowerColor) {
      const parsed = parseInt(this.customPowerColor.replace('#', ''), 16);
      if (Number.isFinite(parsed)) color = parsed;
    }

    const geo = new THREE.SphereGeometry(radius * 0.4, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const light = new THREE.PointLight(color, 4, radius * 2.5);
    light.position.copy(pos);
    this.scene.add(light);

    const ringGeo = new THREE.RingGeometry(radius * 0.1, radius * 0.35, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.copy(pos);
    ringMesh.position.y += 0.08;
    this.scene.add(ringMesh);

    this.explosions.push({
      pos: pos.clone(),
      radius: radius * 0.4,
      maxRadius: radius,
      age: 0,
      maxAge: 0.5,
      mesh,
      light,
      ringMesh,
    });

    for (let i = 0; i < 25; i++) {
      this.addSmoke(
        pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * radius * 0.5,
          (Math.random() - 0.5) * radius * 0.5,
          (Math.random() - 0.5) * radius * 0.5
        )),
        0.2 + Math.random() * 0.25,
        0.6 + Math.random() * 0.4
      );
      const particle = this.smokeParticles[this.smokeParticles.length - 1];
      particle.vel.set(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 8
      );
    }
  }

  public update(
    dt: number,
    dummies: TargetDummy[],
    playerRotationY: number,
    setPlayerRotationY: (ry: number) => void
  ): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    try {
      this.repulsorModule?.update?.(dt, dummies);
    } catch (err) {
      console.warn('[IronManAbilities] repulsor module update failed:', err);
    }
    try {
      this.microMissilesModule?.update?.(dt, dummies);
    } catch (err) {
      console.warn('[IronManAbilities] micro-missiles module update failed:', err);
    }
    try {
      this.unibeamModule?.update?.(dt, dummies, playerRotationY);
    } catch (err) {
      console.warn('[IronManAbilities] unibeam module update failed:', err);
    }

    this.dualBeamModule.update(dt, dummies);
    this.spinningLasersModule.update(dt, dummies, playerRotationY, setPlayerRotationY);

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.age += dt;
      const progress = exp.age / exp.maxAge;
      if (progress >= 1.0) {
        this.scene.remove(exp.mesh);
        this.scene.remove(exp.light);
        if (exp.ringMesh) this.scene.remove(exp.ringMesh);
        this.explosions.splice(i, 1);
      } else {
        const curRadius = exp.radius + (exp.maxRadius - exp.radius) * Math.sin(progress * Math.PI * 0.5);
        exp.mesh.scale.set(curRadius, curRadius, curRadius);
        (exp.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.8;
        exp.light.intensity = (1 - progress) * 5;

        if (exp.ringMesh) {
          const rScale = 1.0 + progress * 2.6;
          exp.ringMesh.scale.set(rScale, rScale, rScale);
          (exp.ringMesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
        }
      }
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.smokeParticles.splice(i, 1);
      } else {
        p.pos.addScaledVector(p.vel, dt);
      }
    }

    const count = Math.min(this.smokeParticles.length, 150);
    this.smokeInstancedMesh.count = count;
    for (let i = 0; i < count; i++) {
      const p = this.smokeParticles[i];
      const scale = (1 - p.age / p.maxAge) * p.size;
      this.dummyMatrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      this.dummyMatrix.scale(new THREE.Vector3(scale, scale, scale));
      this.smokeInstancedMesh.setMatrixAt(i, this.dummyMatrix);
    }
    if (count > 0) {
      this.smokeInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    try {
      this.repulsorModule?.dispose?.();
    } catch {
      // Ignore.
    }
    try {
      this.microMissilesModule?.dispose?.();
    } catch {
      // Ignore.
    }
    try {
      this.unibeamModule?.dispose?.();
    } catch {
      // Ignore.
    }
    this.dualBeamModule.dispose();
    this.spinningLasersModule.dispose();

    for (const exp of this.explosions) {
      this.scene.remove(exp.mesh);
      this.scene.remove(exp.light);
      if (exp.ringMesh) this.scene.remove(exp.ringMesh);
    }
    this.explosions = [];
    this.smokeParticles = [];
    this.scene.remove(this.smokeInstancedMesh);
    this.hitStopTimer = 0;
  }
}
