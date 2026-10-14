import * as THREE from 'three';

// VFX AAA: sprites aditivos em camadas + shards físicos + pilares + funis +
// marcas de queimadura + streaks. Tudo com pools limitados para segurar 60fps.
function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function makeStreakTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 16);
  return new THREE.CanvasTexture(c);
}
let DOT = null, STREAK = null;
const MAXP = 900, MAXS = 130;

export class VFX {
  constructor(scene) {
    this.scene = scene;
    if (!DOT) DOT = makeDotTexture();
    if (!STREAK) STREAK = makeStreakTexture();
    this.particles = [];
    this.rings = [];
    this.projectiles = [];
    this.beams = [];
    this.zones = [];
    this.shardPool = [];
    this.pillars = [];
    this.funnels = [];
    this.scorches = [];
  }
  get capped() { return this.particles.length > MAXP; }
  spawn(pos, { color = 0xffaa33, count = 24, speed = 6, life = 0.8, size = 0.5, up = 2, grav = -6, spread = 1 } = {}) {
    if (this.capped) return;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: DOT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * spread, Math.random() * .6, (Math.random() - .5) * spread));
      const sc = size * (0.5 + Math.random());
      s.scale.set(sc, sc, 1);
      const vel = new THREE.Vector3((Math.random() - .5) * speed, Math.random() * up + 1, (Math.random() - .5) * speed);
      const maxLife = life * (0.6 + Math.random() * 0.8);
      this.scene.add(s);
      this.particles.push({ s, vel, life: maxLife, maxLife, grav, grow: 0.6 });
    }
  }
  // fonte contínua de brasas subindo (fogo orgânico)
  embers(pos, color = 0xff6a1f, n = 3) {
    if (this.capped) return;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: DOT, color: Math.random() < 0.3 ? 0xffd76a : color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
      const s = new THREE.Sprite(mat);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * 1.4, Math.random(), (Math.random() - .5) * 1.4));
      const sc = 0.1 + Math.random() * 0.22; s.scale.set(sc, sc, 1);
      this.scene.add(s);
      this.particles.push({ s, vel: new THREE.Vector3((Math.random() - .5) * 0.8, 1.5 + Math.random() * 2.4, (Math.random() - .5) * 0.8), life: 1.2, maxLife: 1.2, grav: 2.2, grow: -0.04, sway: Math.random() * 10 });
    }
  }
  // anel de choque duplo (núcleo branco + halo colorido)
  ring(pos, { color = 0xffffff, maxR = 6, dur = 0.6, y = 0.12 } = {}) {
    for (const [rr, op, col] of [[1, 0.95, 0xffffff], [1.18, 0.7, color]]) {
      const geo = new THREE.RingGeometry(0.86, 1.0, 56);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = Math.max(0.1, y);
      this.scene.add(m);
      this.rings.push({ m, t: -0.06 * rr, dur, maxR: maxR * rr });
    }
  }
  flash(pos, color = 0xffffff, size = 3, dur = 0.25) {
    const mat = new THREE.SpriteMaterial({ map: DOT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat); s.position.copy(pos); s.scale.set(size, size, 1);
    this.scene.add(s);
    this.particles.push({ s, vel: new THREE.Vector3(), life: dur, maxLife: dur, grav: 0, grow: 7 });
  }
  // fragmentos físicos que voam e quicam no chão
  shards(pos, { color = 0xffcc66, count = 10, speed = 8, size = 0.16, up = 7 } = {}) {
    for (let i = 0; i < count && this.shardPool.length < MAXS; i++) {
      const geo = Math.random() < 0.5 ? new THREE.TetrahedronGeometry(size) : new THREE.OctahedronGeometry(size * 0.8);
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.35 ? 0xffffff : color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.shardPool.push({
        m, life: 0.9 + Math.random() * 0.6, maxLife: 1.4,
        vel: new THREE.Vector3((Math.random() - .5) * speed, Math.random() * up + 2, (Math.random() - .5) * speed),
        spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9)
      });
    }
  }
  // pilar de energia do chão ao céu (ults, renascimento, telecinese)
  pillar(pos, { color = 0xffffff, height = 12, radius = 0.7, dur = 0.9 } = {}) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.7, height, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.5, height, 14, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    core.position.y = halo.position.y = height / 2;
    grp.add(core); grp.add(halo);
    grp.position.set(pos.x, 0, pos.z);
    this.scene.add(grp);
    this.pillars.push({ grp, core, halo, t: 0, dur, radius });
    this.ring(pos, { color, maxR: radius * 5, dur: 0.6 });
  }
  // funil de tornado (dreno da Phoenix)
  funnel(pos, color = 0xff6a1f, dur = 2.2) {
    const grp = new THREE.Group();
    for (const [rTop, rBot, h, op] of [[1.5, 0.5, 3.2, 0.5], [1.1, 0.35, 2.4, 0.65], [0.7, 0.2, 1.6, 0.8]]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = h / 2 + 0.1;
      grp.add(cone);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: 0xffd76a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 1.2; glow.scale.set(3.5, 3.5, 1); grp.add(glow);
    grp.position.set(pos.x, 0, pos.z);
    this.scene.add(grp);
    const f = { grp, t: 0, dur };
    this.funnels.push(f);
    return f;
  }
  // marca de queimadura no chão que desvanece
  scorch(pos, { color = 0xff6a1f, radius = 2.2, dur = 6 } = {}) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 28),
      new THREE.MeshBasicMaterial({ color: 0x0a0505, transparent: true, opacity: 0.75, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.03, pos.z);
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.85, radius, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(pos.x, 0.04, pos.z);
    this.scene.add(m); this.scene.add(rim);
    this.scorches.push({ m, rim, t: 0, dur });
  }
  // streak de velocidade (esquivas, avanços)
  streak(pos, dir, { color = 0xffffff, len = 3, dur = 0.3 } = {}) {
    const mat = new THREE.SpriteMaterial({ map: STREAK, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.set(len, len * 0.22, 1);
    s.material.rotation = Math.atan2(dir.y, dir.x);
    this.scene.add(s);
    this.particles.push({ s, vel: new THREE.Vector3(), life: dur, maxLife: dur, grav: 0, grow: 1.2 });
  }
  projectile(from, dir, { color = 0xff6a1f, speed = 22, life = 1.4, size = 0.8, radius = 0.9, trail = true, onHit = null, owner = null, coreColor = 0xffffff } = {}) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.4, 12, 12), new THREE.MeshBasicMaterial({ color: coreColor }));
    const glowMat = new THREE.SpriteMaterial({ map: DOT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 });
    const glow = new THREE.Sprite(glowMat); glow.scale.set(size * 3, size * 3, 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
    halo.scale.set(size * 5.5, size * 5.5, 1);
    const light = new THREE.PointLight(color, 14, 10, 1.8); light.position.y = 0.3;
    grp.add(core); grp.add(glow); grp.add(halo); grp.add(light);
    grp.position.copy(from);
    this.scene.add(grp);
    this.projectiles.push({ mesh: grp, glow, halo, glowBase: size * 3, vel: dir.clone().normalize().multiplyScalar(speed), life, maxLife: life, radius, onHit, owner, color, trail, trailT: 0, seed: Math.random() * 10 });
  }
  beam(from, to, color = 0xff6a1f, dur = 0.35, thick = 0.3) {
    const dir = to.clone().sub(from); const len = dir.length();
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.5, thick * 0.7, len, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick * 1.7, len, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    grp.add(core); grp.add(outer);
    grp.position.copy(from).addScaledVector(dir, 0.5);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    this.scene.add(grp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(to); halo.scale.set(3.4, 3.4, 1); this.scene.add(halo);
    const halo2 = halo.clone(); halo2.position.copy(from); halo2.scale.set(2.2, 2.2, 1); this.scene.add(halo2);
    this.beams.push({ grp, core, outer, halo, halo2, t: 0, dur, seed: Math.random() * 10 });
  }
  bubble(target, color = 0x4fc3ff, dur = 3) {
    const mat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 18), mat);
    const wire = new THREE.Mesh(new THREE.SphereGeometry(1.37, 12, 8), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    const grp = new THREE.Group(); grp.add(m); grp.add(wire);
    this.scene.add(grp);
    const z = { grp, wire, target, t: 0, dur };
    this.zones.push(z);
    return z;
  }
  shieldShell(target, color = 0xff6a1f) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), mat);
    this.scene.add(m);
    return m;
  }
  distortionZone(pos, radius = 3.2, color = 0xff2b5e, dur = 5) {
    const grp = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.RingGeometry(radius * 0.3, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    dome.position.y = 0.05;
    grp.add(disc); grp.add(dome); grp.position.copy(pos); grp.position.y = 0;
    this.scene.add(grp);
    const z = { grp, disc, dome, target: null, fixed: pos.clone(), t: 0, dur, kind: 'chaos-zone' };
    this.zones.push(z);
    return z;
  }
  removeZone(z) {
    this.scene.remove(z.grp);
    const i = this.zones.indexOf(z);
    if (i >= 0) this.zones.splice(i, 1);
  }
  burst(pos, color, big = false) {
    // explosão em camadas: clarão branco + faíscas + shards + anel duplo + fumaça de energia
    this.flash(pos, 0xffffff, big ? 7 : 3.5, big ? 0.3 : 0.2);
    this.spawn(pos, { color: 0xffffff, count: big ? 22 : 10, speed: big ? 16 : 9, life: big ? 0.6 : 0.4, size: big ? 0.55 : 0.35, up: big ? 8 : 5 });
    this.spawn(pos, { color, count: big ? 55 : 24, speed: big ? 13 : 8, life: big ? 1.1 : 0.7, size: big ? 0.6 : 0.42, up: big ? 7 : 4 });
    this.shards(pos, { color, count: big ? 22 : 10, speed: big ? 12 : 8, up: big ? 10 : 7 });
    this.ring(pos, { color, maxR: big ? 10 : 5, dur: big ? 0.85 : 0.5 });
    if (big) this.scorch(pos, { color, radius: 2.6, dur: 7 });
  }
  update(dt, time) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.s); p.s.material.dispose(); this.particles.splice(i, 1); continue; }
      p.vel.y += p.grav * dt * 0.6;
      if (p.sway !== undefined) p.s.position.x += Math.sin(time * 9 + p.sway) * dt * 0.8;
      p.s.position.addScaledVector(p.vel, dt);
      if (p.s.position.y < 0.03 && p.grav < 0) { p.s.position.y = 0.03; p.vel.y *= -0.3; }
      const k = p.life / p.maxLife;
      p.s.material.opacity = Math.min(1, k * 1.7);
      const g = 1 + p.grow * dt;
      p.s.scale.x *= g; p.s.scale.y *= g;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      if (r.t < 0) continue;
      const k = Math.min(1, r.t / r.dur);
      const ease = 1 - Math.pow(1 - k, 3);
      const rad = 0.3 + ease * r.maxR;
      r.m.scale.set(rad, rad, 1);
      r.m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t += dt;
      const k = b.t / b.dur;
      const flick = 1 + Math.sin(time * 60 + b.seed) * 0.18;
      b.outer.scale.x = b.outer.scale.z = flick * (1 - k * 0.6);
      b.core.material.opacity = 0.95 * (1 - k);
      b.outer.material.opacity = 0.6 * (1 - k);
      b.halo.material.opacity = 0.9 * (1 - k);
      b.halo2.material.opacity = 0.8 * (1 - k);
      const hs = 1 + k * 2; b.halo.scale.set(3.4 * hs, 3.4 * hs, 1);
      if (k >= 1) { this.scene.remove(b.grp); this.scene.remove(b.halo); this.scene.remove(b.halo2); this.beams.splice(i, 1); }
    }
    for (let i = this.shardPool.length - 1; i >= 0; i--) {
      const s = this.shardPool[i]; s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.shardPool.splice(i, 1); continue; }
      s.vel.y -= 22 * dt;
      s.m.position.addScaledVector(s.vel, dt);
      if (s.m.position.y < 0.05) { s.m.position.y = 0.05; s.vel.y *= -0.45; s.vel.x *= 0.7; s.vel.z *= 0.7; }
      s.m.rotation.x += s.spin.x * dt; s.m.rotation.y += s.spin.y * dt; s.m.rotation.z += s.spin.z * dt;
      s.m.material.opacity = Math.min(1, s.life / s.maxLife * 1.5);
    }
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i]; p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      const grow = 1 - Math.pow(1 - Math.min(1, p.t / (p.dur * 0.3)), 3);
      p.grp.scale.set(0.3 + grow, 1, 0.3 + grow);
      p.grp.rotation.y += dt * 3;
      p.core.material.opacity = 0.9 * (1 - k);
      p.halo.material.opacity = 0.5 * (1 - k);
      if (k >= 1) { this.scene.remove(p.grp); this.pillars.splice(i, 1); }
    }
    for (let i = this.funnels.length - 1; i >= 0; i--) {
      const f = this.funnels[i]; f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.grp.rotation.y -= dt * (4 + k * 6);
      f.grp.scale.setScalar(1 + Math.sin(f.t * 10) * 0.05);
      for (const ch of f.grp.children) { if (ch.material) ch.material.opacity = Math.max(0, ch.material.opacity - dt * 0.25); }
      if (k >= 1) { this.scene.remove(f.grp); this.funnels.splice(i, 1); }
    }
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i]; s.t += dt;
      const k = s.t / s.dur;
      s.rim.material.opacity = Math.max(0, 0.8 * (1 - k * 1.4));
      s.m.material.opacity = Math.max(0, 0.75 * (1 - k));
      if (k >= 1) { this.scene.remove(s.m); this.scene.remove(s.rim); this.scorches.splice(i, 1); }
    }
    for (const z of this.zones) {
      z.t += dt;
      if (z.target) { z.grp.position.copy(z.target.group.position); z.grp.position.y = 1.1; z.grp.rotation.y += dt * 1.4; }
      else { z.grp.rotation.y += dt * 0.5; if (z.disc) { const s = 1 + Math.sin(time * 6) * 0.04; z.disc.scale.set(s, s, 1); } }
      if (z.wire) { z.wire.rotation.y -= dt * 2; z.wire.rotation.x += dt; }
    }
    for (const pr of this.projectiles) {
      pr.trailT -= dt;
      pr.halo.material.opacity = 0.32 + Math.sin(time * 25 + pr.seed) * 0.12;
      const puls = 1 + Math.sin(time * 30 + pr.seed) * 0.12;
      pr.glow.scale.set(pr.glowBase * puls, pr.glowBase * puls, 1);
      if (pr.trail && pr.trailT <= 0) {
        pr.trailT = 0.02;
        if (!this.capped) {
          const mat = new THREE.SpriteMaterial({ map: DOT, color: pr.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
          const s = new THREE.Sprite(mat);
          s.position.copy(pr.mesh.position);
          const sc = 0.45 + Math.random() * 0.3; s.scale.set(sc, sc, 1);
          this.scene.add(s);
          this.particles.push({ s, vel: new THREE.Vector3(0, 0.6, 0), life: 0.35, maxLife: 0.35, grav: 0, grow: 0.4 });
        }
      }
    }
  }
  killProjectile(pr) {
    this.scene.remove(pr.mesh);
    const i = this.projectiles.indexOf(pr);
    if (i >= 0) this.projectiles.splice(i, 1);
  }
  clearDynamic() {
    const rm = (o) => this.scene.remove(o);
    for (const p of this.particles) rm(p.s);
    for (const r of this.rings) rm(r.m);
    for (const pr of this.projectiles) rm(pr.mesh);
    for (const b of this.beams) { rm(b.grp); rm(b.halo); rm(b.halo2); }
    for (const z of this.zones) rm(z.grp);
    for (const s of this.shardPool) rm(s.m);
    for (const p of this.pillars) rm(p.grp);
    for (const f of this.funnels) rm(f.grp);
    for (const s of this.scorches) { rm(s.m); rm(s.rim); }
    this.particles = []; this.rings = []; this.projectiles = []; this.beams = []; this.zones = [];
    this.shardPool = []; this.pillars = []; this.funnels = []; this.scorches = [];
  }
}
