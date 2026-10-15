// Procedural hero rigs: coherent armored bodies, connected joints,
// PBR materials, expressive procedural animation (run / fly / aim / hit / death).
import * as THREE from 'three';
import { HEROES } from '../core/config.js';

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.65, ...o });
}
function limb(r1, r2, len, material) {
  // tapered connected limb segment with spheres at both ends (no gaps)
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r2, r1, len, 10);
  const m = new THREE.Mesh(geo, material); m.castShadow = true; g.add(m);
  const j1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 10, 8), material); j1.castShadow = true; g.add(j1); j1.position.y = len / 2;
  const j2 = new THREE.Mesh(new THREE.SphereGeometry(r2, 10, 8), material); j2.castShadow = true; g.add(j2); j2.position.y = -len / 2;
  g.userData.len = len;
  return g;
}

export class HeroRig {
  constructor(heroId) {
    this.heroId = heroId;
    this.def = HEROES[heroId];
    this.group = new THREE.Group();
    this.j = {}; // joints
    this.t = Math.random() * 10;
    this.build();
  }

  build() {
    const C = this.def.colors;
    const armor = mat(C.primary, { roughness: 0.34, metalness: 0.85 });
    const accent = mat(C.secondary, { roughness: 0.28, metalness: 0.95, emissive: C.secondary, emissiveIntensity: 0.12 });
    const dark = mat(0x1a2030, { roughness: 0.55, metalness: 0.5 });
    const glowM = new THREE.MeshStandardMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.1 });
    const skinM = mat(C.skin, { roughness: 0.6, metalness: 0.05 });

    const root = new THREE.Group(); this.group.add(root); this.j.root = root;
    const hips = new THREE.Group(); hips.position.y = 1.02; root.add(hips); this.j.hips = hips;

    // pelvis + belt glow
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), dark);
    pelvis.scale.set(1.15, 0.75, 0.85); pelvis.castShadow = true; hips.add(pelvis);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 18), glowM);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.06; hips.add(belt);

    // torso (layered chest plates)
    const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso); this.j.torso = torso;
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.34, 6, 12), armor);
    chest.position.y = 0.34; chest.castShadow = true; torso.add(chest);
    const pec = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), armor);
    pec.scale.set(1.25, 0.8, 0.8); pec.position.y = 0.48; pec.castShadow = true; torso.add(pec);
    // arc core
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16), glowM);
    core.rotation.x = Math.PI / 2; core.position.set(0, 0.44, 0.24); torso.add(core); this.j.core = core;
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20), accent);
    coreRing.position.copy(core.position); torso.add(coreRing);
    // back thruster pack (vanguard) / wings anchors others
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.16), dark);
    pack.position.set(0, 0.36, -0.26); pack.castShadow = true; torso.add(pack);
    this.j.pack = pack;

    // head
    const neck = new THREE.Group(); neck.position.y = 0.68; torso.add(neck); this.j.neck = neck;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), this.heroId === 'inferno' ? mat(0xff9a50, { emissive: 0xff5a1a, emissiveIntensity: 0.9, roughness: 0.5 }) : skinM);
    head.position.y = 0.16; head.castShadow = true; neck.add(head);
    // helmet / mask per hero
    if (this.heroId === 'vanguard') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armor);
      helm.position.y = 0.19; helm.castShadow = true; neck.add(helm);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), glowM);
      visor.position.set(0, 0.18, 0.15); neck.add(visor);
    } else if (this.heroId === 'phoenix') {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), accent);
      crest.position.set(0, 0.36, -0.04); crest.rotation.x = -0.5; neck.add(crest);
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.05), glowM);
      mask.position.set(0, 0.18, 0.15); neck.add(mask);
    } else {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 8),
        new THREE.MeshStandardMaterial({ color: 0xffc63c, emissive: 0xff7a1a, emissiveIntensity: 2.2, transparent: true, opacity: 0.92 }));
      flame.position.y = 0.44; neck.add(flame); this.j.headFlame = flame;
    }

    // arms: shoulder pivot -> upper -> elbow -> fore+hand (repulsor palm)
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.32, 0.56, 0); torso.add(sh);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), side < 0 ? armor : accent);
      pad.castShadow = true; sh.add(pad);
      const upper = limb(0.095, 0.08, 0.32, armor); upper.position.y = -0.18; sh.add(upper);
      const el = new THREE.Group(); el.position.y = -0.36; upper.add(el);
      // fix: elbow group at end of upper limb
      const fore = limb(0.075, 0.065, 0.3, dark); fore.position.y = -0.15; el.add(fore);
      const hand = new THREE.Group(); hand.position.y = -0.32; fore.add(hand);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), armor);
      fist.castShadow = true; hand.add(fist);
      const palm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), glowM);
      palm.position.set(0, -0.05, 0.06); palm.rotation.x = Math.PI / 2; hand.add(palm);
      this.j[side < 0 ? 'armL' : 'armR'] = sh;
      this.j[side < 0 ? 'elbL' : 'elbR'] = el;
      this.j[side < 0 ? 'palmL' : 'palmR'] = palm;
      this.j[side < 0 ? 'handL' : 'handR'] = hand;
    }

    // charge orb (follows right hand; scaled by primary charge level)
    const chargeColor = (HEROES[this.heroId] || {}).chargeColor || 0x9fe8ff;
    this.chargeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshBasicMaterial({ color: chargeColor, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.chargeOrb.visible = false;
    this.chargeOrb.position.set(0, -0.07, 0.09);
    this.j.handR.add(this.chargeOrb);

    // legs: hip pivot -> thigh -> knee -> shin+boot
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.14, -0.05, 0); hips.add(hip);
      const thigh = limb(0.12, 0.095, 0.42, dark); thigh.position.y = -0.22; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.46; thigh.add(knee);
      const shin = limb(0.09, 0.075, 0.4, armor); shin.position.y = -0.2; knee.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), accent);
      boot.position.set(0, -0.44, 0.05); boot.castShadow = true; shin.add(boot);
      // thruster glow under boot (vanguard/inferno)
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.08, 10), glowM);
      jet.position.set(0, -0.48, -0.02); shin.add(jet);
      this.j[side < 0 ? 'legL' : 'legR'] = hip;
      this.j[side < 0 ? 'kneeL' : 'kneeR'] = knee;
      this.j[side < 0 ? 'jetL' : 'jetR'] = jet;
      jet.visible = false;
    }

    // Hero extras
    if (this.heroId === 'phoenix') this.buildWings(glowM, accent);
    if (this.heroId === 'inferno') this.buildAura();
    if (this.heroId === 'vanguard') this.buildShoulderGuns(accent, glowM);

    // Shadow blob (fake contact shadow, always present for grounding)
    const blobC = document.createElement('canvas'); blobC.width = blobC.height = 64;
    const bg = blobC.getContext('2d');
    const grd = bg.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = grd; bg.fillRect(0, 0, 64, 64);
    const blobT = new THREE.CanvasTexture(blobC);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.group.add(this.blob);

    // Hit flash overlay: store base emissives
    this.flash = 0;
    this.baseEmissive = new Map();
    this.group.traverse(o => {
      if (o.material && o.material.emissive && !this.baseEmissive.has(o.material)) {
        this.baseEmissive.set(o.material, o.material.emissive.getHex());
      }
      if (o.material && o.material.transparent) o.material.userData.baseOpacity = o.material.opacity;
    });
  }

  buildWings(glowM, accent) {
    this.wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(side * 0.2, 0.5, -0.28); this.j.torso.add(w);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a1a, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, side: THREE.DoubleSide, roughness: 0.5 });
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.85 - i * 0.16), wingMat);
        f.position.set(side * (0.22 + i * 0.16), 0.15 - i * 0.06, -0.1 - i * 0.1);
        f.rotation.z = side * (0.5 + i * 0.25); f.rotation.y = side * 0.5;
        w.add(f);
      }
      this.wings.push(w);
    }
  }
  buildAura() {
    const auraMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), auraMat);
    this.aura.position.y = 1.1; this.aura.scale.set(0.8, 1.4, 0.8); this.group.add(this.aura);
  }
  buildShoulderGuns(accent, glowM) {
    for (const side of [-1, 1]) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.3), accent);
      gun.position.set(side * 0.3, 0.6, -0.06); this.j.torso.add(gun);
      const tipm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glowM);
      tipm.position.set(side * 0.3, 0.6, -0.24); this.j.torso.add(tipm);
    }
  }

  setFlash(v) { this.flash = v; }
  muzzle(side = 1) {
    // world pos of palm
    const p = new THREE.Vector3();
    this.j[side < 0 ? 'palmL' : 'palmR'].getWorldPosition(p);
    return p;
  }

  animate(dt, s) {
    // s: {speed, state, flying, aiming, firing, hitT, ultFiring, aimPitch,
    //     stunned, landT, velY, gliding, invuln, charge, dead}
    this.t += dt;
    const t = this.t;
    const J = this.j;
    const lerp = THREE.MathUtils.lerp;
    const st = s.state || (s.flying ? 'fly' : (s.stunned ? 'stagger' : 'ground'));
    const dead = !!s.dead || st === 'dead';
    const flying = st === 'fly';
    const air = flying || st === 'air' || st === 'staggerAir';
    const locked = st === 'stagger' || st === 'staggerAir' || st === 'knockdown';
    const run = Math.min(1, (s.speed || 0) / 8);

    this._fly = lerp(this._fly || 0, flying ? 1 : 0, 1 - Math.exp(-7 * dt));
    this._air = lerp(this._air || 0, air ? 1 : 0, 1 - Math.exp(-7 * dt));
    this._walk = this._walk || 0;
    if (!locked && !dead) this._walk += dt * Math.min(16, 6 + run * 9);
    const W = this._walk;
    const F = this._fly, A = this._air;
    const sw = Math.sin(W) * run, sw2 = Math.sin(W + Math.PI) * run;

    // ----- establish base pose targets per state (blended) -----
    let legsX = [sw * 0.85, sw2 * 0.85];
    let kneesX = [Math.max(0, -sw2) * 1.15 + 0.1, Math.max(0, -sw) * 1.15 + 0.1];
    let torsoX = Math.sin(t * 2.2) * 0.025 + (s.aiming ? 0.07 : 0);
    let torsoZ = 0;
    let rootX = run * 0.13;
    let rootY = 0;
    let armR = sw2 * 0.55, armL = sw * 0.55, elbR = -0.4 - run * 0.5, elbL = -0.4 - run * 0.5;
    let armRz = 0.14, armLz = -0.14;
    let headY = 0;

    // --- air pose ---
    if (A > 0.001) {
      const fall = THREE.MathUtils.clamp((s.velY || 0) / 14, -1, 1);
      legsX = [0.45 + fall * 0.3, 0.3 - fall * 0.35];
      kneesX = [0.85, 0.6];
      torsoX = lerp(torsoX, -0.12 - fall * 0.15, A);
      rootX = lerp(rootX, -0.08, A);
      armR = lerp(armR, -0.6, A); armL = lerp(armL, 0.4, A);
      elbR = lerp(elbR, -0.5, A); elbL = lerp(elbL, -0.9, A);
      armRz = lerp(armRz, -0.5, A); armLz = lerp(armLz, -1.0, A);
    }

    // --- flight pose (superhero horizontal) ---
    if (F > 0.001) {
      legsX = [lerp(0.45, -0.15, F), lerp(0.3, -0.05, F)];
      kneesX = [0.45, 0.35];
      rootY = lerp(0, -0.1, F);
      torsoX = lerp(torsoX, -0.72, F);      // lying forward
      armR = lerp(armR, 1.5, F);             // arms swept back
      armL = lerp(armL, 1.15, F);
      elbR = lerp(elbR, -0.15, F); elbL = lerp(elbL, -0.15, F);
      armRz = lerp(armRz, -0.25, F); armLz = lerp(armLz, -0.75, F);
    }

    // --- aiming / firing (upper body, overrides arm) ---
    if (s.aiming || s.firing) {
      const w = Math.max(F > 0.5 ? 0.55 : 0, s.aiming ? 1 : 0.7);
      armR = lerp(armR, -1.42 + (s.aimPitch || 0) * 0.45, w);
      armRz = lerp(armRz, -0.2, w);
      elbR = lerp(elbR, -0.14, w);
      if (F > 0.5) torsoX = lerp(torsoX, -0.35 + (s.aimPitch || 0) * 0.3, 1 - F * 0.4);
      else torsoX = lerp(torsoX, (s.aimPitch || 0) * 0.4, w);
      headY = lerp(headY, 0, 0.4);
    }

    // --- ult beam pose ---
    if (s.ultFiring) { armR = -1.5; elbR = -0.05; torsoX = lerp(torsoX, -0.05, 0.5); }

    // --- dash ---
    if (st === 'dash') {
      torsoX = lerp(torsoX, -0.55, 0.9);
      armR = lerp(armR, 1.35, 0.9); armL = lerp(armL, 1.2, 0.9);
      legsX = [0.75, 0.15]; kneesX = [0.3, 0.7];
    }

    // --- stagger (light flinch) ---
    if (st === 'stagger') {
      const f = Math.max(0, 1 - (s.hitT || 0));
      torsoX = lerp(torsoX, 0.42, 0.8 - f * 0.3);
      torsoZ = Math.sin(t * 34) * 0.06;
      armR = lerp(armR, 0.9, 0.8); armL = lerp(armL, 0.9, 0.8);
      legsX = [0.3, -0.25]; kneesX = [0.4, 0.5];
    }

    // --- launched / tumbling ---
    if (st === 'staggerAir') {
      torsoX = lerp(torsoX, -0.35, 0.6);
      armR = lerp(armR, -1.9, 0.6); armL = lerp(armL, -1.7, 0.6);
      legsX = [0.8, 0.5]; kneesX = [0.5, 0.4];
      this._tumble = (this._tumble || 0) + dt * 9;
      J.root.rotation.x = Math.sin(this._tumble) * 0.5;
    } else this._tumble = 0;

    // --- knockdown: fall, stay down, then get up ---
    if (st === 'knockdown') {
      this._down = Math.min(1, (this._down || 0) + dt * 4);
      J.root.rotation.x = lerp(J.root.rotation.x, -Math.PI / 2 + 0.25, this._down);
      J.root.position.y = lerp(J.root.position.y, -0.55, this._down);
      torsoX = 0.15; armR = 0.6; armL = -0.5;
      legsX = [-0.4, 0.55]; kneesX = [0.8, 0.5];
    } else if (this._down) {
      this._down = Math.max(0, this._down - dt * 3);
      J.root.rotation.x = lerp(J.root.rotation.x, 0, 1 - this._down);
      J.root.position.y = lerp(J.root.position.y, 0, 1 - this._down);
    }

    // --- death ---
    if (dead) {
      this._dead = Math.min(1, (this._dead || 0) + dt * 2.2);
      J.root.rotation.x = lerp(0, -Math.PI / 2 + 0.18, this._dead);
      J.root.position.y = lerp(0, -0.6, this._dead);
      torsoX = 0.1; armR = 0.9; armL = -0.9; armLz = -1.2;
      legsX = [-0.3, 0.4]; kneesX = [0.7, 0.4];
      this.group.traverse(o => { if (o.material && o.material.transparent) o.material.opacity = 1 - this._dead * 0.85; });
      this.blob.visible = false;
      return;
    } else this._dead = 0;
    this.group.traverse(o => { if (o.material && o.material.transparent) o.material.opacity = o.material.userData.baseOpacity ?? o.material.opacity; });
    this.blob.visible = true;

    // ----- apply pose -----
    J.root.position.y = lerp(J.root.position.y, Math.abs(Math.sin(W)) * 0.055 * run, 1 - Math.exp(-10 * dt));
    J.root.rotation.x = st === 'staggerAir' || st === 'knockdown' ? J.root.rotation.x : lerp(J.root.rotation.x, rootX, 1 - Math.exp(-10 * dt));
    J.legL.rotation.x = legsX[0]; J.legR.rotation.x = legsX[1];
    J.kneeL.rotation.x = kneesX[0]; J.kneeR.rotation.x = kneesX[1];
    J.hips.rotation.y = lerp(J.hips.rotation.y, sw * 0.09 * (locked ? 0 : 1), 1 - Math.exp(-8 * dt));
    J.torso.rotation.x = torsoX;
    J.torso.rotation.z = torsoZ;
    J.armR.rotation.x = armR; J.armR.rotation.z = armRz;
    J.armL.rotation.x = armL; J.armL.rotation.z = armLz;
    J.elbR.rotation.x = elbR; J.elbL.rotation.x = elbL;
    J.neck.rotation.y = headY;
    if (s.firing && F < 0.5) J.armR.rotation.x += Math.sin(t * 55) * 0.035; // recoil
    if (s.landT > 0) { // landing squash
      const q = s.landT / 0.28;
      J.root.position.y -= q * 0.28;
      J.kneeL.rotation.x += q * 0.7; J.kneeR.rotation.x += q * 0.7;
      J.legL.rotation.x -= q * 0.5; J.legR.rotation.x -= q * 0.5;
    }

    // jets
    const showJet = F > 0.35;
    if (J.jetL) { J.jetL.visible = showJet; J.jetR.visible = showJet; }
    // wings
    if (this.wings) this.wings.forEach((w, i) => {
      const sd = i === 0 ? -1 : 1;
      const open = s.gliding ? 1 : F * 0.5;
      const flap = F > 0.4 ? 0.55 : (s.gliding ? 0.12 : 0.05);
      w.rotation.z = sd * (0.2 + Math.sin(t * (s.gliding || F > 0.4 ? 9 : 2.4)) * flap) + sd * open * 0.3;
    });
    if (this.aura) this.aura.material.opacity = 0.1 + F * 0.14 + (s.gliding ? 0.1 : 0) + Math.sin(t * 6) * 0.03;
    if (this.j.headFlame) this.j.headFlame.scale.y = 1 + Math.sin(t * 11) * 0.18;
    if (this.j.core) this.j.core.scale.setScalar(1 + Math.sin(t * 5) * 0.07 + (s.ultFiring ? 0.9 : 0));
    // charge orb at palm
    if (this.chargeOrb) {
      const c = s.charge || 0;
      this.chargeOrb.visible = c > 0.02;
      this.chargeOrb.scale.setScalar(0.25 + c * 0.95);
      this.chargeOrb.material.opacity = 0.35 + c * 0.65;
    }
    // invulnerability blink (applies to any invulnerable character)
    this.group.visible = !s.invuln || (performance.now() % 220) < 150;

    // hit flash
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      const k = this.flash;
      this.baseEmissive.forEach((hex, m) => {
        m.emissive.setHex(hex);
        m.emissive.lerp(new THREE.Color(1, 0.15, 0.1), k);
        m.emissiveIntensity = 1 + k * 2;
      });
    }
  }

}
