// Bot AI: FSM seek / strafe / retreat / aerial with aim error by difficulty.
import * as THREE from 'three';

export class Bot {
  constructor(char, difficulty = 0.6) {
    this.c = char;
    this.diff = difficulty;
    this.state = 'seek';
    this.target = null;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.aimErr = new THREE.Vector2();
    this.aimErrT = 0;
    this.thinkT = Math.random() * 0.3;
    this.flyPref = char.heroId === 'phoenix' ? 0.35 : (char.heroId === 'vanguard' ? 0.8 : 0.5);
    this.move = {
      x: 0, y: 0, yaw: 0, pitch: 0, firing: false, aiming: true,
      ascend: false, descend: false, jumpPressed: false, qPressed: false,
      dashPressed: false, ultPressed: false, charge: 0,
    };
  }

  acquire(actors) {
    let best = null, bd = Infinity;
    for (const a of actors) {
      if (!a.alive || a.team === this.c.team) continue;
      const d = a.pos.distanceToSquared(this.c.pos);
      if (d < bd) { bd = d; best = a; }
    }
    this.target = best;
  }

  update(dt, actors, game) {
    const c = this.c;
    if (!c.alive || c.controlsLocked()) {
      // staggered/recovering: no input (controller drives the flinch)
      Object.assign(this.move, { x: 0, y: 0, firing: false, ascend: false, descend: false });
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.22 + Math.random() * 0.2;
      this.acquire(actors);
      if (c.hp < c.maxHp * 0.3 && Math.random() < 0.5) this.state = 'retreat';
      else if (this.target) {
        const d = c.pos.distanceTo(this.target.pos);
        if (d < 8) this.state = Math.random() < 0.45 ? 'strafe' : 'retreat';
        else if (d < 26) this.state = 'strafe';
        else this.state = 'seek';
      } else this.state = 'seek';
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;

      if (this.target && c.qCd <= 0 && Math.random() < 0.35 + this.diff * 0.45) {
        const d = c.pos.distanceTo(this.target.pos);
        if (c.heroId === 'phoenix' && d < 10) this.move.qPressed = true;
        else if (c.heroId === 'vanguard' && d > 6 && d < 30) this.move.qPressed = true;
        else if (c.heroId === 'inferno' && d > 8) this.move.qPressed = true;
      }
      if (c.ultCharge >= 100 && this.target && Math.random() < 0.75) {
        if (c.pos.distanceTo(this.target.pos) < 22) this.move.ultPressed = true;
      }
      if (c.dashCd <= 0 && Math.random() < 0.12 + this.diff * 0.2) this.move.dashPressed = true;
    }

    const m = this.move;
    m.qPressed = false; m.ultPressed = false; m.dashPressed = false; m.jumpPressed = false;

    if (this.target && this.target.alive) {
      const t = this.target;
      const to = new THREE.Vector3().subVectors(t.pos, c.pos);
      const dist = to.length();
      this.aimErrT -= dt;
      if (this.aimErrT <= 0) {
        this.aimErrT = 0.45 + Math.random() * 0.5;
        const e = (1 - this.diff) * 0.22;
        this.aimErr.set((Math.random() - 0.5) * e, (Math.random() - 0.5) * e);
      }
      const d = new THREE.Vector3().subVectors(t.aimPoint(), c.aimPoint());
      m.yaw = Math.atan2(-d.x, -d.z) + this.aimErr.x;
      m.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + this.aimErr.y - 0.02;
      const aligned = Math.abs(this.aimErr.x) < 0.1;
      m.firing = dist < 36 && aligned && (t.pos.y - c.pos.y) < 13;
      m.aiming = dist > 5;

      // steering wish (world space)
      const flat = to.clone(); flat.y = 0;
      const distFlat = flat.length() || 1;
      flat.divideScalar(distFlat);
      const side = new THREE.Vector3(-to.z, 0, to.x).normalize().multiplyScalar(this.strafeDir);
      let wish = new THREE.Vector3();
      if (this.state === 'seek') wish.copy(flat);
      else if (this.state === 'retreat') wish.copy(flat.clone().negate()).addScaledVector(side, 0.6);
      else wish.copy(side).addScaledVector(flat, dist > 17 ? 0.7 : dist < 9 ? -0.6 : 0.15);
      if (c.hp < c.maxHp * 0.25) wish.addScaledVector(flat, -0.4);

      // aerial behaviour: flying heroes gain height when far, phoenix soars/glides
      if (c.heroId !== 'phoenix') {
        const wantFly = c.flyEnergy > 0.25 && (dist > 15 || Math.random() < dt * this.flyPref * 1.6);
        m.ascend = !!wantFly && c.flyEnergy > 0.25;
        m.descend = !m.ascend && c.pos.y > 11 && Math.random() < 0.3;
      } else {
        m.jumpPressed = c.grounded && Math.random() < dt * 0.9;
        m.ascend = !c.grounded && c.glide < 0.4 && Math.random() < dt * 1.2;
      }

      // world wish -> local (relative to aim yaw)
      const fwd = new THREE.Vector3(-Math.sin(m.yaw), 0, -Math.cos(m.yaw));
      const right = new THREE.Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw));
      m.y = wish.dot(fwd); m.x = wish.dot(right);
      const mag = Math.hypot(m.x, m.y);
      if (mag > 1) { m.x /= mag; m.y /= mag; }
    } else {
      // patrol toward arena center
      const to = new THREE.Vector3(-c.pos.x, 0, -c.pos.z);
      if (to.length() > 7) {
        const yaw = Math.atan2(-to.x, -to.z);
        m.yaw = yaw; m.y = 0.8; m.x = 0; m.firing = false;
      } else { m.x = 0; m.y = 0; m.firing = false; }
      m.ascend = false; m.descend = false;
    }
  }
}
