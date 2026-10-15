// NOVA STRIKE — game orchestration: init, match flow, input mapping,
// hit-stop, charge attacks, fullscreen/landscape, adaptive quality.
import * as THREE from 'three';
import { Config, HEROES, BOT_NAMES, QualityTiers, pickQuality } from './core/config.js';
import { Input } from './core/input.js';
import { GameAudio } from './core/audio.js';
import { FollowCamera } from './core/camera.js';
import { Arena } from './world/arena.js';
import { Character } from './heroes/character.js';
import { Projectiles } from './combat/projectiles.js';
import { FX } from './combat/fx.js';
import { Bot } from './ai/bots.js';
import { HUD } from './ui/hud.js';
import { Settings } from './core/settings.js';

const hud = new HUD();
const settings = new Settings();
settings.apply();
if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) document.body.classList.add('touch');

// ---------- renderer ----------
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);

let qualityTier = 'high';
function applyQuality(tier) {
  qualityTier = tier;
  const q = QualityTiers[tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (arena) arena.setShadows(q.shadows);
  if (fx) fx.q = q.particles;
  onResize();
}
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));

// ---------- world ----------
const arena = new Arena(scene);
arena.build();
const fx = new FX(scene, 1.0);
const audio = new GameAudio();
const input = new Input(settings);
input.attach(renderer.domElement, hud.el);
const followCam = new FollowCamera(camera, arena);
const proj = new Projectiles(scene, fx, audio);
applyQuality(pickQuality());
onResize();

// ---------- fullscreen / orientation ----------
const mqPortrait = window.matchMedia('(orientation: portrait)');
function updateOrientation() {
  document.body.classList.toggle('portrait', mqPortrait.matches);
  if (mqPortrait.matches && game.running) { game.paused = true; game.pauseReason = 'Rotate your device to landscape.'; }
  if (!mqPortrait.matches) {
    if (game.pauseReason === 'Rotate your device to landscape.') game.paused = false;
    game.pauseReason = '';
  }
  // Lock to landscape when not portrait
  if (!mqPortrait.matches) {
    try { screen.orientation.lock('landscape'); } catch (e) {}
  }
}
mqPortrait.addEventListener ? mqPortrait.addEventListener('change', updateOrientation) : mqPortrait.addListener(updateOrientation);
document.body.classList.toggle('portrait', mqPortrait.matches);

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); } catch (e) {}
}

