// NOVA STRIKE — shared CharacterController.
// State machine: ground | air | fly | dash | stagger | staggerAir | knockdown | dead
// Powers ground movement, real 3D flight (vanguard/inferno), phoenix soar/glide,
// charge primary, abilities, ultimates, hit reactions, knockback, recovery.
import * as THREE from 'three';
import { HeroRig } from './rig.js';
import { HEROES, HeroAbilities, Config } from '../core/config.js';

let UID = 1;

function dampAngleTo(cur, target, lambda, dt) {
  const d = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return cur + d * (1 - Math.exp(-lambda * dt));
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Character {
  constructor(scene, fx, proj, audio, arena, opts) {
    this.id = UID++;
    this.scene = scene; this.fx = fx; this.proj = proj; this.audio = audio; this.arena = arena;
    this.heroId = opts.heroId;
    this.def = HEROES[this.heroId];
    this.ab = HeroAbilities[this.heroId];
    this.team = opts.team;
    this.isPlayer = !!opts.isPlayer;
    this.name = opts.name || this.def.name;
    this.rig = new HeroRig(this.heroId);
    scene.add(this.rig.group);

    this.pos = this.rig.group.position;
    this.vel = new THREE.Vector3();
    this.yaw = opts.yaw || 0; this.pitch = 0; this.aimPitch = 0;
    this.hp = this.maxHp = this.def.hp;
    this.alive = true;
    this.state = 'air';
    this.stateT = 0;
    this.fireCd = 0; this.qCd = 0; this.dashCd = 0;
    this.ultCharge = opts.ultCharge ?? 30;
    this.ultActive = 0;
    this.hitT = 0;
    this.speed2d = 0;
    this.flyEnergy = 1;
    this.glide = 0;
    this.burnT = 0; this.burnDps = 0;
    this.invuln = 0;
    this.grounded = true; this.flying = false;
    this.landT = 0;
    this.dashDir = new THREE.Vector3();
    this.dashTrailT = 0;
    this.queue = [];
    this.rebirthReady = true;
    this.buildHpBar();
    this.spawnAt(opts.spawn);
  }

  // ---------------- setup / ui ----------------
  buildHpBar() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 16;
    this.hpCanvas = c;
    const t = new THREE.CanvasTexture(c);
    this.hpTex = t;
    this.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    this.hpBar.scale.set(1.7, 0.22, 1);
    this.scene.add(this.hpBar);
  }
  drawHpBar() {
    const g = this.hpCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 16);
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 0, 128, 16);
    const k = clamp(this.hp / this.maxHp, 0, 1);
    g.fillStyle = this.team === 0 ? '#35c8ff' : '#ff5f5f';
    g.fillRect(2, 2, 124 * k, 12);
    if (this.isPlayer) { g.fillStyle = '#fff'; g.fillRect(2, 2, 124 * k, 3); }
    this.hpTex.needsUpdate = true;
  }
  center() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.25, this.pos.z); }
  aimPoint() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z); }
  chestPoint() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.42, this.pos.z); }
  aimDir() {
    const d = new THREE.Vector3(0, 0, -1);
    d.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return d;
  }
  controlsLocked() {
    return this.alive && (this.state === 'stagger' || this.state === 'staggerAir' || this.state === 'knockdown');
  }
  canAct() { return this.alive && !this.controlsLocked() && this.state !== 'dash'; }

  // Sticky flight state machine:
  // - press ascend to engage (from ground or air), releasing hovers
  // - brake_x when the stick is released
  // - descend lets you drop; touching down ends flight with a landing beat
  // - control is never lost while attacking; empty fuel forces a fall
  flyEngaged(canFly, move, vertIn) {
    if (!canFly || this.controlsLocked() || this.state === 'dash' || !this.alive) return false;
    const gy = this.arena.groundHeight(this.pos.x, this.pos.z);
    if (this.flying) {
      // keep flying until landed, out of energy, or staggered (handled elsewhere)
      return this.flyEnergy > 0.01 && (this.pos.y > gy + 0.05 || vertIn > 0);
    }
    // engage: ascend pressed (ground takeoff or air re-engagement after a fall)
    return !!move.ascend && this.flyEnergy > 0.02 && this.landT <= 0;
  }

  spawnAt(p) {
    if (p) this.pos.set(p.x, p.y, p.z);
    else {
      const a = Math.random() * Math.PI * 2;
      const side = this.team === 0 ? -1 : 1;
      this.pos.set(side * (20 + Math.random() * 8), 0, (Math.random() - 0.5) * 30);
    }
    this.pos.y = this.arena.groundHeight(this.pos.x, this.pos.z);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp; this.alive = true;
    this.state = 'ground'; this.stateT = 0;
    this.ultActive = 0; this.burnT = 0; this.glide = 0; this.dashTrailT = 0;
    this.flyEnergy = 1; this.invuln = Config.spawnInvuln;
    this.fireCd = 0; this.qCd = 0; this.dashCd = 0; this.hitT = 0;
    this.queue.length = 0;
    this.fx.shockwave(this.pos, this.team === 0 ? 0x39d5ff : 0xff5f3c, 5, 0.5);
    this.drawHpBar();
  }

  // ---------------- damage / reactions ----------------
  takeDamage(amount, from, game, opts = {}) {
    if (!this.alive || this.invuln > 0) return 0;
    if (this.heroId === 'phoenix' && this.rebirthReady && this.hp - amount <= 0) {
      this.rebirthReady = false;
      this.hp = this.maxHp * 0.4;
      this.fx.burst(this.center(), { n: 60, color: 0xff9a3c, speed: 12, life: 0.8 });
      this.fx.shockwave(this.pos, 0xff9a3c, 9, 0.6);
      this.audio.explosion(true);
      this.rig.setFlash(1);
      game.onEvent('rebirth', this);
      this.drawHpBar();
      return this.maxHp * 0.4;
    }
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    this.hitT = 1;
    this.rig.setFlash(1);
    this.ultCharge = clamp(this.ultCharge + amount * 0.035, 0, 100);
    this.drawHpBar();
    if (this.hp <= 0) { this.hp = 0; this.die(game, from); return dealt; }

    if (!opts.noStagger && this.invuln <= 0 && this.state !== 'dash') {
      const heavy = amount >= Config.staggerThreshold || !!opts.heavy;
      const launch = amount >= Config.launchThreshold || !!opts.launch;
      if (launch) {
        const dir = from ? new THREE.Vector3().subVectors(this.pos, from.pos).setY(0) : this.aimDir().negate();
        if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
        dir.normalize();
        this.vel.x = dir.x * 13; this.vel.z = dir.z * 13; this.vel.y = 9.5;
        this.enterState('staggerAir');
        this.fx.burst(this.center(), { n: 14, color: 0xffd0a0, speed: 6, life: 0.4 });
        this.audio.hurt();
        if (this.isPlayer) game.shake(0.4);
      } else if (heavy) {
        this.enterState('stagger');
        if (from) {
          const dir = new THREE.Vector3().subVectors(this.pos, from.pos).setY(0);
          if (dir.lengthSq() > 0.001) {
            dir.normalize();
            this.vel.x = dir.x * 7; this.vel.z = dir.z * 7;
          }
        }
        this.audio.hurt();
        if (this.isPlayer) game.shake(0.2);
      }
    }
    return dealt;
  }

  die(game, from) {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead'; this.stateT = 0;
    this.respawnT = Config.respawnTime;
    this.fx.burst(this.center(), { n: 50, color: this.def.colors.glow, speed: 10, life: 0.8 });
    this.fx.shockwave(this.pos, this.def.colors.glow, 7, 0.5);
    this.audio.explosion(false);
    this.queue.length = 0;
    this.hpBar.visible = false;
    game.onKill(from, this);
  }

  // ---------------- combat ----------------
  aimWithAssist(dir, game) {
    if (!this.isPlayer || !game.settings || !game.settings.get('aimAssist')) return dir;
    let best = null, bestDot = 0.965;
    for (const a of game.actors) {
      if (!a.alive || a.team === this.team) continue;
      const to = new THREE.Vector3().subVectors(a.center(), this.chestPoint());
      const d = to.length();
      if (d > 50) continue;
      to.normalize();
      const dot = to.dot(dir);
      if (dot > bestDot) { bestDot = dot; best = to; }
    }
    if (best) dir.lerp(best, 0.4).normalize();
    return dir;
  }

  tryFire(game, charged) {
    if (this.fireCd > 0 || !this.canAct()) return;
    this.fireAttempts = (this.fireAttempts || 0) + 1;
    const d = this.def;
    this.fireCd = 1 / d.fireRate;
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = this.rig.muzzle(side);
    if (from.lengthSq() < 0.01) from.copy(this.chestPoint());
    const dir = this.aimDir();
    const spread = charged ? 0.004 : 0.018;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    dir.copy(this.aimWithAssist(dir, game));
    const mul = charged ? Config.chargeMul : 1;
    const size = (charged ? 2.0 : 1) * (this.heroId === 'inferno' ? 1.2 : 1);
    this.proj.fire({
      from, dir,
      speed: d.projSpeed * (charged ? 0.72 : 1),
      dmg: d.dmg * mul,
      owner: this, team: this.team,
      color: charged ? 0xffffff : d.colors.glow,
      glow: this.def.chargeColor,
      splash: this.heroId === 'inferno' ? (charged ? 4.4 : 3.2) : 0,
      homing: this.heroId === 'phoenix' ? (charged ? 4.2 : 2.4) : 0,
      gravity: this.heroId === 'inferno' ? -6 : 0,
      size, big: !!charged,
      life: charged ? 3.2 : 2.2,
    });
    this.fx.muzzle(from, charged ? this.def.chargeColor : d.colors.glow, charged ? 1.6 : 0.9);
    this.audio.shoot(this.heroId, charged);
    this.ultCharge = clamp(this.ultCharge + (charged ? 9 : 2.5), 0, 100);
    if (charged) {
      this.fx.shockwave(from, this.def.chargeColor, 3, 0.3);
      if (this.isPlayer) { game.shake(0.2); game.hitStop(Config.hitStopHeavy * 0.5); }
    }
    if (this.heroId === 'phoenix') this.burnApply = true;
  }

  dash(move, game) {
    if (this.dashCd > 0 || !this.alive || this.controlsLocked()) return;
    this.dashCd = Config.dashCd;
    const dir = new THREE.Vector3();
    if (Math.hypot(move.x, move.y) > 0.1) {
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      dir.copy(f.multiplyScalar(move.y).add(r.multiplyScalar(move.x))).normalize();
    } else {
      dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }
    this.dashDir.copy(dir);
    this.enterState('dash');
    this.stateT = Config.dashTime;
    this.invuln = Math.max(this.invuln, Config.dashTime); // i-frames while dashing
    this.vel.x = dir.x * Config.dashSpeed;
    this.vel.z = dir.z * Config.dashSpeed;
    this.vel.y = Math.max(this.vel.y * 0.3, this.grounded ? 1.5 : 0.4);
    this.fx.burst(this.center(), { n: 12, color: this.heroId === 'inferno' ? 0xff8a3c : 0x9fe8ff, speed: 6, life: 0.3 });
    this.audio.dash();
    if (this.isPlayer) game.shake(0.1);
  }

  ability1(game) {
    if (this.qCd > 0 || !this.canAct()) return;
    if (this.heroId === 'vanguard') {
      this.qCd = this.ab.q.cd;
      const base = this.aimDir();
      for (let k = 0; k < 5; k++) {
        this.queue.push({
          t: k * 0.085, fn: () => {
            if (!this.alive) return;
            const from = this.chestPoint();
            const d2 = base.clone();
            d2.x += (Math.random() - 0.5) * 0.07;
            d2.y += (Math.random() - 0.5) * 0.05 - 0.01;
            d2.normalize();
            this.proj.fire({ from, dir: d2, speed: 62, dmg: 42, owner: this, team: this.team, color: 0x66d9ff, size: 0.9 });
            this.fx.muzzle(from, 0x66d9ff, 0.8);
            this.audio.shoot('vanguard');
          },
        });
      }
      this.fx.burst(this.chestPoint(), { n: 12, color: 0x66d9ff, speed: 6, life: 0.3 });
    } else if (this.heroId === 'phoenix') {
      this.qCd = this.ab.q.cd;
      this.queue.push({ t: 0.14, fn: () => this.novaBurst(game) });
    } else {
      this.qCd = this.ab.q.cd;
      this.dashDir.copy(this.aimDir()).setY(0);
      if (this.dashDir.lengthSq() < 0.01) this.dashDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.enterState('dash');
      this.stateT = 0.3;
      this.invuln = Math.max(this.invuln, 0.3);
      this.vel.x = this.dashDir.x * 26; this.vel.z = this.dashDir.z * 26;
      this.dashTrailT = 0.9;
      this.audio.dash();
      if (this.isPlayer) game.shake(0.15);
    }
  }

  novaBurst(game) {
    if (!this.alive) return;
    this.fx.burst(this.center(), { n: 60, color: 0xff9a3c, speed: 14, life: 0.6 });
    this.fx.burst(this.center(), { n: 24, color: 0xfff0c0, speed: 8, life: 0.4 });
    this.fx.shockwave(this.pos, 0xff9a3c, 11, 0.6);
    this.audio.explosion(false);
    for (const a of game.actors) {
      if (a === this || !a.alive || a.team === this.team) continue;
      const dist = a.pos.distanceTo(this.pos);
      if (dist < 9.5) {
        const kb = new THREE.Vector3().subVectors(a.pos, this.pos).setY(0).normalize();
        game.damage(a, 95, this, { heavy: true });
        if (a.alive) {
          a.vel.x = kb.x * 14; a.vel.z = kb.z * 14; a.vel.y = 7.5;
          a.enterState('staggerAir');
          a.burnT = 3; a.burnDps = 26; a.burnFrom = this;
        }
      }
    }
    if (this.isPlayer) { game.shake(0.35); game.hitStop(Config.hitStopHeavy); }
  }

  ultimate(game) {
    if (this.ultCharge < 100 || !this.alive || this.controlsLocked()) return false;
    this.ultCharge = 0;
    this.audio.ult();
    if (this.heroId === 'vanguard') {
      this.ultActive = 2.2;
      this.fx.shockwave(this.pos, 0x66d9ff, 8, 0.5);
    } else if (this.heroId === 'phoenix') {
      this.queue.push({ t: 0, fn: () => this.meteorStorm(game, this.aimDir()) });
    } else {
      this.queue.push({ t: 0.1, fn: () => this.supernova(game) });
    }
    game.onEvent('ult', this);
    return true;
  }

  meteorStorm(game, dir) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + 380);
    this.drawHpBar();
    this.fx.burst(this.chestPoint(), { n: 40, color: 0xffc9a0, speed: 8, life: 0.5 });
    this.audio.explosion(false);
    const target = this.chestPoint().addScaledVector(dir, 15);
    let i = 0;
    const spawn = () => {
      if (!this.alive || !game.running || i >= 8) return;
      i++;
      const p = target.clone();
      p.x += (Math.random() - 0.5) * 13; p.z += (Math.random() - 0.5) * 13; p.y += 16;
      this.fx.meteor(p, 0xff8a3c);
      this.queue.push({
        t: 0.42, fn: () => {
          if (!this.alive || !game.running) return;
          const g = new THREE.Vector3(p.x, this.arena.groundHeight(p.x, p.z) + 0.4, p.z);
          this.fx.burst(g, { n: 30, color: 0xff7a1a, speed: 10, life: 0.6 });
          this.fx.shockwave(g, 0xff9a3c, 7, 0.5);
          this.audio.explosion(false);
          for (const a of game.actors) {
            if (!a.alive || a.team === this.team) continue;
            const d = a.center().distanceTo(g);
            if (d < 5.6) game.damage(a, 95 * (1 - d / 8) + 60, this, { heavy: true });
          }
        },
      });
      this.queue.push({ t: 0.2, fn: spawn });
    };
    spawn();
  }

  supernova(game) {
    if (!this.alive) return;
    this.fx.burst(this.center(), { n: 70, color: 0xffc63c, speed: 15, life: 0.9 });
    this.fx.burst(this.center(), { n: 40, color: 0xffffff, speed: 9, life: 0.6 });
    this.fx.shockwave(this.pos, 0xffc63c, 17, 0.9);
    this.fx.shockwave(this.pos, 0xffffff, 11, 0.7);
    this.audio.explosion(true);
    game.shake(0.7);
    game.hitStop(Config.hitStopHeavy * 1.4);
    for (const a of game.actors) {
      if (!a.alive || a.team === this.team) continue;
      const dist = a.pos.distanceTo(this.pos);
      if (dist < 14) {
        const fall = 1 - dist / 18;
        game.damage(a, 240 * fall + 60, this, { heavy: true, launch: dist < 9 });
        if (a.alive) {
          const kb = new THREE.Vector3().subVectors(a.pos, this.pos).setY(0).normalize();
          a.vel.x = kb.x * 20 * fall; a.vel.z = kb.z * 20 * fall; a.vel.y = 9 * fall;
          a.enterState('staggerAir');
        }
      }
    }
  }

  // ---------------- per-frame update ----------------
  update(dt, move, game) {
    this.fireCd -= dt; this.qCd -= dt; this.dashCd -= dt;
    this.hitT = Math.max(0, this.hitT - dt * 3);
    this.invuln = Math.max(0, this.invuln - dt);
    this.landT = Math.max(0, this.landT - dt);

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) this.queue.splice(i, 1)[0].fn();
    }

    if (!this.alive) {
      this.respawnT -= dt;
      this.rig.animate(dt, { dead: true, speed: 0, state: 'dead' });
      return;
    }

    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (Math.random() < dt * 14) this.fx.trail(this.center(), 0xff7a1a, 1.2);
      this.drawHpBarThrottled(dt);
      if (this.hp <= 0) { this.hp = 0; this.die(game, this.burnFrom); return; }
    }

    if (move.dashPressed) this.dash(move, game);
    if (move.qPressed) this.ability1(game);
    if (move.ultPressed) this.ultimate(game); // real ults handle timing internally

    // player fires on shot request (tap = light, hold-release = charge)
    if (this.isPlayer && move.shot) this.tryFire(game, move.shot === 2);
    else if (!this.isPlayer && move.firing && this.canAct()) this.tryFire(game, false);

    const locked = this.controlsLocked();
    this.pitch = clamp(move.pitch, -1.1, 1.1);
    this.aimPitch = -this.pitch;
    this.yaw = dampAngleTo(this.yaw, move.yaw, locked ? 4 : 15, dt);

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wish = new THREE.Vector3()
      .addScaledVector(new THREE.Vector3(-sin, 0, -cos), locked ? 0 : move.y)
      .addScaledVector(new THREE.Vector3(cos, 0, -sin), locked ? 0 : move.x);
    if (wish.lengthSq() > 1) wish.normalize();

    const vertIn = (move.ascend ? 1 : 0) - (move.descend ? 1 : 0);
    const canFly = this.heroId !== 'phoenix';
    const flyHeld = !!move.ascend && this.flyEnergy > 0.02;

    // ---- state resolution ----
    if (this.state === 'dash') {
      this.stateT -= dt;
      const fade = this.stateT > Config.dashTime * 0.25 ? 1 : 0.35;
      this.vel.x = this.dashDir.x * Config.dashSpeed * fade;
      this.vel.z = this.dashDir.z * Config.dashSpeed * fade;
      this.vel.y -= Config.gravity * 0.35 * dt;
      if (this.heroId === 'inferno' && Math.random() < 0.8) {
        const gp = this.pos.clone(); gp.y += 0.45;
        this.fx.trail(gp, 0xff7a1a, 1.6);
      }
      if (this.stateT <= 0) this.enterState(this.grounded ? 'ground' : 'air');
    } else if (this.state === 'stagger') {
      this.stateT += dt;
      const f = Math.min(1, 10 * dt);
      this.vel.x -= this.vel.x * f; this.vel.z -= this.vel.z * f;
      this.vel.y = Math.max(Config.maxFall, this.vel.y + Config.gravity * dt);
      if (this.stateT > Config.staggerLight) this.enterState(this.grounded ? 'ground' : 'air');
    } else if (this.state === 'knockdown') {
      this.stateT += dt;
      const f = Math.min(1, 12 * dt);
      this.vel.x -= this.vel.x * f; this.vel.z -= this.vel.z * f;
      this.vel.y = Math.max(Config.maxFall, this.vel.y + Config.gravity * dt);
      if (this.stateT > Config.knockdownTime) {
        this.enterState('ground');
        this.invuln = Math.max(this.invuln, Config.knockdownInvuln); // guaranteed recovery window
        this.vel.multiplyScalar(0.3);
      }
    } else if (this.state === 'staggerAir') {
      this.stateT += dt;
      const k = Math.min(1, Config.airAccel * 0.15 / Math.max(1, this.def.speed) * 60 * dt);
      this.vel.x += (wish.x * this.def.speed * 0.25 - this.vel.x) * k;
      this.vel.z += (wish.z * this.def.speed * 0.25 - this.vel.z) * k;
      this.vel.y = Math.max(Config.maxFall, this.vel.y + Config.gravity * dt);
    } else if (this.flyEngaged(canFly, move, vertIn)) {
      // ---- 3D FLIGHT (sticky state: hover on release, BRAKE when drifting) ----
      if (!this.flying) {
        this.flying = true;
        if (this.grounded) {
          // takeoff impulse + FX
          this.vel.y = 5.5;
          this.fx.burst(this.pos, { n: 18, color: this.def.colors.glow, speed: 7, life: 0.4 });
          this.audio.dash();
        }
      }
      this.state = 'fly';
      const flyMax = this.def.flySpeed * (move.aiming ? 0.7 : 1);
      const target = wish.clone().multiplyScalar(flyMax);
      target.y = vertIn * Config.flyVertSpeed;
      const k = Math.min(1, Config.flyAccel / flyMax * dt);
      this.vel.x += (target.x - this.vel.x) * k;
      this.vel.z += (target.z - this.vel.z) * k;
      if (vertIn !== 0) {
        this.vel.y += (target.y - this.vel.y) * Math.min(1, Config.flyAccel / Config.flyVertSpeed * dt);
      } else {
        this.vel.y *= 1 - Math.min(1, 4 * dt); // hover in place
      }
      if (wish.lengthSq() < 0.01) { // braking
        const brake = Math.min(1, 5.5 * dt);
        this.vel.x -= this.vel.x * brake;
        this.vel.z -= this.vel.z * brake;
      }
      if (vertIn > 0 || this.vel.y > 0.6) {
        this.flyEnergy = Math.max(0, this.flyEnergy - Config.flyEnergyDrain * (vertIn > 0 ? 1.4 : 0.6) * dt);
      } else {
        this.flyEnergy = Math.min(1, this.flyEnergy + Config.flyEnergyRegen * 0.4 * dt);
      }
      if (Math.random() < dt * 26) {
        const bp = this.pos.clone(); bp.y += 0.35;
        this.fx.trail(bp, this.def.colors.glow, 1.1);
      }
      // fuel out mid-air -> unpowered fall (can re-engage after regen)
      if (this.flyEnergy <= 0.01) this.flying = false;
      // land when descending into the surface
      if (this.pos.y <= this.arena.groundHeight(this.pos.x, this.pos.z) + 0.02 && vertIn <= 0) {
        this.flying = false;
        this.enterState('ground');
        this.landT = 0.3;
      }
    } else if (this.heroId === 'phoenix' && this.grounded && move.ascend && this.landT <= 0 && !this.controlsLocked()) {
      // ---- phoenix soar (leap + glide) ----
      this.vel.y = Config.jumpVel * 1.18;
      this.enterState('air');
      this.glide = 2.2;
      this.audio.dash();
      this.fx.burst(this.pos, { n: 18, color: 0xff9a3c, speed: 6, life: 0.4 });
    } else if (!this.grounded) {
      // ---- air control (momentum preserved) ----
      this.flying = false;
      const maxAir = this.def.speed * 0.85;
      const k = Math.min(1, Config.airAccel / maxAir * dt);
      this.vel.x += (wish.x * maxAir - this.vel.x) * k;
      this.vel.z += (wish.z * maxAir - this.vel.z) * k;
      let g = Config.gravity;
      if (this.heroId === 'phoenix' && this.glide > 0) {
        this.glide -= dt;
        g *= 0.16;
        if (Math.random() < dt * 20) {
          const bp = this.pos.clone(); bp.y += 0.8;
          this.fx.trail(bp, 0xffb35c, 1.0);
        }
      }
      this.vel.y = Math.max(Config.maxFall, this.vel.y + g * dt);
    } else {
      // ---- ground locomotion ----
      this.flying = false;
      const maxSpeed = this.def.speed * (move.aiming ? 0.62 : 1);
      const moving = wish.lengthSq() > 0.01;
      const k = Math.min(1, (moving ? Config.groundAccel : Config.groundDecel) / maxSpeed * dt);
      this.vel.x += (wish.x * maxSpeed - this.vel.x) * k;
      this.vel.z += (wish.z * maxSpeed - this.vel.z) * k;
      this.vel.y = -0.01;
      this.flyEnergy = Math.min(1, this.flyEnergy + Config.flyEnergyRegen * dt);
    }

    // ---- integrate + collide ----
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    this.arena.collide(this.pos, 0.55);
    if (this.pos.y > Config.flyMaxAlt) {
      this.pos.y = Config.flyMaxAlt;
      this.vel.y = Math.min(0, this.vel.y) * 0.96;
    }
    const gy = this.arena.groundHeight(this.pos.x, this.pos.z);
    const wasGrounded = this.grounded;
    if (this.pos.y <= gy + 0.001) {
      const impact = this.vel.y;
      this.pos.y = gy;
      this.grounded = true;
      if (!wasGrounded) this.onLand(impact, gy, game);
      if (this.vel.y < 0) this.vel.y = 0;
      this.glide = 0;
      if (this.state === 'air' || this.state === 'fly' || this.state === 'staggerAir') {
        if (this.state === 'staggerAir') this.enterState('knockdown');
        else { this.enterState('ground'); if (impact < -14) this.landT = 0.28; }
      }
    } else if (this.pos.y > gy + 0.03) {
      this.grounded = false;
      if (this.state === 'ground' || this.state === 'knockdown') this.enterState('air');
    }
    if (this.pos.y < -4) { this.pos.y = 0; this.vel.set(0, 0, 0); }
    this.flying = this.state === 'fly';
    this.speed2d = Math.hypot(this.vel.x, this.vel.z);

    // inferno dash burning trail
    if (this.dashTrailT > 0) {
      this.dashTrailT -= dt;
      if (Math.random() < 0.9) {
        const gp = this.pos.clone(); gp.y += 0.5;
        this.fx.trail(gp, 0xff7a1a, 1.7);
        for (const a of game.actors) {
          if (!a.alive || a.team === this.team) continue;
          if (a.pos.distanceToSquared(this.pos) < 2.4) game.damage(a, 34 * 60 * dt, this, { noStagger: true });
        }
      }
    }

    // ---- unibeam channel ----
    if (this.ultActive > 0) {
      this.ultActive -= dt;
      const from = this.chestPoint();
      const dir = this.aimDir();
      const to = from.clone().addScaledVector(dir, 44);
      this.fx.beam(from, to, 0x9fe8ff, 0.85, 0.09);
      this.audio.beam();
      if (this.isPlayer) game.shake(0.08);
      for (const a of game.actors) {
        if (a === this || !a.alive || a.team === this.team) continue;
        const ap = a.center().sub(from);
        const tProj = clamp(ap.dot(dir), 0, 44);
        const closest = from.clone().addScaledVector(dir, tProj);
        if (a.center().distanceTo(closest) < 1.5) {
          game.damage(a, 150 * 60 * dt, this, { noStagger: true });
        }
      }
      if (this.ultActive <= 0) game.onEvent('ultEnd', this);
    }

    // ---- rig + hud ----
    this.rig.group.rotation.y = this.yaw + Math.PI;
    this.rig.animate(dt, {
      speed: this.speed2d,
      state: this.state,
      flying: this.state === 'fly',
      aiming: !!move.aiming && !locked,
      firing: (this.isPlayer ? !!move.shot : !!move.firing),
      hitT: this.hitT,
      ultFiring: this.ultActive > 0,
      aimPitch: this.aimPitch,
      stunned: locked,
      landT: this.landT,
      velY: this.vel.y,
      gliding: this.glide > 0,
      invuln: this.invuln > 0,
      charge: this.isPlayer ? (move.charge || 0) : 0,
    });
    this.rig.blob.position.y = -this.pos.y + gy + 0.06;
    this.rig.blob.material.opacity = clamp(0.85 - (this.pos.y - gy) * 0.07, 0.12, 0.85);
    this.hpBar.position.set(this.pos.x, this.pos.y + 2.35, this.pos.z);
    this.hpBar.material.opacity = this.invuln > 0 && this.isPlayer ? 0.4 + Math.sin(performance.now() * 0.02) * 0.3 : 1;
    this.drawHpBarThrottled(dt);
  }

  onLand(impact, gy, game) {
    const g = new THREE.Vector3(this.pos.x, gy + 0.2, this.pos.z);
    if (impact < -16) {
      this.fx.burst(g, { n: 16, color: 0xcfe0ff, speed: 6, life: 0.5 });
      this.fx.shockwave(new THREE.Vector3(this.pos.x, gy + 0.1, this.pos.z), 0x9fb8dd, 3, 0.35);
      this.audio.explosion(false);
      if (this.isPlayer) game.shake(0.22);
    } else if (impact < -7) {
      this.fx.burst(g, { n: 6, color: 0x9fb8dd, speed: 3, life: 0.3 });
    }
  }

  enterState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }
  drawHpBarThrottled(dt) {
    this._hpT = (this._hpT || 0) - dt;
    if (this._hpT <= 0) { this._hpT = 0.15; this.drawHpBar(); }
  }
  dispose() {
    this.scene.remove(this.rig.group);
    this.scene.remove(this.hpBar);
    this.rig.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
    this.queue.length = 0;
  }
}
