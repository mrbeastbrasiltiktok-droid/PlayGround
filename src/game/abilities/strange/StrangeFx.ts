/**
 * StrangeFx.ts
 * Shared visual-effects toolkit for Doctor Strange ability modules.
 * Provides a pooled particle system, procedural magic-circle textures,
 * mystical butterflies and transient flash effects. All resources are
 * tracked and fully released by dispose().
 */

import * as THREE from 'three';

interface ParticleState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  age: number;
  maxAge: number;
  gravity: number;
}

interface ButterflyState {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  center: THREE.Vector3;
  angle: number;
  angularSpeed: number;
  radiusSpeed: number;
  baseRadius: number;
  heightSpeed: number;
  phase: number;
  age: number;
  maxAge: number;
}

interface FlashState {
  mesh: THREE.Mesh;
  light: THREE.PointLight | null;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
}

export class StrangeFx {  private scene: THREE.Scene;
  private particles: ParticleState[] = [];
  private particlesMesh: THREE.InstancedMesh;
  private maxParticles: number;
  private dummyMatrix = new THREE.Matrix4();
  private dummyScale = new THREE.Vector3();

  private butterflies: ButterflyState[] = [];
  private flashes: FlashState[] = [];

  private runeTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  private wingGeometry: THREE.PlaneGeometry;
  private disposed = false;

  constructor(scene: THREE.Scene, maxParticles: number = 180) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    const geo = new THREE.SphereGeometry(0.07, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    this.particlesMesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.particlesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particlesMesh.count = 0;
    this.scene.add(this.particlesMesh);
    this.wingGeometry = new THREE.PlaneGeometry(0.16, 0.12);
  }

