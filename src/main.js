import * as THREE from 'three';
import './style.css';
import { CHARACTERS, CHAR_IDS } from './data.js';
import { audioInit, audioResume, toggleMute, sfx, startMusic } from './audio.js';
import { VFX } from './vfx.js';
import { Fighter } from './fighter.js';
import { buildArena, animateArena } from './arena.js';

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const screens = { menu: $('#screen-menu'), select: $('#screen-select'), fight: $('#screen-fight'), end: $('#screen-end') };
function show(name) { for (const k in screens) screens[k].classList.toggle('active', k === name); }

// ---------- THREE CORE ----------
const canvas = $('#game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080f);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 7, 14);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const vfx = new VFX(scene);
buildArena(scene);

// ---------- STATE ----------
let mode = 'menu';           // menu | select | fight | end
let playerChar = 'phoenix';
let enemyChar = 'chaos';
let combat = null;           // {P, E, timer, over}
let coins = 1250, xp = 12;
let camTrauma = 0;
let orbit = { yaw: 0.35, pitch: 0.42, dist: 13, target: new THREE.Vector3(0, 1.2, 2.5) };
let selectPulse = 0;

// Preview fighters (menu/select vitamin showcase)
const preview = {};
CHAR_IDS.forEach((id, i) => {
  const f = new Fighter(scene, id);
  f.group.position.set([-4.2, 0, 4.2][i], 0.5, 2.5);
  f.group.rotation.y = Math.PI;
  f.setAnim('idle');
  preview[id] = f;
});
function setPreviewVisible(v) { for (const id in preview) preview[id].group.visible = v; }

// ---------- COMBATANT ----------
class Combatant {
  constructor(charId, isPlayer, x, z) {
    this.id = charId; this.def = CHARACTERS[charId]; this.isPlayer = isPlayer;
    this.f = new Fighter(scene, charId);
    this.f.group.position.set(x, 0, z);
    this.maxHp = this.def.hp; this.hp = this.maxHp;
    this.maxEn = 100; this.en = 100;
    this.cds = [0, 0, 0, 0];
    this.facing = 0;
    this.combo = 0; this.comboT = 0; this.comboHits = 0; this.comboTimer = 0;
    this.blocking = false; this.dodgeCD = 0; this.iframes = 0;
    this.st = {}; // burn, shield, rebirth, silence, prison, invis, invisBuff, slow, lift, root, stun, charge, drain, ccImmune, rebirthUsed
    this.ai = { t: 0, strafe: 1, plan: 'chase', planT: 0 };
    this.shellMesh = null; this.bubble = null; this.zoneFx = null;
    this.channel = null; // {kind, t, dur, ...}
    this.dispHp = this.maxHp; this.dispEn = 100;
    this.dead = false;
  }
  get pos() { return this.f.group.position; }
  alive() { return this.hp > 0 && !this.dead; }
  speed() {
    let s = this.def.speed;
    if (this.st.slow) s *= (1 - this.st.slow.amt);
    if (this.st.prison) s *= 0.45;
    if (this.blocking) s *= 0.25;
    return s * this.f.speedMul;
  }
  canAct() {
    return this.alive() && !this.f.busy && !this.st.lift && !this.st.stun && !this.channel && combat && !combat.over;
  }
  spendCost(i) {
    const ab = this.def.abilities[i];
    if (this.en < ab.cost || this.cds[i] > 0) return false;
    if (this.st.silence || this.st.prison) { if (this.isPlayer) toast('Habilidades bloqueadas!'); return false; }
    this.en -= ab.cost; this.cds[i] = ab.cd;
    return true;
  }
  setStatusUI() {}
}

// ---------- HELPERS ----------
function toast(msg, ms = 1800) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  $('#toast-layer').appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 400); }, ms);
}
function flash(text, color = '#fff') {
  const el = $('#center-flash');
  el.textContent = text; el.style.color = color; el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.add('hidden'), 1650);
}
// Flash de tela cheia para impactos grandes (sensação AAA)
function screenFlash(color = 'rgba(255,255,255,.3)', ms = 150) {
  const f = $('#flash'); if (!f) return;
  f.style.transition = 'none'; f.style.background = color; f.style.opacity = '1';
  requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = '0'; });
}
// Streak orientado em espaço de tela (dash / impactos)
function streakBetween(a, b, color, len = 3.5) {
  const pa = a.clone().project(camera), pb = b.clone().project(camera);
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  if (dx * dx + dy * dy < 1e-6) return;
  vfx.streak(a, new THREE.Vector3(dx, dy, 0), { color, len });
}
function dmgNum(worldPos, text, cls = '') {
  const v = worldPos.clone().project(camera);
  if (v.z > 1) return;
  const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
  const d = document.createElement('div');
  d.className = 'dmg-num ' + cls; d.textContent = text;
  d.style.left = (x + (Math.random() - .5) * 40) + 'px'; d.style.top = (y - 20) + 'px';
  $('#dmg-layer').appendChild(d);
  setTimeout(() => d.remove(), 1050);
}
function addCoins(n) {
  coins += n;
  const chip = $('#coin-chip');
  const pop = document.createElement('div'); pop.className = 'reward-pop'; pop.textContent = '+' + n + ' ◉';
  $('#reward-layer').appendChild(pop);
  setTimeout(() => pop.remove(), 2300);
  sfx.coin();
  // tween counter
  const el = $('#coins'); const from = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  const t0 = performance.now();
  const stepFn = (t) => {
    const k = Math.min(1, (t - t0) / 700);
    el.textContent = Math.round(from + (coins - from) * k).toLocaleString('pt-BR');
    if (k < 1) requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
  chip.style.transform = 'scale(1.12)'; setTimeout(() => chip.style.transform = '', 300);
}

// ---------- DAMAGE ----------
function dealDamage(src, dst, amount, { type = 'hit', knock = 0, canBlock = true, isAbility = false } = {}) {
  if (!dst.alive() || combat.over) return 0;
  if (dst.iframes > 0 || dst.st.lift?.inv) { dmgNum(dst.pos, 'ESQUIVA', 'block'); return 0; }
  // facing block check
  let blocked = false;
  if (canBlock && dst.blocking && isFrontal(dst, src.pos)) {
    amount *= 0.35; blocked = true;
  }
  if (dst.st.shield) amount *= (1 - dst.st.shield.reduction);
  if (dst.st.invis && !src.isPlayer) { /* AI chaos: skip */ }
  amount = Math.max(1, Math.round(amount));
  // invisibility damage bonus
  if (src.st.invisBuff) {
    amount = Math.round(amount * 1.5);
    dst.st.stun = { t: 1.2 };
    dst.f.setAnim('stun', 1.0);
    dmgNum(dst.pos, 'EMBOSCADA!', 'crit');
    clearInvis(src);
    delete src.st.invisBuff;
  }
  dst.hp -= amount;
  dst.f.hitFlash = 1;
  if (src.isPlayer) { src.en = Math.min(src.maxEn, src.en + (isAbility ? 4 : 8)); }
  const hp = dst.pos.clone(); hp.y = 2.2;
  dmgNum(hp, blocked ? amount + ' ◈' : amount, blocked ? 'block' : (amount >= 90 ? 'crit' : ''));
  if (blocked) { sfx.block(); vfx.spawn(dst.f.chest(), { color: 0x9fdcff, count: 8, speed: 4, life: .4, size: .3 }); }
  else {
    sfx.hit(dst.id === 'chaos' ? 120 : 180);
    dst.f.setAnim('hit', 0.45);
    vfx.spawn(dst.f.chest(), { color: src.def.color, count: 14, speed: 7, life: .5, size: .4 });
    vfx.shards(dst.f.chest(), { color: src.def.color, count: amount >= 90 ? 10 : 5, speed: 7 });
    if (amount >= 90) {
      const hex = '#' + src.def.color.toString(16).padStart(6, '0');
      screenFlash(hex + '55', 160);
    }
    camTrauma = Math.min(1, camTrauma + amount / 400);
  }
  if (dst.st.shield) vfx.spawn(dst.f.chest(), { color: 0xff6a1f, count: 6, speed: 5, life: .4, size: .35 });
  if (knock > 0) {
    const dir = dst.pos.clone().sub(src.pos).setY(0).normalize();
    dst.pos.addScaledVector(dir, knock);
    clampArena(dst.pos);
  }
  // combo tracking
  if (src.isPlayer) {
    src.comboHits++; src.comboTimer = 2.5;
    const tag = $('#combo-tag');
    if (src.comboHits >= 2) { tag.classList.remove('hidden'); tag.querySelector('b').textContent = 'x' + src.comboHits; clearTimeout(tag._t); tag._t = setTimeout(() => tag.classList.add('hidden'), 2000); }
  }
  // rebirth check
  if (dst.hp <= 0) {
    if (dst.st.rebirth && !dst.st.rebirthUsed) {
      dst.st.rebirthUsed = true;
      dst.hp = Math.round(dst.maxHp * 0.35);
      flash('RENASCIMENTO!', '#ff9d3c'); sfx.rebirth();
      vfx.pillar(dst.pos, { color: 0xffc93c, height: 13, radius: 0.85, dur: 1.1 });
      screenFlash('rgba(255,150,40,.45)', 320);
      vfx.burst(dst.pos.clone().setY(1), 0xff6a1f, true);
      vfx.burst(dst.pos.clone().setY(1), 0xffc93c, true);
      const foe = dst === combat.P ? combat.E : combat.P;
      if (dst.pos.distanceTo(foe.pos) < 8) dealDamage(dst, foe, 120, { type: 'fire', knock: 4, canBlock: true, isAbility: true });
      removeRebirth(dst);
      dmgNum(dst.pos.clone().setY(2.5), '+' + dst.hp + ' ✚', 'heal');
      return amount;
    }
    dst.hp = 0; kill(dst, src);
  }
  return amount;
}
function heal(c, amount) {
  if (!c.alive()) return;
  c.hp = Math.min(c.maxHp, c.hp + Math.round(amount));
  const p = c.pos.clone(); p.y = 2.4;
  dmgNum(p, '+' + Math.round(amount) + ' ✚', 'heal');
  sfx.heal();
  vfx.spawn(c.f.chest(), { color: 0x4ef0a0, count: 12, speed: 3, life: .7, size: .35, up: 4 });
}
function isFrontal(c, fromPos) {
  const fwd = new THREE.Vector3(Math.sin(c.facing), 0, Math.cos(c.facing));
  const to = fromPos.clone().sub(c.pos).setY(0).normalize();
  return fwd.dot(to) > 0.25;
}
function clampArena(p) {
  const r = Math.hypot(p.x, p.z);
  if (r > 11.5) { p.x *= 11.5 / r; p.z *= 11.5 / r; }
}
function kill(dst, src) {
  dst.dead = true;
  dst.f.setAnim('down', 1.4);
  sfx.ko();
  screenFlash('rgba(255,255,255,.5)', 260);
  vfx.pillar(dst.pos, { color: src.def.color, height: 10, radius: 0.6, dur: 0.8 });
  vfx.burst(dst.pos.clone().setY(1), 0xffffff, true);
  vfx.ring(dst.pos, { color: src.def.color, maxR: 8, dur: 0.8 });
  combat.over = true;
  combat.winner = src;
  flash('K.O.!', src.isPlayer ? '#4ef0a0' : '#ff5d5d');
  setTimeout(() => endFight(src.isPlayer), 2100);
}
function clearInvis(c) {
  c.f.invisible = false;
  delete c.st.invis;
}
function removeRebirth(c) { delete c.st.rebirth; }

// ---------- BASIC ATTACK ----------
function basicAttack(c) {
  if (!c.canAct()) return;
  const foe = c === combat.P ? combat.E : combat.P;
  if (!foe.alive()) return;
  const d = c.pos.distanceTo(foe.pos);
  if (d > 3.1) { // whiff: small step-in lunge animation, no slide
    c.f.setAnim('attack', 0.5); c.f.comboStep = c.combo % 3; c.combo = (c.combo + 1) % 3;
    sfx.swing();
    // tiny committed step (root motion, eased)
    const dir = foe.pos.clone().sub(c.pos).setY(0).normalize();
    c.pos.addScaledVector(dir, Math.min(0.7, d - 2.2));
    clampArena(c.pos);
    return;
  }
  c.f.setAnim('attack', 0.55); c.f.comboStep = c.combo % 3;
  const stepIdx = c.combo % 3; c.combo = (c.combo + 1) % 3;
  sfx.swing();
  // strike lands mid-animation (impact feel)
  setTimeout(() => {
    if (combat.over || !c.alive() || !foe.alive()) return;
    const dd = c.pos.distanceTo(foe.pos);
    if (dd > 3.4) return;
    let dmg = c.def.basicDmg * (stepIdx === 2 ? 1.5 : 1) * (0.92 + Math.random() * 0.16);
    // per-character basic flavor
    const col = c.def.color;
    if (c.id === 'phoenix') {
      vfx.spawn(foe.f.chest(), { color: 0xff6a1f, count: 18, speed: 6, life: .6, size: .4 });
      vfx.beam(c.f.palm(), foe.f.chest(), 0xff8a2a, 0.22, 0.18);
      sfx.fire();
    } else if (c.id === 'iw') {
      vfx.ring(foe.pos, { color: 0x4fc3ff, maxR: 3, dur: 0.4 });
      vfx.spawn(foe.f.chest(), { color: 0x9fdcff, count: 12, speed: 5, life: .5, size: .35 });
      sfx.force();
    } else {
      vfx.spawn(foe.f.chest(), { color: 0xff2b5e, count: 20, speed: 8, life: .6, size: .45 });
      vfx.flash(foe.f.chest(), 0xff2b5e, 2.5, 0.2);
      sfx.chaos();
    }
    void col;
    dealDamage(c, foe, dmg, { knock: stepIdx === 2 ? 2.2 : 0.7 });
    if (stepIdx === 2) vfx.ring(foe.pos, { color: c.def.color, maxR: 3.2, dur: 0.4 });
    // micro lunge on connect
    const dir = foe.pos.clone().sub(c.pos).setY(0).normalize();
    c.pos.addScaledVector(dir, 0.35); clampArena(c.pos);
  }, 180);
}

// ---------- ABILITIES ----------
function castAbility(c, i) {
  if (!combat || combat.over || !c.canAct()) return;
  const foe = c === combat.P ? combat.E : combat.P;
  const ab = c.def.abilities[i];
  const dist = c.pos.distanceTo(foe.pos);
  // validation first (no cost on invalid)
  if (c.en < ab.cost) { if (c.isPlayer) toast('Sem energia!'); return; }
  if (c.cds[i] > 0) return;
  if ((c.st.silence || c.st.prison) && i !== undefined) { if (c.isPlayer) toast('Habilidades bloqueadas!'); return; }
  if (ab.range > 0 && dist > ab.range + 1.5) { if (c.isPlayer) toast('Alvo fora de alcance!'); return; }
  if (!c.spendCost(i)) return;
  faceTowards(c, foe.pos);
  const P = () => c.f.palm();
  if (c.id === 'phoenix') {
    if (i === 0) { // Rajada ígnea
      c.f.setAnim('cast', 0.8); sfx.fire();
      vfx.beam(P(), foe.f.chest(), 0xff7a1f, 0.4, 0.32);
      vfx.projectile(P(), foe.f.chest().sub(P()), { color: 0xff6a1f, speed: 26, life: 1.0, size: .8, owner: c, onHit: (t) => {
        dealDamage(c, t, 90, { type: 'fire', isAbility: true });
        t.st.burn = { t: 3, tick: 0 };
        vfx.spawn(t.f.chest(), { color: 0xff6a1f, count: 30, speed: 5, life: 1, size: .5 });
      }});
      setTimeout(() => { if (!foe.st.burn) return; }, 10);
    } else if (i === 1) { // Dreno de vida — cinematic grab
      if (foe.iframes > 0 || foe.st.lift || !foe.alive()) { c.en += ab.cost; c.cds[i] = 1; toast('Alvo protegido!'); return; }
      c.channel = { kind: 'drain', t: 0, dur: 2.2, foe };
      c.channel.funnel = vfx.funnel(c.pos, 0xff6a1f, 2.2);
      vfx.scorch(c.pos, { color: 0xff6a1f, radius: 2.4, dur: 6 });
      foe.channel = { kind: 'drained', t: 0, dur: 2.2, by: c };
      c.f.setAnim('grab', 2.2); foe.f.setAnim('stun', 2.2);
      sfx.fire(); sfx.lift();
      flash('DRENO DE VIDA', '#ff6a1f');
    } else if (i === 2) { // Escudo
      c.f.setAnim('cast', 0.7); sfx.shield();
      c.st.shield = { t: 6, reduction: 0.45 };
      vfx.pillar(c.pos, { color: 0xffc93c, height: 7, radius: 0.5, dur: 0.7 });
      if (c.shellMesh) scene.remove(c.shellMesh);
      c.shellMesh = vfx.shieldShell(c, 0xff6a1f);
      vfx.ring(c.pos, { color: 0xff6a1f, maxR: 4, dur: 0.5 });
    } else { // Renascer
      c.f.setAnim('channel', 1.0); sfx.rebirth();
      c.st.rebirth = { t: 10 }; c.st.rebirthUsed = false;
      vfx.pillar(c.pos, { color: 0xff6a1f, height: 9, radius: 0.55, dur: 0.9 });
      vfx.burst(c.pos.clone().setY(1.2), 0xffc93c, false);
      vfx.ring(c.pos, { color: 0xffc93c, maxR: 6, dur: 0.8 });
      if (c.isPlayer) toast('Fênix: morra nos próximos 10s e renasça!');
    }
  } else if (c.id === 'iw') {
    if (i === 0) { // Sufocamento
      c.f.setAnim('cast', 0.8); sfx.force();
      const head = foe.f.headPos();
      vfx.ring(head, { color: 0x9fdcff, maxR: 2.2, dur: 0.8 });
      vfx.spawn(head, { color: 0xbfeaff, count: 22, speed: 3, life: .9, size: .35 });
      dealDamage(c, foe, 60, { type: 'force', isAbility: true });
      foe.st.silence = { t: 2 };
      foe.en = Math.max(0, foe.en - 25);
      foe.f.setAnim('stun', 0.8);
      dmgNum(head, 'SILÊNCIO', 'block');
    } else if (i === 1) { // Barreira projetada
      c.f.setAnim('cast', 0.8); sfx.force();
      const dir = foe.pos.clone().sub(c.pos).setY(0).normalize();
      const start = P(); start.y = 1.2;
      vfx.projectile(start, dir, { color: 0x4fc3ff, coreColor: 0xdff6ff, speed: 18, life: 1.4, size: 1.4, radius: 1.3, owner: c, onHit: (t) => {
        dealDamage(c, t, 80, { type: 'force', knock: 4.5, isAbility: true });
        if (!t.st.ccImmune) { t.st.root = { t: 0.8 }; }
        vfx.ring(t.pos, { color: 0x4fc3ff, maxR: 4, dur: 0.5 });
      }});
    } else if (i === 2) { // Prisão
      c.f.setAnim('cast', 0.8); sfx.prison();
      if (foe.st.ccImmune) { if (c.isPlayer) toast('Alvo imune a controle!'); }
      else {
        foe.st.prison = { t: 3 };
        foe.bubble = vfx.bubble(foe.f, 0x4fc3ff, 3);
        vfx.ring(foe.pos, { color: 0x4fc3ff, maxR: 3.5, dur: 0.6 });
        dmgNum(foe.pos.clone().setY(2.6), 'PRISÃO', 'block');
      }
      dealDamage(c, foe, 30, { type: 'force', isAbility: true });
    } else { // Invisibilidade
      c.f.setAnim('cast', 0.6); sfx.invis();
      c.f.invisible = true;
      c.st.invis = { t: 4 }; c.st.invisBuff = { t: 6 };
      vfx.spawn(c.pos.clone().setY(1.2), { color: 0x9fdcff, count: 26, speed: 3, life: .8, size: .4 });
      if (c.isPlayer) toast('Invisível! Próximo ataque +50% e atordoa.');
    }
  } else { // chaos
    if (i === 0) {
      c.f.setAnim('cast', 0.8); sfx.chaos();
      const start = P();
      const dir = foe.f.chest().sub(start);
      vfx.beam(start, foe.f.chest(), 0xff2b5e, 0.3, 0.3);
      vfx.projectile(start, dir, { color: 0xff2b5e, coreColor: 0xffd0dd, speed: 24, life: 1.2, size: .9, owner: c, onHit: (t) => {
        dealDamage(c, t, 100, { type: 'chaos', knock: 1.5, isAbility: true });
        vfx.spawn(t.f.chest(), { color: 0xff2b5e, count: 26, speed: 8, life: .7, size: .5 });
        vfx.spawn(t.f.chest(), { color: 0x111111, count: 12, speed: 5, life: .8, size: .5 });
      }});
    } else if (i === 1) { // Telecinese
      if (foe.st.ccImmune || foe.iframes > 0 || !foe.alive()) { if (c.isPlayer) toast('Alvo protegido!'); c.en += ab.cost; c.cds[i] = 1; return; }
      c.f.setAnim('channel', 1.6); sfx.lift();
      foe.st.lift = { t: 1.2, inv: true };
      foe.f.setAnim('lift', 1.2);
      vfx.pillar(foe.pos, { color: 0xff2b5e, height: 8, radius: 0.5, dur: 1.1 });
      vfx.spawn(foe.pos.clone().setY(1), { color: 0xff2b5e, count: 30, speed: 4, life: 1, size: .45, up: 6 });
      vfx.ring(foe.pos, { color: 0xff2b5e, maxR: 4, dur: 0.7 });
      foe._slamBy = c;
      setTimeout(() => {
        if (!foe.alive() || combat.over) return;
        delete foe.st.lift;
        foe.st.ccImmune = { t: 3 };
        const dir = foe.pos.clone().sub(c.pos).setY(0).normalize();
        foe.pos.addScaledVector(dir, 5); clampArena(foe.pos);
        foe.f.setAnim('hit', 0.5);
        sfx.slam();
        vfx.burst(foe.pos.clone().setY(0.5), 0xff2b5e, true);
        vfx.scorch(foe.pos, { color: 0xff2b5e, radius: 2, dur: 5 });
        dealDamage(c, foe, 90, { type: 'chaos', isAbility: true, canBlock: false });
      }, 1200);
    } else if (i === 2) { // Zona de distorção
      c.f.setAnim('cast', 0.8); sfx.chaos();
      foe.st.slow = { t: 5, amt: 0.45, zone: true };
      if (foe.zoneFx) vfx.removeZone(foe.zoneFx);
      const zfx = vfx.distortionZone(foe.pos, 3.2, 0xff2b5e, 5);
      foe.zoneFx = zfx;
      zfx.target = foe.f;
      vfx.ring(foe.pos, { color: 0xff2b5e, maxR: 5, dur: 0.6 });
      if (c.isPlayer) toast('Espaço deformado: alvo lento por 5s!');
    } else { // Colapso
      c.f.setAnim('channel', 1.2); sfx.collapse();
      c.st.charge = { t: 1.0, fx: null };
      vfx.pillar(c.pos, { color: 0xff2b5e, height: 11, radius: 0.7, dur: 1.0 });
      vfx.ring(c.pos, { color: 0xff2b5e, maxR: 7, dur: 1.0 });
      const ch = c.pos.clone().setY(1.2);
      vfx.spawn(ch, { color: 0xff2b5e, count: 40, speed: 3, life: 1, size: .6 });
      setTimeout(() => {
        if (!c.alive() || combat.over) return;
        delete c.st.charge;
        sfx.slam(); sfx.chaos();
        screenFlash('rgba(255,43,94,.4)', 300);
        vfx.burst(c.pos.clone().setY(1), 0xff2b5e, true);
        vfx.burst(c.pos.clone().setY(1), 0xffffff, false);
        camTrauma = 1;
        const d = c.pos.distanceTo(foe.pos);
        if (d < 9 && foe.alive()) {
          dealDamage(c, foe, 150, { type: 'chaos', knock: 6, canBlock: true, isAbility: true });
          if (!foe.st.ccImmune) foe.st.stun = { t: 0.8 };
        }
      }, 1000);
    }
  }
}
function faceTowards(c, p) {
  c.facing = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
  c.f.group.rotation.y = c.facing;
}

// ---------- INPUT ----------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  audioResume();
  if (mode !== 'fight' || !combat || combat.over) return;
  const P = combat.P;
  if (e.code === 'Space') { doDodge(P); e.preventDefault(); }
  if (e.code === 'KeyJ') basicAttack(P);
  if (e.code === 'KeyK') P.blocking = true;
  if (e.code === 'Digit1') castAbility(P, 0);
  if (e.code === 'Digit2') castAbility(P, 1);
  if (e.code === 'Digit3') castAbility(P, 2);
  if (e.code === 'Digit4') castAbility(P, 3);
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (combat && e.code === 'KeyK') combat.P.blocking = false;
});
canvas.addEventListener('mousedown', (e) => {
  audioResume();
  if (mode === 'fight' && combat && !combat.over) { if (e.button === 0) basicAttack(combat.P); }
  else { orbit._drag = { x: e.clientX, y: e.clientY }; }
});
addEventListener('mousemove', (e) => {
  if (orbit._drag) {
    orbit.yaw -= (e.movementX || 0) * 0.008;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.movementY || 0) * 0.005, 0.15, 1.1);
  }
});
addEventListener('mouseup', () => orbit._drag = null);
canvas.addEventListener('wheel', (e) => { orbit.dist = THREE.MathUtils.clamp(orbit.dist + e.deltaY * 0.01, 7, 22); }, { passive: true });

