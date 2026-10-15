// Layered VFX: pooled particles, tracers, shockwaves, beams, damage numbers.
import * as THREE from 'three';
import { radialTexture, Pool } from '../core/utils.js';

export class FX {
  constructor(scene, quality = 1.0) {
    this.scene = scene;
    this.q = quality;
    this.tex = radialTexture();
    // particle pool using Points with per-point life
    this.N = Math.floor(900 * quality) + 200;
    this.pos = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.maxLife = new Float32Array(this.N);
    this.size = new Float32Array(this.N);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      map: this.tex, size: 1.1 + 0.3 * quality, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < this.N; i++) this.pos[i * 3 + 1] = -100;

    // shockwave rings pool
    this.rings = new Pool(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.userData = { t: 0, dur: 0.5, max: 6 };
      return m;
    }, 14);
    this.rings.addTo(scene);

    // beams (transient, disposed on expiry)
    this.beams = [];

    // damage numbers pool (sprites w/ canvas)
    this.nums = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const t = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
      sp.scale.set(1.6, 0.8, 1); sp.visible = false;
      sp.userData = { t: 0, canvas: c, tex: t };
      scene.add(sp); this.nums.push(sp);
    }
    this.numIdx = 0;
    // active beams
    this.beams = [];
    // muzzle flash sprites pool
    this.muzzles = [];
    this.muzzleIdx = 0;
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.tex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.visible = false;
      s.userData = { t: 0 };
      scene.add(s);
      this.muzzles.push(s);
    }
    this.tmpC = new THREE.Color();
  }

  spawn(x, y, z, vx, vy, vz, life, color, size = 1) {
    const i = this.head; this.head = (this.head + 1) % this.N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.tmpC.set(color);
    this.col[i * 3] = this.tmpC.r; this.col[i * 3 + 1] = this.tmpC.g; this.col[i * 3 + 2] = this.tmpC.b;
  }

  // enhanced burst with color gradient and multiple rings
  burst(p, { n = 20, color = 0xffaa33, speed = 8, life = 0.6, up = 3, size = 1, }) {
    n = Math.max(4, Math.floor(n * this.q));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.9);
      this.spawn(p.x, p.y, p.z,
        Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + up, Math.sin(a) * Math.cos(e) * s,
        life * (0.6 + Math.random() * 0.7), Math.random() < 0.25 ? 0xffffff : color, size);
    }
  }

  // enhanced trail with glow
  trail(p, color, size = 0.8) {
    this.spawn(p.x, p.y, p.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5),
      0.35 + Math.random() * 0.2, color, size);
  }

  // colorful shockwave with expanding rings
  shockwave(p, color = 0x66d9ff, max = 7, dur = 0.5) {
    const r = this.rings.next();
    r.position.copy(p); r.position.y = Math.max(0.15, p.y * 0.3 + 0.15);
    r.material.color.set(color);
    r.userData = { t: 0, dur, max };
    r.visible = true;
    // add secondary quick ring
    const r2 = this.rings.next();
    r2.position.copy(p); r2.position.y = Math.max(0.15, p.y * 0.3 + 0.15);
    r2.material.color.set(new THREE.Color().setHSL(color.r / 0xff, 0.8, 0.5));
    r2.userData = { t: 0, dur: dur * 0.6, max: 3 };
    r2.visible = true;
  }

  damageNumber(p, amount, crit = false) {
    const sp = this.nums[this.numIdx]; this.numIdx = (this.numIdx + 1) % this.nums.length;
    const { canvas, tex } = sp.userData;
    const g = canvas.getContext('2d'); g.clearRect(0, 0, 128, 64);
    g.font = `bold ${crit ? 40 : 30}px Arial`; g.textAlign = 'center';
    g.fillStyle = crit ? '#ffd94d' : '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 5;
    const s = String(Math.round(amount));
    g.strokeText(s, 64, 42); g.fillText(s, 64, 42);
    tex.needsUpdate = true;
    sp.position.copy(p); sp.position.y += 0.6;
    sp.visible = true; sp.userData.t = 0.8;
    sp.scale.set(crit ? 2.2 : 1.5, crit ? 1.1 : 0.75, 1);
  }

  // muzzle flash: quick additive flash sprite at the firing point
  muzzle(p, color = 0xffffff, size = 1) {
    const m = this.muzzles[this.muzzleIdx]; this.muzzleIdx = (this.muzzleIdx + 1) % this.muzzles.length;
    m.position.copy(p);
    m.material.color.set(color);
    m.scale.setScalar(0.9 * size + 0.3);
    m.material.opacity = 0.9;
    m.visible = true;
    m.userData.t = 0.07;
    this.burst(p, { n: 3, color, speed: 3, life: 0.12 });
  }

  // falling meteor visual (used by phoenix ult)
  meteor(p, color = 0xff8a3c) {
    this.burst(p, { n: 14, color, speed: 4, life: 0.4 });
    for (let i = 0; i < 3; i++) {
      this.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 2, 8, (Math.random() - 0.5) * 2, 0.5, color, 1.6);
    }
  }

  // glowing beam with sparkles
  beam(from, to, color = 0x66d9ff, width = 0.5, dur = 0.12) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(width * 0.4, width, len, 8, 1, true);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(m);
    this.beams.push({ m, t: dur });
    // sparks along beam
    for (let i = 0; i < 8 * this.q; i++) {
      const p = from.clone().addScaledVector(dir, Math.random());
      this.burst(p, { n: 2, color, speed: 4, life: 0.3 });
    }
  }

  update(dt) {
    // particles
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; continue; }
      this.vel[i * 3 + 1] -= 6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.4; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // rings
    for (const r of this.rings.items) {
      if (!r.visible) continue;
      r.userData.t += dt;
      const k = r.userData.t / r.userData.dur;
      if (k >= 1) { r.visible = false; continue; }
      const s = 0.5 + k * r.userData.max;
      r.scale.set(s, s, s);
      r.material.opacity = 0.9 * (1 - k);
    }
    // numbers
    for (const sp of this.nums) {
      if (!sp.visible) continue;
      sp.userData.t -= dt;
      sp.position.y += dt * 1.6;
      sp.material.opacity = Math.min(1, sp.userData.t * 2);
      if (sp.userData.t <= 0) sp.visible = false;
    }
    // muzzle flashes
    for (const m of this.muzzles) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      m.material.opacity = Math.max(0, m.userData.t * 12);
      if (m.userData.t <= 0) m.visible = false;
    }
    // beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t -= dt;
      b.m.material.opacity = Math.max(0, b.t * 7);
      b.m.scale.x = b.m.scale.z = 1 + (0.12 - b.t) * 4;
      if (b.t <= 0) { this.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); this.beams.splice(i, 1); }
    }
  }
}