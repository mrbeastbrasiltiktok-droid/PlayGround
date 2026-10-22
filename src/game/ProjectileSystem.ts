import * as THREE from 'three';
import { TargetDummy } from './TargetDummy';
import { audioSystem } from './AudioSystem';
import { VFXSystem } from './systems/VFXSystem';

export interface DamageNumber {
  id: number;
  value: number;
  worldPos: THREE.Vector3;
  age: number;
  maxAge: number;
}

export class Projectile {
  public mesh: THREE.Group;
  public pos: THREE.Vector3;
  public vel: THREE.Vector3;
  public startPos: THREE.Vector3;
  public maxRange: number = 38;
  public isDead: boolean = false;
  public target: TargetDummy | null = null;
  public homingStrength: number = 0; // 0 = straight, >0 = guided

  private light: THREE.PointLight;
  private coreMesh: THREE.Mesh;

  constructor(
    startPos: THREE.Vector3,
    initialDir: THREE.Vector3,
    speed: number,
    target: TargetDummy | null,
    homing: boolean
  ) {
    this.pos = startPos.clone();
    this.startPos = startPos.clone();
    this.vel = initialDir.clone().normalize().multiplyScalar(speed);
    this.target = target;
    this.homingStrength = homing ? 8.5 : 0;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.pos);

    // Glowing energy core (cyan / electric blue energy)
    const coreGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x48cae4 });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(this.coreMesh);

    // Outer glow halo
    const haloGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x0077b6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.mesh.add(haloMesh);

    // Dynamic point light for realistic scene illumination
    this.light = new THREE.PointLight(0x48cae4, 2.5, 6);
    this.mesh.add(this.light);
  }

  public update(dt: number): void {
    if (this.isDead) return;

    // Homing steering if target is active and alive
    if (this.target && !this.target.isDead && this.homingStrength > 0) {
      const targetPos = this.target.getCenter();
      const desiredDir = targetPos.clone().sub(this.pos).normalize();
      const currentSpeed = this.vel.length();
      const currentDir = this.vel.clone().normalize();
      // Smoothly steer velocity
      currentDir.lerp(desiredDir, Math.min(1.0, dt * this.homingStrength)).normalize();
      this.vel.copy(currentDir.multiplyScalar(currentSpeed));
    }

    // Move
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);

    // Orient mesh along velocity
    if (this.vel.lengthSq() > 0.001) {
      const targetLook = this.pos.clone().add(this.vel);
      this.mesh.lookAt(targetLook);
    }

    // Range check
    if (this.pos.distanceTo(this.startPos) > this.maxRange) {
      this.isDead = true;
    }

    // Ground collision
    if (this.pos.y <= 0.05) {
      this.isDead = true;
    }
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }
}

export class ProjectileSystem {
  private scene: THREE.Scene;
  private projectiles: Projectile[] = [];
  private vfx: VFXSystem;

  // Floating damage numbers
  public damageNumbers: DamageNumber[] = [];
  private nextDamageId: number = 1;

  // Impact trigger callback (for camera shake)
  private onImpactCallback: (isTargetHit: boolean) => void;
  private onDamage?: (
    dummy: TargetDummy,
    amount: number,
    hitPos: THREE.Vector3
  ) => void;

  constructor(
    scene: THREE.Scene,
    onImpact: (isTargetHit: boolean) => void,
    onDamage?: (dummy: TargetDummy, amount: number, hitPos: THREE.Vector3) => void
  ) {
    this.scene = scene;
    this.onImpactCallback = onImpact;
    this.onDamage = onDamage;
    this.vfx = new VFXSystem(scene);
  }

  public launch(
    startPos: THREE.Vector3,
    direction: THREE.Vector3,
    target: TargetDummy | null,
    homing: boolean
  ): void {
    const proj = new Projectile(startPos, direction, 26, target, homing);
    this.projectiles.push(proj);
    this.scene.add(proj.mesh);
  }

  public emitImpactParticles(
    pos: THREE.Vector3,
    count: number,
    baseColor: number = 0x48cae4
  ): void {
    this.vfx.emitImpactParticles(pos, count, baseColor);
  }

  public emitDestructionParticles(pos: THREE.Vector3): void {
    this.vfx.emitDestructionParticles(pos);
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    // 1. Update active projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);

      if (Math.random() < 0.4) {
        this.vfx.emitTrailParticle(p.pos, p.vel);
      }

      // Check collision with dummies
      let hit = false;
      for (const dummy of dummies) {
        if (dummy.isDead) continue;
        const dummyCenter = dummy.getCenter();
        const dist = p.pos.distanceTo(dummyCenter);

        if (dist <= dummy.radius + 0.3) {
          hit = true;
          const hitPos = p.pos.clone();
          if (this.onDamage) {
            this.onDamage(dummy, 25, hitPos);
          } else {
            const { actualDamage } = dummy.takeDamage(25, hitPos);
            this.damageNumbers.push({
              id: this.nextDamageId++,
              value: actualDamage,
              worldPos: hitPos.clone().add(new THREE.Vector3(0, 0.4, 0)),
              age: 0,
              maxAge: 0.95,
            });
          }

          this.emitImpactParticles(hitPos, 22, 0x48cae4);
          audioSystem.playImpact();
          this.onImpactCallback(true);
          break;
        }
      }

      // Check ground collision
      if (!hit && p.pos.y <= 0.05) {
        hit = true;
        this.emitImpactParticles(p.pos, 12, 0x7a8694);
        audioSystem.playImpact();
        this.onImpactCallback(false);
      }

      if (hit || p.isDead) {
        p.dispose(this.scene);
        this.projectiles.splice(i, 1);
      }
    }

    this.vfx.update(dt);

    // 2. Update Damage Numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.age += dt;
      // Floats smoothly upwards
      dn.worldPos.y += dt * 1.35;
      if (dn.age >= dn.maxAge) {
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const p of this.projectiles) {
      p.dispose(this.scene);
    }
    this.projectiles = [];
    this.vfx.dispose();
  }
}