function doDodge(c) {
  if (!c.alive() || c.dodgeCD > 0 || c.en < 20 || c.st.lift || c.channel) return;
  if (c.st.slow?.zone) { /* dodge window penalty handled in iframes */ }
  c.en -= 20; c.dodgeCD = 1.2;
  const pen = c.st.slow ? 0.5 : 1;
  c.iframes = 0.32 * pen;
  c.f.setAnim('dash', 0.35);
  sfx.dash();
  let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let dz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  // camera-relative
  const yaw = Math.atan2(camera.position.x - c.pos.x, camera.position.z - c.pos.z);
  let mx = 0, mz = 0;
  if (dx || dz) {
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    mx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    mz = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  } else { mx = -Math.sin(c.facing) * -1; mz = -Math.cos(c.facing) * -1; const f = c === combat.P ? combat.E : combat.P; const d = c.pos.clone().sub(f.pos).setY(0).normalize(); mx = d.x; mz = d.z; }
  const from = c.pos.clone().setY(1);
  c.pos.x += mx * 4.2; c.pos.z += mz * 4.2;
  clampArena(c.pos);
  streakBetween(from, c.pos.clone().setY(1), c.def.color, 4);
  vfx.spawn(c.pos.clone().setY(1), { color: c.def.color, count: 14, speed: 4, life: .4, size: .35 });
  // separation
  const foe = c === combat.P ? combat.E : combat.P;
  if (c.pos.distanceTo(foe.pos) < 1.2) { c.pos.addScaledVector(c.pos.clone().sub(foe.pos).setY(0).normalize(), 0.4); clampArena(c.pos); }
}

