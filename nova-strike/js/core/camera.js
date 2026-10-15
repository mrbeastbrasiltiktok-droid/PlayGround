// Third-person shoulder camera: ground framing, aerial framing, aim zoom,
// look-ahead with velocity, collision push-in, clamped gentle shake.
import * as THREE from 'three';
import { clamp, lerp } from '../core/utils.js';

export class FollowCamera {
  constructor(camera, arena) {
    this.cam = camera; this.arena = arena;
    this.yaw = 0; this.pitch = -0.14;
    this.dist = 5.0; this.aimDist = 3.0;
    this.shakeT = 0; this.shakeAmp = 0;
    this.cur = this.dist;
    this.fovBase = 62;
    this.fovCur = this.fovBase;
    this._target = new THREE.Vector3();
  }
  addShake(a) { this.shakeAmp = clamp(this.shakeAmp + a, 0, 1); this.shakeT = Math.max(this.shakeT, 0.26); }
  shakeAmt() { return this.shakeAmp; }

  update(dt, target, opts = {}) {
    const { aiming = false, dash = false, flying = false, vel = null } = opts;
    // ---- framing ----
    const alt = Math.max(0, target.pos.y - this.arena.groundHeight(target.pos.x, target.pos.z));
    let want = aiming ? this.aimDist : this.dist;
    if (flying) want += clamp(alt * 0.09, 0, 2.6); // pull back in the air
    if (dash) want += 0.8;
    this.cur = lerp(this.cur, want, 1 - Math.exp(-9 * dt));
    const wantFov = flying ? this.fovBase + 4 : (aiming ? this.fovBase - 6 : this.fovBase);
    this.fovCur = lerp(this.fovCur, wantFov, 1 - Math.exp(-6 * dt));
    if (Math.abs(this.fovCur - this.cam.fov) > 0.05) {
      this.cam.fov = this.fovCur;
      this.cam.updateProjectionMatrix();
    }

    // ---- rig ----
    const head = target.aimPoint();
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch) + 0.12,
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = head.clone()
      .addScaledVector(off, this.cur)
      .addScaledVector(side, aiming ? 0.85 : 0.75);

    // collision push-in (pillars, geometry, ground)
    let d = this.cur;
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const p = head.clone().lerp(desired, i / steps);
      const gy = this.arena.groundHeight(p.x, p.z) + 0.45;
      let blocked = p.y < gy;
      if (!blocked) {
        for (const c of this.arena.colliders) {
          if (p.y < c.h && p.x > c.minX - 0.3 && p.x < c.maxX + 0.3 && p.z > c.minZ - 0.3 && p.z < c.maxZ + 0.3) { blocked = true; break; }
        }
      }
      if (blocked) { d = this.cur * ((i - 1) / steps); break; }
    }
    d = Math.max(2.2, d);
    let pos = head.clone().addScaledVector(off, d).addScaledVector(side, aiming ? 0.85 : 0.75);

    // shake (clamped small so aiming stays possible)
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeAmp * (this.shakeT / 0.26) * 0.42;
      pos.x += (Math.random() - 0.5) * s;
      pos.y += (Math.random() - 0.5) * s;
      pos.z += (Math.random() - 0.5) * s * 0.5;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    // smooth follow
    this.cam.position.lerp(pos, 1 - Math.exp(-24 * dt));
    // look point: toward aim direction, with velocity look-ahead
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let look = head.clone().addScaledVector(fwd, 9);
    if (vel) {
      const v = new THREE.Vector3(vel.x, 0, vel.z);
      if (v.lengthSq() > 4) look.addScaledVector(v.normalize(), 1.6); // look-ahead
    }
    look.y += this.pitch * 9;
    look.y = clamp(look.y, 0.4, target.pos.y + 24);
    this.cam.lookAt(look);
    if (this.cam.position.y < 0.45) this.cam.position.y = 0.45;
  }
}
