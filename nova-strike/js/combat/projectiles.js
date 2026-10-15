// Real projectiles: pooling, gravity/arc, homing, splash, trails.
import * as THREE from 'three';
import { radialTexture } from '../core/utils.js';

export class Projectiles {
  constructor(scene, fx, audio) {
    this.scene = scene; this.fx = fx; this.audio = audio;
    this.items = [];
    this.tex = radialTexture();
    // pre-allocate 40 bolt meshes
    for (let i = 0; i < 40; i++) {
      const grp = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(1.4, 1.4, 1);
      grp.add(core); grp.add(halo);
      grp.visible = false; scene.add(grp);
      this.items.push({ mesh: grp, core, halo, active: false, vel: new THREE.Vector3(), life: 0, dmg: 0, owner: null, team: -1, color: 0xffffff, splash: 0, homing: 0, gravity: 0, trailT: 0 });
    }
  }

  fire({ from, dir, speed, dmg, owner, team, color, glow, splash = 0, homing = 0, gravity = 0, size = 1, big = false, life = 2.2 }) {
    const p = this.items.find(i => !i.active);
    this.fired = (this.fired || 0) + 1;
    if (!p) return;
    p.active = true; p.mesh.visible = true;
    p.mesh.position.copy(from);
    p.vel.copy(dir).multiplyScalar(speed);
    p.life = life; p.dmg = dmg; p.owner = owner; p.team = team;
    p.color = color; p.glow = glow || color; p.splash = splash; p.homing = homing; p.gravity = gravity; p.trailT = 0; p.big = big;
    p.core.material.color.set(color);
    p.core.scale.setScalar(big ? 0.3 : 0.16 * size);
    p.halo.material.color.set(glow || color);
    p.halo.scale.set(big ? 3.2 : 1.4 * size, big ? 3.2 : 1.4 * size, 1);
    p.halo.material.opacity = big ? 0.95 : 0.8;
  }

  update(dt, actors, arena, onHit) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.gravity) p.vel.y += p.gravity * dt;
      // homing: steer toward nearest enemy of owner team
      if (p.homing > 0) {
        let best = null, bd = 30 * 30;
        for (const a of actors) {
          if (!a.alive || a.team === p.team) continue;
          const d = a.pos.distanceToSquared(p.mesh.position);
          if (d < bd) { bd = d; best = a; }
        }
        if (best) {
          const want = new THREE.Vector3().subVectors(best.aimPoint(), p.mesh.position).normalize().multiplyScalar(p.vel.length());
          p.vel.lerp(want, Math.min(1, p.homing * dt));
        }
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      const mp = p.mesh.position;
      // trail (charge orbs leave denser trails)
      p.trailT -= dt;
      if (p.trailT <= 0) { p.trailT = p.big ? 0.012 : 0.02; this.fx.trail(mp, p.glow, p.big ? 1.6 : 1.0); }
      let dead = p.life <= 0;
      // ground hit
      const gy = arena.groundHeight(mp.x, mp.z);
      if (!dead && mp.y <= gy + 0.1) {
        onHit(p, null, new THREE.Vector3(mp.x, gy + 0.2, mp.z));
        dead = true;
      }
      // arena bounds
      if (!dead && (Math.hypot(mp.x, mp.z) > 44 || mp.y > 40)) dead = true;
      // actor hit (capsule approx: dist to segment hips->head)
      if (!dead) {
        for (const a of actors) {
          if (!a.alive || a === p.owner || a.team === p.team) continue;
          const c = a.center();
          const r = 0.85 + (a.flying ? 0.2 : 0);
          if (mp.distanceToSquared(c) < r * r || mp.distanceToSquared(a.pos.clone().setY(a.pos.y + 1)) < 0.8) {
            onHit(p, a, mp.clone());
            dead = true; break;
          }
        }
      }
      if (dead) { p.active = false; p.mesh.visible = false; }
    }
  }
}