// ---------- TOUCH (mobile) ----------
const touch = { mx: 0, mz: 0 };
if (('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer:coarse)').matches)) {
  document.body.classList.add('touch');
}
function setupTouch() {
  const zone = $('#joy-zone'), knob = $('#joy-knob');
  if (!zone) return;
  let joyId = null, cx = 0, cy = 0;
  const R = 52;
  zone.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    audioResume(); e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    touch.mx = dx; touch.mz = dy;
    knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
    e.preventDefault();
  });
  const end = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; touch.mx = 0; touch.mz = 0;
    knob.style.transform = 'translate(0,0)';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  const hold = (id, down, up) => {
    const el = $(id); if (!el) return;
    el.addEventListener('pointerdown', (e) => { audioResume(); down(); e.preventDefault(); });
    if (up) { el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); }
  };
  hold('#tb-atk', () => { if (combat && !combat.over) basicAttack(combat.P); });
  hold('#tb-dodge', () => { if (combat && !combat.over) doDodge(combat.P); });
  hold('#tb-block', () => { if (combat) combat.P.blocking = true; }, () => { if (combat) combat.P.blocking = false; });
  for (let i = 0; i < 4; i++) hold('#tb-a' + i, () => { if (combat && !combat.over) castAbility(combat.P, i); });
}
setupTouch();

