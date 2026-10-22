import * as THREE from 'three';

export interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  age: number;
  maxAge: number;
}

export class VFXSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleInstancedMesh: THREE.InstancedMesh;
  private readonly maxParticles = 300;
  private matrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    this.particleInstancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.maxParticles
    );
    this.particleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInstancedMesh.count = 0;
    this.scene.add(this.particleInstancedMesh);
  }

  public emitImpactParticles(
    pos: THREE.Vector3,
    count: number,
    baseColor = 0x48cae4
  ): void {
    const burstCount = Math.min(count, 35);
    for (let i = 0; i < burstCount; i += 1) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI;
      const speed = 2.5 + Math.random() * 6.5;
      this.particles.push({
        pos: pos.clone(),
        vel: new THREE.Vector3(
          Math.cos(elevation) * Math.cos(angle) * speed,
          Math.abs(Math.sin(elevation) * speed) + 1.5,
          Math.cos(elevation) * Math.sin(angle) * speed
        ),
        color: new THREE.Color(baseColor),
        size: 0.08 + Math.random() * 0.08,
        age: 0,
        maxAge: 0.45 + Math.random() * 0.35,
      });
    }
  }

  public emitDestructionParticles(pos: THREE.Vector3): void {
    this.emitImpactParticles(pos, 40, 0xff9f1c);
    this.emitImpactParticles(pos, 25, 0xe63946);
  }

  public emitTrailParticle(pos: THREE.Vector3, velocity: THREE.Vector3): void {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push({
      pos: pos.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        )
      ),
      vel: velocity
        .clone()
        .multiplyScalar(-0.15)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 1,
            Math.random() * 1.5,
            (Math.random() - 0.5) * 1
          )
        ),
      color: new THREE.Color(0x90e0ef),
      size: 0.06,
      age: 0,
      maxAge: 0.22,
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const part = this.particles[i];
      part.age += dt;
      if (part.age >= part.maxAge) {
        this.particles.splice(i, 1);
        continue;
      }
      part.vel.y -= 9.8 * dt;
      part.vel.multiplyScalar(0.96);
      part.pos.addScaledVector(part.vel, dt);
      if (part.pos.y < 0.02) {
        part.pos.y = 0.02;
        part.vel.y = -part.vel.y * 0.4;
      }
    }

    const count = Math.min(this.particles.length, this.maxParticles);
    this.particleInstancedMesh.count = count;
    for (let i = 0; i < count; i += 1) {
      const part = this.particles[i];
      const scale = (1 - part.age / part.maxAge) * part.size;
      this.matrix.makeTranslation(part.pos.x, part.pos.y, part.pos.z);
      this.matrix.scale(new THREE.Vector3(scale, scale, scale));
      this.particleInstancedMesh.setMatrixAt(i, this.matrix);
      this.particleInstancedMesh.setColorAt(i, part.color);
    }
    if (count > 0) {
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
      if (this.particleInstancedMesh.instanceColor) {
        this.particleInstancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public dispose(): void {
    this.particles = [];
    this.scene.remove(this.particleInstancedMesh);
    this.particleInstancedMesh.geometry.dispose();
    if (Array.isArray(this.particleInstancedMesh.material)) {
      this.particleInstancedMesh.material.forEach((material) => material.dispose());
    } else {
      this.particleInstancedMesh.material.dispose();
    }
  }
}

export default VFXSystem;