  // ==========================================
  // Particles
  // ==========================================
  public spawnBurst(
    pos: THREE.Vector3,
    count: number,
    color: number,
    speedMin: number = 2.5,
    speedMax: number = 7.5,
    size: number = 0.14,
    gravity: number = 7.0
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        break;
      }
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.25) * Math.PI;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      this.particles.push({
        pos: pos.clone(),
        vel: new THREE.Vector3(
          Math.cos(elevation) * Math.cos(angle) * speed,
          Math.abs(Math.sin(elevation) * speed) * 0.8 + 0.8,
          Math.cos(elevation) * Math.sin(angle) * speed
        ),
        color: new THREE.Color(color),
        size: size * (0.7 + Math.random() * 0.7),
        age: 0,
        maxAge: 0.4 + Math.random() * 0.5,
        gravity,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(0.965);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.03) {
        p.pos.y = 0.03;
        p.vel.y = -p.vel.y * 0.35;
      }
    }

    const capacity = this.maxParticles;
    const count = Math.min(this.particles.length, capacity);
    this.particlesMesh.count = count;
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      const k = 1 - p.age / p.maxAge;
      this.dummyScale.setScalar(k * p.size);
      this.dummyMatrix.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      this.dummyMatrix.scale(this.dummyScale);
      this.particlesMesh.setMatrixAt(i, this.dummyMatrix);
      this.particlesMesh.setColorAt(i, p.color);
    }
    if (count > 0) {
      this.particlesMesh.instanceMatrix.needsUpdate = true;
      if (this.particlesMesh.instanceColor) {
        this.particlesMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  // ==========================================
  // Procedural magic-circle textures
  // ==========================================
  public getRuneTexture(colorHex: string, glyphCount: number = 12): THREE.CanvasTexture {
    const key = `${colorHex}:${glyphCount}`;
    const cached = this.runeTextureCache.get(key);
    if (cached) return cached;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    ctx.strokeStyle = colorHex;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 84, 0, Math.PI * 2);
    ctx.stroke();

    // Procedural angular glyphs around the ring (no font dependency)
    ctx.lineWidth = 2.4;
    for (let i = 0; i < glyphCount; i++) {
      const a = (i / glyphCount) * Math.PI * 2;
      const gx = cx + Math.cos(a) * 100;
      const gy = cy + Math.sin(a) * 100;
      const segs = 2 + Math.floor(Math.random() * 2);
      ctx.beginPath();
      for (let s = 0; s < segs; s++) {
        const x1 = gx + (Math.random() - 0.5) * 14;
        const y1 = gy + (Math.random() - 0.5) * 14;
        const x2 = gx + (Math.random() - 0.5) * 14;
        const y2 = gy + (Math.random() - 0.5) * 14;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    // Inner triangle sigil
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 52;
      const y = cy + Math.sin(a) * 52;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.runeTextureCache.set(key, texture);
    return texture;
  }

  // ==========================================
  // Mystical butterflies (shield dissolve effect)
  // ==========================================
  public spawnButterflies(center: THREE.Vector3, count: number, color: number, duration: number): void {
    if (this.disposed || count <= 0) return;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wingGeo = this.wingGeometry;

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const wingL = new THREE.Mesh(wingGeo, material);
      wingL.position.x = -0.08;
      const wingR = new THREE.Mesh(wingGeo, material);
      wingR.position.x = 0.08;
      group.add(wingL, wingR);

      group.position.copy(center);
      this.scene.add(group);

      this.butterflies.push({
        group,
        wingL,
        wingR,
        material,
        center: center.clone(),
        angle: Math.random() * Math.PI * 2,
        angularSpeed: 0.9 + Math.random() * 1.1,
        radiusSpeed: 0.55 + Math.random() * 0.5,
        baseRadius: 0.25,
        heightSpeed: 1.4 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        age: 0,
        maxAge: duration * (0.8 + Math.random() * 0.35),
      });
    }
  }

  private updateButterflies(dt: number, now: number): void {
    for (let i = this.butterflies.length - 1; i >= 0; i--) {
      const b = this.butterflies[i];
      b.age += dt;
      if (b.age >= b.maxAge) {
        this.scene.remove(b.group);
        this.butterflies.splice(i, 1);
        continue;
      }

      const life = b.age / b.maxAge;
      const radius = b.baseRadius + b.radiusSpeed * b.age * 0.9;
      b.angle += b.angularSpeed * dt;
      const x = b.center.x + Math.cos(b.angle) * radius;
      const z = b.center.z + Math.sin(b.angle) * radius;
      const y = b.center.y + Math.sin(b.age * b.heightSpeed + b.phase) * 0.55 + b.age * 0.35;
      b.group.position.set(x, y, z);

      // Face travel direction with organic banking
      const vx = -Math.sin(b.angle) * radius * b.angularSpeed;
      const vz = Math.cos(b.angle) * radius * b.angularSpeed;
      b.group.rotation.y = Math.atan2(vx, vz);
      b.group.rotation.z = Math.sin(b.age * 5 + b.phase) * 0.35;

      // Wing flap
      const flap = Math.sin(now * 0.02 + b.phase) * 0.9;
      b.wingL.rotation.y = 0.4 + flap;
      b.wingR.rotation.y = -0.4 - flap;

      if (life > 0.65) {
        b.material.opacity = 0.95 * (1 - (life - 0.65) / 0.35);
      }
    }
  }

  // ==========================================
  // Transient flash meshes (impact blooms, bursts)
  // ==========================================
  public spawnFlash(
    pos: THREE.Vector3,
    color: number,
    startScale: number,
    endScale: number,
    duration: number,
    withLight: boolean = true,
    opacity: number = 0.9
  ): void {
    if (this.disposed) return;
    const geo = new THREE.SphereGeometry(1, 14, 14);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(startScale);
    this.scene.add(mesh);

    let light: THREE.PointLight | null = null;
    if (withLight) {
      light = new THREE.PointLight(color, 3.2, 8);
      light.position.copy(pos);
      this.scene.add(light);
    }

    this.flashes.push({ mesh, light, age: 0, maxAge: duration, startScale, endScale, startOpacity: opacity });
  }

  public spawnShockRing(pos: THREE.Vector3, color: number, startRadius: number, endRadius: number, duration: number): void {
    if (this.disposed) return;
    const geo = new THREE.RingGeometry(0.72, 1, 40);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, Math.max(0.08, pos.y), pos.z);
    mesh.scale.setScalar(startRadius);
    this.scene.add(mesh);
    this.flashes.push({ mesh, light: null, age: 0, maxAge: duration, startScale: startRadius, endScale: endRadius, startOpacity: 0.85 });
  }

  private updateFlashes(dt: number): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      const k = f.age / f.maxAge;
      if (k >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        if (f.light) {
          this.scene.remove(f.light);
        }
        this.flashes.splice(i, 1);
        continue;
      }
      const scale = f.startScale + (f.endScale - f.startScale) * Math.sin(k * Math.PI * 0.5);
      f.mesh.scale.setScalar(Math.max(0.001, scale));
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = f.startOpacity * (1 - k);
      if (f.light) {
        f.light.intensity = 3.2 * (1 - k);
      }
    }
  }

  // ==========================================
  // Frame update & teardown
  // ==========================================
  public update(dt: number): void {
    if (this.disposed) return;
    this.updateParticles(dt);
    this.updateButterflies(dt, performance.now());
    this.updateFlashes(dt);
  }

  public get activeEffectCount(): number {
    return this.particles.length + this.butterflies.length + this.flashes.length;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.particles = [];
    this.scene.remove(this.particlesMesh);
    this.particlesMesh.geometry.dispose();
    (this.particlesMesh.material as THREE.Material).dispose();

    for (const b of this.butterflies) {
      this.scene.remove(b.group);
    }
    this.butterflies = [];

    for (const f of this.flashes) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
      if (f.light) {
        this.scene.remove(f.light);
      }
    }
    this.flashes = [];

    for (const tex of this.runeTextureCache.values()) {
      tex.dispose();
    }
    this.runeTextureCache.clear();
    this.wingGeometry.dispose();
  }
}