// ---------- AI ----------
function aiControl(E, dt) {
  if (!E.alive() || combat.over || E.channel || E.st.lift || E.st.stun) return;
  const P = combat.P;
  const d = E.pos.distanceTo(P.pos);
  E.ai.t -= dt; E.ai.planT -= dt;
  // player invisible: wander to last known
  const target = P.f.invisible ? (E.ai.lastKnown || P.pos) : P.pos.clone();
  if (!P.f.invisible) E.ai.lastKnown = P.pos.clone();
  if (E.ai.planT <= 0) {
    E.ai.planT = 1.2 + Math.random() * 1.5;
    const r = Math.random();
    E.ai.plan = d > 9 ? 'chase' : r < 0.55 ? 'strafe' : r < 0.8 ? 'chase' : 'retreat';
    E.ai.strafe = Math.random() < 0.5 ? -1 : 1;
    // AI ability usage
    for (let i = 3; i >= 0; i--) {
      const ab = E.def.abilities[i];
      if (E.cds[i] <= 0 && E.en >= ab.cost && !(E.st.silence || E.st.prison)) {
        const inRange = ab.range === 0 || d <= ab.range;
        if (inRange && Math.random() < (i === 3 ? 0.35 : 0.5)) { castAbility(E, i); return; }
      }
    }
  }
  faceTowards(E, P.pos);
  E.blocking = false;
  // reactive block/dodge
  if (d < 5 && Math.random() < dt * 1.2) E.blocking = true;
  if (E.ai.plan === 'chase' && d > 2.4) moveFighter(E, target, dt);
  else if (E.ai.plan === 'retreat') moveFighter(E, E.pos.clone().multiplyScalar(1.2), dt);
  else if (E.ai.plan === 'strafe') {
    const ang = Math.atan2(E.pos.x, E.pos.z) + E.ai.strafe * dt * 1.2;
    const r = Math.max(4, Math.min(10, Math.hypot(E.pos.x, E.pos.z)));
    moveFighter(E, new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r), dt);
  }
  if (d < 2.9 && E.ai.t <= 0) { E.ai.t = 0.9 + Math.random() * 0.9; basicAttack(E); }
  if (d < 4 && Math.random() < dt * 0.25 && E.en >= 20) doDodgeAI(E);
}
function doDodgeAI(E) {
  E.en -= 20; E.dodgeCD = 1.2; E.iframes = 0.32;
  E.f.setAnim('dash', 0.35);
  const a = Math.random() * Math.PI * 2;
  E.pos.x += Math.sin(a) * 3.5; E.pos.z += Math.cos(a) * 3.5;
  clampArena(E.pos);
}
function moveFighter(c, target, dt) {
  if (c.blocking || c.f.busy || c.channel || c.st.lift || c.st.root || c.st.stun) return false;
  const dir = target.clone().sub(c.pos); dir.y = 0;
  const d = dir.length();
  if (d < 0.15) return false;
  dir.normalize();
  const step = Math.min(d, c.speed() * dt);
  c.pos.addScaledVector(dir, step);
  clampArena(c.pos);
  c._moving = true;
  return true;
}