// ---------- game state ----------
const game = {
  actors: [], bots: [], player: null,
  scores: [0, 0], timeLeft: Config.matchTime,
  running: false, over: false, paused: false, pauseReason: '',
  kills: 0, deaths: 0, difficulty: 0.6,
  _hitStop: 0,
  settings,
  shake(a) { followCam.addShake(a); },
  hitStop(t) { this._hitStop = Math.max(this._hitStop, t); },
  damage(target, amount, from, opts = {}) {
    if (!target.alive || this.over || !this.running) return 0;
    const dealt = target.takeDamage(amount, from, this, opts);
    if (dealt > 0) {
      fx.damageNumber(target.center(), dealt, dealt >= Config.staggerThreshold);
      if (from === this.player && target !== this.player) { hud.hitmark(); audio.hit(); }
      if (target === this.player) { hud.damageFlash(); this.shake(0.22); }
      if (opts?.heavy || amount >= Config.launchThreshold) this.hitStop(Config.hitStopHeavy);
      else this.hitStop(Config.hitStopLight);
    }
    return dealt;
  },
  onKill(killer, victim) {
    if (this.over) return;
    const ks = killer && killer.team !== undefined ? killer.team : -1;
    if (ks === 0) this.scores[0]++;
    else if (ks === 1) this.scores[1]++;
    hud.setScores(this.scores[0], this.scores[1]);
    const cn = a => `<b class="${a.team === 0 ? 'blue' : 'red'}">${a.name}</b>`;
    if (killer && killer !== victim) hud.feed(`${cn(killer)} ⚡ ${cn(victim)}`);
    else hud.feed(`${cn(victim)} 💥 eliminated`);
    if (killer === this.player) { this.kills++; audio.kill(); hud.hitmark(); }
    if (victim === this.player) this.deaths++;
    if (this.scores[0] >= Config.killTarget || this.scores[1] >= Config.killTarget) this.endMatch();
  },
  onEvent(type, who) {
    if (who !== this.player) return;
    if (type === 'ult') hud.banner(who.def.ult.name + '!');
    if (type === 'rebirth') hud.banner('REBIRTH!');
    if (type === 'ultEnd') hud.banner(' ');
  },
  endMatch() {
    if (this.over) return;
    this.over = true; this.running = false; this.paused = false;
    document.exitPointerLock && document.exitPointerLock();
    const win = this.scores[0] > this.scores[1];
    hud.el.endTitle.textContent = win ? 'VICTORY' : 'DEFEAT';
    hud.el.endSub.textContent = `${this.scores[0]} — ${this.scores[1]} • ${fmtTime(this.timeLeft)} remaining`;
    hud.el.endStats.innerHTML =
      `<div>Eliminations<br><b>${this.kills}</b></div><div>Deaths<br><b>${this.deaths}</b></div>` +
      `<div>Hero<br><b>${this.player ? this.player.def.name : ''}</b></div><div>Class<br><b>${this.player ? this.player.def.title : ''}</b></div>`;
    hud.showEnd();
    audio.kill();
  },
};
function fmtTime(s) {
  s = Math.max(0, s);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function spawnPos(team, i) {
  const x = team === 0 ? -21 - i * 2.5 : 21 + i * 2.5;
  return new THREE.Vector3(x, 0, (i - 1) * 5);
}

function clearMatch() {
  for (const a of game.actors) a.dispose();
  game.actors = []; game.bots = [];
}

function startMatch(heroId) {
  clearMatch();
  game.scores = [0, 0]; game.timeLeft = Config.matchTime;
  game.over = false; game.paused = false; game.pauseReason = '';
  game.kills = 0; game.deaths = 0;

  const heroIds = Object.keys(HEROES);
  const p = new Character(scene, fx, proj, audio, arena, {
    heroId, team: 0, isPlayer: true, name: 'YOU', spawn: spawnPos(0, 1), ultCharge: 40,
  });
  game.player = p; game.actors.push(p);
  followCam.yaw = -Math.PI / 2; followCam.pitch = -0.14;
  p.yaw = -Math.PI / 2;

  const allies = heroIds.filter(h => h !== heroId);
  allies.forEach((h, i) => {
    const c = new Character(scene, fx, proj, audio, arena, {
      heroId: h, team: 0, name: BOT_NAMES[i] + '・AI', spawn: spawnPos(0, i * 2), ultCharge: 20,
    });
    game.actors.push(c);
    game.bots.push(new Bot(c, game.difficulty));
  });
  heroIds.forEach((h, i) => {
    const c = new Character(scene, fx, proj, audio, arena, {
      heroId: h, team: 1, name: BOT_NAMES[i + 3] + '・AI', spawn: spawnPos(1, i), ultCharge: 20,
    });
    game.actors.push(c);
    game.bots.push(new Bot(c, game.difficulty * (0.9 + Math.random() * 0.2)));
  });

  // hero-specific button labels
  const ab = p.ab;
  hud.el.btnAbility.querySelector('.ab-name').textContent = ab.q.name;
  hud.el.btnAscend.style.display = ab.e.name === 'ASCEND' ? '' : '';
  hud.setScores(0, 0);
  hud.setTimer(game.timeLeft);
  hud.showGame();
  hud.banner('STRIKE TEAM — GO!');
  audio.respawn();
  game.running = true;
}

// ---------- projectile hit resolution ----------
function onProjHit(p, victim, point) {
  fx.burst(point, { n: p.big ? 26 : 10, color: p.glow, speed: p.big ? 9 : 6, life: 0.35 });
  if (victim) {
    game.damage(victim, p.dmg, p.owner, { heavy: !!p.big });
    if (p.owner && p.owner.burnApply && p.owner.heroId === 'phoenix' && victim.alive) {
      p.owner.burnApply = false;
      victim.burnT = 2.6; victim.burnDps = 30; victim.burnFrom = p.owner;
    }
  }
  if (p.splash) {
    fx.burst(point, { n: 18, color: 0xff8a3c, speed: 8, life: 0.5 });
    fx.shockwave(point, p.glow, 5, 0.35);
    audio.explosion(!!p.big);
    for (const a of game.actors) {
      if (!a.alive || a === victim || a.team === p.team) continue;
      if (a.pos.distanceTo(point) < p.splash) game.damage(a, p.dmg * 0.5, p.owner, { heavy: !!p.big });
    }
  }
}

// ---------- menu wiring ----------
hud.el.play.onclick = () => {
  audio.ensure(); audio.ui();
  goFullscreen();
  document.body.classList.add('landscape-lock');
  game.difficulty = parseFloat(hud.el.difficulty.value);
  const q = settings.get('quality');
  applyQuality(q === 'auto' ? pickQuality() : q);
  startMatch(hud.selected);
};
hud.el.again.onclick = () => { audio.ensure(); audio.ui(); startMatch(game.player ? game.player.heroId : hud.selected); };
hud.el.change.onclick = () => { audio.ui(); hud.showMenu(); };
let muted = false;
hud.el.mute.onclick = () => {
  audio.ensure(); muted = !muted; audio.setMuted(muted);
  hud.el.mute.textContent = muted ? '🔇 MUTED' : '🔊 SOUND';
};
hud.el.fs.onclick = () => { audio.ensure(); goFullscreen(); };
hud.el.fs2.onclick = () => { audio.ensure(); goFullscreen(); };
hud.el.gear.onclick = () => openSettings(true);
hud.el.controls.onclick = () => { audio.ensure(); openSettings(false); };

function openSettings(inGame) {
  syncSettingsUI();
  hud.el.settings.classList.remove('hidden');
  if (inGame && game.running) { game.paused = true; game.pauseReason = 'settings'; }
}
hud.el.sClose.onclick = () => {
  hud.el.settings.classList.add('hidden');
  if (game.pauseReason === 'settings' && !mqPortrait.matches) { game.paused = false; game.pauseReason = ''; }
};
function syncSettingsUI() {
  const d = settings.data;
  hud.el.sSens.value = d.sensitivity; hud.el.vSens.textContent = Number(d.sensitivity).toFixed(2);
  hud.el.sSize.value = d.buttonScale; hud.el.vSize.textContent = Number(d.buttonScale).toFixed(2);
  hud.el.sOpac.value = d.opacity; hud.el.vOpac.textContent = Number(d.opacity).toFixed(2);
  hud.el.sAssist.classList.toggle('on', !!d.aimAssist);
  hud.el.sAssist.textContent = d.aimAssist ? 'ON' : 'OFF';
  hud.el.sInvert.classList.toggle('on', !!d.invertY);
  hud.el.sInvert.textContent = d.invertY ? 'ON' : 'OFF';
  hud.el.sQuality.value = d.quality;
}
hud.el.sSens.oninput = e => { settings.set('sensitivity', parseFloat(e.target.value)); hud.el.vSens.textContent = settings.get('sensitivity').toFixed(2); };
hud.el.sSize.oninput = e => { settings.set('buttonScale', parseFloat(e.target.value)); hud.el.vSize.textContent = settings.get('buttonScale').toFixed(2); };
hud.el.sOpac.oninput = e => { settings.set('opacity', parseFloat(e.target.value)); hud.el.vOpac.textContent = settings.get('opacity').toFixed(2); };
hud.el.sAssist.onclick = () => { settings.set('aimAssist', !settings.get('aimAssist')); syncSettingsUI(); };
hud.el.sInvert.onclick = () => { settings.set('invertY', !settings.get('invertY')); syncSettingsUI(); };
hud.el.sQuality.onchange = e => { settings.set('quality', e.target.value); hud.el.quality.value = e.target.value; applyQuality(e.target.value === 'auto' ? pickQuality() : e.target.value); };
addEventListener('nova-audio', () => audio.ensure());
addEventListener('pointerdown', () => audio.ensure());

// ---------- player input mapping ----------
let chargeReadyFlag = false;
function playerMove(dt) {
  input.poll(dt);
  const look = input.consumeLook();
  followCam.yaw -= look.dx * 0.0026;
  followCam.pitch = THREE.MathUtils.clamp(followCam.pitch - look.dy * 0.0022, -1.05, 0.62);

  const p = game.player;
  if (!p) return null;
  if (input.chargeReady && !chargeReadyFlag) hud.chargeBanner();
  chargeReadyFlag = input.chargeReady;
  const shot = input.consumeShot();
  return {
    x: input.move.x, y: input.move.y,
    yaw: followCam.yaw,
    pitch: followCam.pitch,
    firing: false,
    aiming: input.aimHeld,
    ascend: input.ascend && p.flyEnergy > 0.02,
    descend: input.descend,
    jumpPressed: input.jumpPressed,
    dashPressed: input.dashPressed,
    qPressed: !!p.qPressedEdge,
    ultPressed: !!p.ultPressedEdge,
    shot,
    charge: input.charge / Config.chargeTime,
  };
}

// ---------- update ----------
function update(dt, t) {
  arena.update(t);
  if (!game.running || game.paused) return;
  game.timeLeft -= dt;
  hud.setTimer(game.timeLeft);
  if (game.timeLeft <= 0) { game.endMatch(); return; }

  const p = game.player;
  for (const b of game.bots) {
    b.update(dt, game.actors, game);
    b.c.update(dt, b.move, game);
  }
  if (p) {
    const mv = playerMove(dt) || {
      x: 0, y: 0, yaw: followCam.yaw, pitch: followCam.pitch, aiming: false,
      ascend: false, descend: false, jumpPressed: false, dashPressed: false,
      qPressed: false, ultPressed: false, shot: 0, charge: 0,
    };
    p.update(dt, mv, game);
    followCam.update(dt, p, {
      aiming: input.aimHeld, flying: p.state === 'fly', dash: p.state === 'dash', vel: p.vel,
    });
    let note = p.state === 'fly' ? 'AIRBORNE' : (p.grounded ? 'GROUND' : 'AIR');
    if (p.state === 'dash') note = 'DASH';
    if (p.controlsLocked()) note = 'STAGGERED';
    hud.setPlayer(p.hp, p.maxHp, p.flyEnergy, p.ultCharge, p.def.name, `${note} · ${Math.round(1 / Math.max(dt, 1e-3))}FPS`);
    hud.setCd(hud.el.btnAbility.querySelector('.cd'), p.qCd, p.ab.q.cd);
    hud.setCd(hud.el.btnDash.querySelector('.cd'), Math.max(0, p.dashCd), Config.dashCd);
    hud.setCd(hud.el.btnUlt.querySelector('.cd'), 100 - p.ultCharge, 100);
    hud.setCharge(hud.el.btnFire.querySelector('.chg'), input.charge / Config.chargeTime);

    if (!p.alive) {
      hud.setDeath(true, Math.ceil(p.respawnT));
      if (p.respawnT <= 0) {
        p.spawnAt(spawnPos(0, 1));
        p.rebirthReady = true;
        p.ultCharge = Math.max(p.ultCharge, 35);
        followCam.yaw = p.yaw;
        hud.setDeath(false);
        audio.respawn();
      }
    } else hud.setDeath(false);
  }
  for (const b of game.bots) {
    const c = b.c;
    if (!c.alive && c.respawnT <= 0) {
      c.spawnAt(spawnPos(c.team, Math.floor(Math.random() * 3)));
      c.rebirthReady = true;
      b.state = 'seek'; b.move.qPressed = false; b.move.ultPressed = false; b.move.dashPressed = false;
    }
  }
  proj.update(dt, game.actors, arena, onProjHit);
  fx.update(dt);
  input.endFrame();
}

function loop() {
  requestAnimationFrame(loop);
  const dtReal = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // hit-stop: freeze frames briefly on heavy hits (shorter dt, not zero)
  let dt = dtReal;
  if (game._hitStop > 0) {
    game._hitStop -= dtReal;
    dt = dtReal * 0.06;
  }
  update(dt, t);
  if (!game.running && !game.over) {
    const a = t * 0.12;
    camera.position.set(Math.cos(a) * 34, 14, Math.sin(a) * 34);
    camera.lookAt(0, 3, 0);
    fx.update(dt);
  } else if (game.over) {
    fx.update(dt);
  }
  renderer.render(scene, camera);

  // adaptive quality
  fpsAcc += dtReal; fpsN++;
  if (fpsAcc >= 1.5) {
    const fps = fpsN / fpsAcc;
    fpsAcc = 0; fpsN = 0;
    if (game.running && settings.get('quality') === 'auto' && !game.paused) {
      if (fps < 38 && qualityTier !== 'low') applyQuality(qualityTier === 'high' ? 'medium' : 'low');
      else if (fps > 56 && qualityTier === 'low') applyQuality('medium');
    }
  }
}
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0;

// boot
hud.el.loading.classList.add('hidden');
window.__game = game; window.__cam = followCam; window.__input = input; window.__proj = proj; window.__arena = arena; // debug/testing handle
loop();