// ---------- FIGHT LIFECYCLE ----------
function startFight() {
  if (combat) {
    for (const c of [combat.P, combat.E]) {
      scene.remove(c.f.group);
      if (c.shellMesh) scene.remove(c.shellMesh);
      if (c.bubble) scene.remove(c.bubble.grp);
      if (c.zoneFx) vfx.removeZone(c.zoneFx);
    }
  }
  vfx.clearDynamic();
  setPreviewVisible(false);
  const P = new Combatant(playerChar, true, -4, 0);
  const E = new Combatant(enemyChar, false, 4, 0);
  P.facing = Math.PI / 2; E.facing = -Math.PI / 2;
  P.f.group.rotation.y = P.facing; E.f.group.rotation.y = E.facing;
  P.f.setAnim('entrance', 1.2); E.f.setAnim('entrance', 1.2);
  combat = { P, E, timer: 99, over: false, winner: null, t: 0 };
  buildAbilityBar();
  $('#hud-name-p').innerHTML = P.def.name + ' <span>VOCÊ</span>';
  $('#hud-name-e').innerHTML = E.def.name + ' <span>CPU</span>';
  show('fight');
  mode = 'fight';
  flash('LUTEM!', '#27e0ff');
  sfx.select();
  startMusic();
}
function endFight(playerWon) {
  mode = 'end';
  const w = combat.winner;
  if (w) w.f.setAnim('win', 2.5);
  setTimeout(() => {
    show('end');
    $('#end-kicker').textContent = playerWon ? 'VITÓRIA' : 'DERROTA';
    $('#end-kicker').style.color = playerWon ? '#4ef0a0' : '#ff5d5d';
    $('#end-title').textContent = playerWon ? w.def.name + ' VENCEU' : 'CPU VENCEU COM ' + w.def.name;
    const t = Math.round(combat.t);
    $('#end-sub').textContent = `Duelo de ${t}s • HP restante ${Math.max(0, Math.round(w.hp))}/${w.maxHp}`;
    const box = $('#end-rewards'); box.innerHTML = '';
    if (playerWon) {
      const c = 220 + Math.floor(Math.random() * 160), x = 40 + Math.floor(Math.random() * 40);
      for (const [txt] of [[`+${c} ◉ coins`], [`+${x} ✦ xp`]]) {
        const d = document.createElement('div'); d.className = 'rw'; d.textContent = txt; box.appendChild(d);
      }
      addCoins(c);
    } else {
      const d = document.createElement('div'); d.className = 'rw'; d.textContent = '+60 ◉ consolação'; box.appendChild(d);
      addCoins(60);
    }
  }, 600);
}
function quitToSelect() {
  if (combat) { scene.remove(combat.P.f.group); scene.remove(combat.E.f.group); if (combat.P.shellMesh) scene.remove(combat.P.shellMesh); if (combat.E.shellMesh) scene.remove(combat.E.shellMesh); combat = null; }
  vfx.clearDynamic();
  setPreviewVisible(true);
  pickOpponent(true);
  refreshDetail();
  show('select'); mode = 'select';
}

// ---------- HUD ----------
function buildAbilityBar() {
  const bar = $('#abilities-bar'); bar.innerHTML = '';
  combat.P.def.abilities.forEach((ab, i) => {
    const d = document.createElement('div');
    d.className = 'slot ready'; d.id = 'slot' + i;
    d.innerHTML = `<span class="s-key">${ab.key}</span><span class="s-ico">${ab.icon}</span><span class="s-nm">${ab.name}</span><span class="s-cost">◈${ab.cost} • ${ab.cd}s</span><div class="cd-sweep"></div><div class="s-cd" style="display:none"></div>`;
    d.title = ab.desc;
    d.onclick = () => { audioResume(); castAbility(combat.P, i); };
    bar.appendChild(d);
    const tb = $('#tb-a' + i);
    if (tb) { tb.textContent = ab.icon; tb.title = `${ab.name} — ${ab.desc}`; }
  });
}
function updateHUD() {
  if (!combat) return;
  const { P, E } = combat;
  for (const [c, s] of [[P, 'p'], [E, 'e']]) {
    c.dispHp += (c.hp - c.dispHp) * 0.12;
    c.dispEn += (c.en - c.dispEn) * 0.15;
    const hpF = $('#hp-' + s), gh = $('#hp-' + s + '-ghost');
    const pct = Math.max(0, Math.min(100, c.hp / c.maxHp * 100)), dpct = Math.max(0, Math.min(100, c.dispHp / c.maxHp * 100));
    hpF.style.width = pct + '%'; gh.style.width = dpct + '%';
    hpF.parentElement.classList.toggle('low', pct < 30);
    $('#hp-' + s + '-num').textContent = Math.max(0, Math.ceil(c.hp));
    $('#en-' + s).style.width = (c.en) + '%';
    $('#en-' + s + '-num').textContent = Math.floor(c.en);
    // statuses
    const row = $('#status-' + s); row.innerHTML = '';
    const chips = [];
    if (c.st.burn) chips.push(['QUEIMANDO', '#ff6a1f']);
    if (c.st.shield) chips.push(['ESCUDO', '#ffc93c']);
    if (c.st.rebirth && !c.st.rebirthUsed) chips.push(['FÊNIX ✦', '#ff9d3c']);
    if (c.st.silence) chips.push(['SILÊNCIO', '#9aa3c0']);
    if (c.st.prison) chips.push(['PRISÃO', '#4fc3ff']);
    if (c.st.invis) chips.push(['INVISÍVEL', '#bfeaff']);
    if (c.st.slow) chips.push(['LENTO', '#ff2b5e']);
    if (c.st.stun) chips.push(['ATORDOADO', '#ffd75e']);
    if (c.st.lift) chips.push(['LEVITANDO', '#ff2b5e']);
    if (c.st.ccImmune) chips.push(['IMUNE', '#4ef0a0']);
    for (const [t, col] of chips) {
      const s2 = document.createElement('span'); s2.className = 'st-chip'; s2.textContent = t; s2.style.borderColor = col; s2.style.color = col;
      row.appendChild(s2);
    }
  }
  // cooldown slots
  P.def.abilities.forEach((ab, i) => {
    const el = $('#slot' + i); if (!el) return;
    const cd = P.cds[i];
    const cdEl = el.querySelector('.s-cd'), sweep = el.querySelector('.cd-sweep');
    el.classList.toggle('oncd', cd > 0);
    el.classList.toggle('nrg', P.en < ab.cost);
    el.classList.toggle('ready', cd <= 0 && P.en >= ab.cost);
    if (cd > 0) { cdEl.style.display = 'grid'; cdEl.textContent = Math.ceil(cd); sweep.style.height = (cd / ab.cd * 100) + '%'; }
    else { cdEl.style.display = 'none'; sweep.style.height = '0'; }
    const tb = $('#tb-a' + i);
    if (tb) tb.style.opacity = (cd > 0 || P.en < ab.cost) ? 0.4 : 1;
  });
  $('#timer').textContent = Math.max(0, Math.ceil(combat.timer));
}

// ---------- SELECT UI ----------
function pickOpponent(force = false) {
  const others = CHAR_IDS.filter((c) => c !== playerChar);
  if (force || enemyChar === playerChar) enemyChar = others[Math.floor(Math.random() * others.length)];
  $('#opp-name').textContent = CHARACTERS[enemyChar].name;
}
function refreshDetail() {
  const d = CHARACTERS[playerChar];
  document.querySelectorAll('.char-card').forEach((c) => c.classList.toggle('selected', c.dataset.char === playerChar));
  $('#detail-name').textContent = d.name;
  $('#detail-name').style.color = d.accent;
  $('#detail-desc').textContent = d.desc;
  $('#detail-stats').innerHTML = Object.entries(d.stats).map(([k, v]) =>
    `<div class="stat"><small>${k.toUpperCase()}</small><div class="sbar"><i style="width:${v}%"></i></div></div>`).join('');
  $('#detail-abilities').innerHTML = d.abilities.map((a) =>
    `<div class="ab-card"><div class="ab-ico" style="background:${d.accent}22;border:1px solid ${d.accent}">${a.icon}</div><div><b>${a.key} • ${a.name}<small>◈${a.cost} ${a.cd}s</small></b><p>${a.desc}</p></div></div>`).join('');
  // preview reaction: signature anim + puff
  const f = preview[playerChar];
  if (f) {
    f.setAnim('cast', 0.9);
    vfx.spawn(f.group.position.clone().setY(1.5), { color: d.color, count: 20, speed: 4, life: .7, size: .4 });
    sfx.select();
  }
}

// ---------- WIRING ----------
$('#btn-play').onclick = () => { audioResume(); audioInit(); sfx.ui(); pickOpponent(true); refreshDetail(); show('select'); mode = 'select'; };
$('#btn-how').onclick = () => { sfx.ui(); $('#help-modal').classList.remove('hidden'); };
$('#btn-close-help').onclick = () => { sfx.ui(); $('#help-modal').classList.add('hidden'); };
$('#btn-help').onclick = () => { sfx.ui(); $('#help-modal').classList.remove('hidden'); };
$('#btn-mute').onclick = (e) => { audioInit(); const m = toggleMute(); e.target.textContent = m ? '✕' : '♪'; e.target.style.opacity = m ? .5 : 1; };
$('#btn-back-menu').onclick = () => { sfx.ui(); show('menu'); mode = 'menu'; };
$('#btn-fight').onclick = () => { audioResume(); startFight(); };
$('#btn-quit').onclick = () => { sfx.ui(); quitToSelect(); };
$('#btn-rematch').onclick = () => { sfx.ui(); startFight(); };
$('#btn-change').onclick = () => { sfx.ui(); quitToSelect(); };
$('#btn-reroll').onclick = () => { sfx.ui(); pickOpponent(true); };
document.querySelectorAll('.char-card').forEach((c) => {
  c.onclick = () => { playerChar = c.dataset.char; if (enemyChar === playerChar) pickOpponent(true); refreshDetail(); };
  c.onmouseenter = () => { if (c.dataset.char !== playerChar) { const f = preview[c.dataset.char]; if (f && mode === 'select') f.setAnim('attack', 0.55); } };
});

// ---------- MAIN LOOP ----------
const clock = new THREE.Clock();
function tickStatus(c, dt) {
  const s = c.st;
  for (let i = 0; i < 4; i++) c.cds[i] = Math.max(0, c.cds[i] - dt);
  c.dodgeCD = Math.max(0, c.dodgeCD - dt);
  c.iframes = Math.max(0, c.iframes - dt);
  c.en = Math.min(c.maxEn, c.en + dt * 10);
  c.comboTimer -= dt; if (c.comboTimer <= 0) c.comboHits = 0;
  if (s.burn) {
    s.burn.t -= dt; s.burn.tick -= dt;
    if (s.burn.tick <= 0) {
      s.burn.tick = 0.5;
      c.hp -= 8;
      vfx.embers(c.f.chest(), 0xff6a1f, 4);
      sfx.burn();
      const p = c.pos.clone(); p.y = 2.3; dmgNum(p, '12 🔥', '');
      if (c.hp <= 0) { c.hp = 0; const foe = c === combat.P ? combat.E : combat.P; kill(c, foe); return; }
    }
    if (s.burn.t <= 0) delete s.burn;
  }
  if (s.shield) { s.shield.t -= dt; if (c.shellMesh) { c.shellMesh.position.copy(c.pos).setY(1.1); c.shellMesh.material.opacity = 0.22 + Math.sin(performance.now() * 0.008) * 0.08; } if (s.shield.t <= 0) { delete s.shield; if (c.shellMesh) { scene.remove(c.shellMesh); c.shellMesh = null; } } }
  if (s.rebirth) { s.rebirth.t -= dt; if (s.rebirth.t <= 0) removeRebirth(c); }
  if (s.silence) { s.silence.t -= dt; if (s.silence.t <= 0) delete s.silence; }
  if (s.prison) {
    s.prison.t -= dt;
    if (c.bubble) { c.bubble.grp.position.copy(c.pos).setY(1.1); }
    if (s.prison.t <= 0) { delete s.prison; s.ccImmune = { t: 3 }; if (c.bubble) { scene.remove(c.bubble.grp); c.bubble = null; } }
  }
  if (s.invis) {
    s.invis.t -= dt;
    if (Math.random() < dt * 6) vfx.spawn(c.pos.clone().setY(1.2), { color: 0x9fdcff, count: 2, speed: 1, life: .5, size: .3 });
    if (s.invis.t <= 0) clearInvis(c);
  }
  if (s.invisBuff) { s.invisBuff.t -= dt; if (s.invisBuff.t <= 0) { delete s.invisBuff; if (!s.invis) clearInvis(c); } }
  if (s.slow) { s.slow.t -= dt; if (c.zoneFx) { c.zoneFx.grp.position.set(c.pos.x, 0, c.pos.z); } if (s.slow.t <= 0) { delete s.slow; if (c.zoneFx) { vfx.removeZone(c.zoneFx); c.zoneFx = null; } } }
  if (s.stun) { s.stun.t -= dt; if (s.stun.t <= 0) { delete s.stun; s.ccImmune = { t: 2 }; } }
  if (s.root) { s.root.t -= dt; if (s.root.t <= 0) { delete s.root; s.ccImmune = { t: 2 }; } }
  if (s.ccImmune) { s.ccImmune.t -= dt; if (s.ccImmune.t <= 0) delete s.ccImmune; }
  // drain channel progression
  if (c.channel?.kind === 'drain') {
    const ch = c.channel; ch.t += dt;
    const foe = ch.foe;
    // pull together to center-ish
    const mid = c.pos.clone().add(foe.pos).multiplyScalar(0.5);
    c.pos.lerp(mid, Math.min(1, dt * 3)); foe.pos.lerp(mid, Math.min(1, dt * 4));
    if (ch.funnel) ch.funnel.grp.position.set(mid.x, 0, mid.z);
    if (!ch.nextTick) ch.nextTick = 0.4;
    ch.nextTick -= dt;
    if (ch.nextTick <= 0) {
      ch.nextTick = 0.5;
      vfx.spawn(foe.f.chest(), { color: 0xff2b1a, count: 16, speed: 5, life: .5, size: .4 });
      vfx.spawn(c.f.chest(), { color: 0xffc93c, count: 10, speed: 3, life: .5, size: .35 });
      vfx.ring(c.pos, { color: 0xff6a1f, maxR: 3.5, dur: 0.5 });
      const dealt = dealDamage(c, foe, 30, { type: 'fire', canBlock: false, isAbility: true });
      heal(c, dealt * 0.5);
    }
    if (ch.t >= ch.dur) { c.channel = null; if (foe.channel?.kind === 'drained') foe.channel = null; }
  }
}
function updateProjectiles(dt) {
  for (let i = vfx.projectiles.length - 1; i >= 0; i--) {
    const pr = vfx.projectiles[i];
    pr.life -= dt;
    pr.mesh.position.addScaledVector(pr.vel, dt);
    const p = pr.mesh.position;
    let dead = pr.life <= 0 || Math.hypot(p.x, p.z) > 16 || p.y < 0 || p.y > 8;
    if (!dead && combat) {
      for (const t of [combat.P, combat.E]) {
        if (t === pr.owner || !t.alive()) continue;
        const tp = t.pos.clone(); tp.y = 1.2;
        if (pr.mesh.position.distanceTo(tp) < pr.radius + 0.9) {
          vfx.burst(tp, pr.color, false);
          pr.onHit?.(t);
          dead = true; break;
        }
      }
    }
    if (dead) vfx.killProjectile(pr);
  }
}
function updateCamera(dt) {
  const aspectComp = THREE.MathUtils.clamp(1.25 / camera.aspect, 1, 1.5);
  const wantFov = camera.aspect < 0.85 ? 70 : 55;
  if (Math.abs(camera.fov - wantFov) > 0.1) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  if (mode === 'fight' && combat) {
    const { P, E } = combat;
    const mid = P.pos.clone().add(E.pos).multiplyScalar(0.5);
    const dist = P.pos.distanceTo(E.pos);
    // retrato: sobe mais do que afasta (evita entrar nos pilones do anel)
    const yK = 1 + (aspectComp - 1) * 1.7, zK = 1 + (aspectComp - 1) * 0.65;
    camera.position.lerp(new THREE.Vector3(mid.x * 0.5, (6.2 + dist * 0.3) * yK, mid.z * 0.35 + (10 + dist * 0.45) * zK), Math.min(1, dt * 3));
    const look = mid.clone(); look.y = 1.3;
    // shake
    camTrauma = Math.max(0, camTrauma - dt * 2);
    const sh = camTrauma * camTrauma * 0.5;
    look.x += (Math.random() - .5) * sh; look.y += (Math.random() - .5) * sh;
    camera.lookAt(look);
  } else {
    // menu/select orbit around pedestals
    const t = performance.now() * 0.00012;
    const yaw = orbit.yaw + (mode === 'menu' ? t * 2 : 0);
    const cx = orbit.target.x + Math.sin(yaw) * orbit.dist * Math.cos(orbit.pitch);
    const cz = orbit.target.z + Math.cos(yaw) * orbit.dist * Math.cos(orbit.pitch);
    const cy = orbit.target.y + Math.sin(orbit.pitch) * orbit.dist;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.06);
    camera.lookAt(orbit.target);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;
  animateArena(time);
  vfx.update(dt, time);
  // ambient embers on platform
  if (Math.random() < dt * 8) {
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 9;
    vfx.embers(new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r), [0x7c5cff, 0x27e0ff, 0xff6a1f][Math.floor(Math.random() * 3)], 1);
  }
  if (mode === 'fight' && combat) {
    const { P, E } = combat;
    combat.t += dt;
    if (!combat.over) {
      combat.timer -= dt;
      if (combat.timer <= 0) {
        combat.timer = 0; combat.over = true;
        const w = P.hp >= E.hp ? P : E;
        combat.winner = w;
        flash('TEMPO!', '#ffd75e');
        kill(w === P ? E : P, w);
        combat.over = true;
      }
    }
    // player movement
    P._moving = false;
    if (P.canAct() && !P.blocking) {
      let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.mx;
      let dz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + touch.mz;
      const il = Math.hypot(dx, dz);
      if (il > 1) { dx /= il; dz /= il; }
      if (il > 0.15) {
        const yaw = Math.atan2(camera.position.x - P.pos.x, camera.position.z - P.pos.z);
        const l = Math.hypot(dx, dz); dx /= l; dz /= l;
        const mx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
        const mz = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const tgt = P.pos.clone().add(new THREE.Vector3(mx, 0, mz).multiplyScalar(3));
        P._moving = moveFighter(P, tgt, dt);
      }
      if (!E.dead) faceTowards(P, E.pos);
    }
    if (!E.dead) { E._moving = false; aiControl(E, dt); if (!E.f.busy) faceTowards(E, P.pos); }
    // separation
    const d = P.pos.distanceTo(E.pos);
    if (d < 1.3 && d > 0.01 && P.alive() && E.alive()) {
      const push = P.pos.clone().sub(E.pos).setY(0).normalize().multiplyScalar((1.3 - d) * 0.5);
      P.pos.add(push); E.pos.sub(push);
      clampArena(P.pos); clampArena(E.pos);
    }
    tickStatus(P, dt); tickStatus(E, dt);
    P.f.update(dt, time, P._moving);
    E.f.update(dt, time, E._moving);
    // invis shimmer handled in tick; phoenix idle flames
    if (P.id === 'phoenix' && Math.random() < dt * 10) vfx.embers(P.f.chest(), 0xff6a1f, 1);
    if (E.id === 'phoenix' && Math.random() < dt * 10) vfx.embers(E.f.chest(), 0xff6a1f, 1);
    updateProjectiles(dt);
    updateHUD();
  } else {
    // preview idle/showcase
    selectPulse += dt;
    CHAR_IDS.forEach((id) => {
      const f = preview[id];
      f.group.visible = true;
      const sel = id === playerChar && mode === 'select';
      const base = new THREE.Vector3([-4.2, 0, 4.2][CHAR_IDS.indexOf(id)], 0.5, 2.5);
      f.group.position.lerp(base.clone().add(new THREE.Vector3(0, sel ? Math.sin(selectPulse * 3) * 0.08 + 0.15 : 0, sel ? -0.8 : 0)), 0.08);
      const s = sel ? 1.12 : 1;
      f.group.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
      f.update(dt, time, false);
      if (id === 'phoenix' && Math.random() < dt * 6) vfx.embers(f.group.position.clone().setY(1.8), 0xff6a1f, 1);
      if (id === 'chaos' && Math.random() < dt * 4) vfx.embers(f.group.position.clone().setY(1.5), 0xff2b5e, 1);
      if (id === 'iw' && Math.random() < dt * 3) vfx.spawn(f.group.position.clone().setY(1.2), { color: 0x4fc3ff, count: 1, speed: 1, life: .6, size: .3 });
    });
    if (combat) { /* hidden fighters */ }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}
show('menu');
refreshDetail();
pickOpponent(true);
animate();

// expose for automated verification
window.__game = {
  get mode() { return mode; },
  get combat() { return combat; },
  chars: CHARACTERS,
  startFight, castAbility, basicAttack,
  select(c) { playerChar = c; refreshDetail(); },
  state() {
    if (!combat) return { mode };
    return { mode, php: combat.P.hp, ehp: combat.E.hp, pen: combat.P.en, timer: combat.timer, over: combat.over };
  }
};
