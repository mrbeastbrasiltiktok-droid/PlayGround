import * as THREE from 'three';
import { CHARACTERS } from './data.js';

// Stickman de energia: corpo grafite fino + juntas/núcleo/olhos emissivos.
// Mesma API e esqueleto do rig anterior (nenhuma mudança na lógica de animação).
const V3 = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.castShadow = true;
  return m;
}
function ball(r, mat, w=14,h=10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
  m.castShadow = true; return m;
}
function box(w,h,d,mat){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.castShadow=true; return m; }

export class Fighter {
  constructor(scene, charId) {
    this.charId = charId;
    this.def = CHARACTERS[charId];
    this.group = new THREE.Group();
    this.vel = V3();
    this.speedMul = 1;
    this.phase = Math.random()*10;
    this.anim = { name:'entrance', t:0, dur:1.4 };
    this.moveAmt = 0;
    this.attackSide = 1;
    this.hitFlash = 0;
    this.invisible = false;
    this.floatH = 0;
    this.downPose = 0;
    this.build();
    scene.add(this.group);
  }
  build() {
    const c = this.def.color, c2 = this.def.color2;
    // corpo: grafite quase preto com leve matiz do personagem (leitura de sombra)
    const bodyTint = new THREE.Color(c).multiplyScalar(0.16);
    const limb = new THREE.MeshStandardMaterial({ color: bodyTint, roughness: 0.45, metalness: 0.55 });
    const limb2 = new THREE.MeshStandardMaterial({ color: bodyTint.clone().multiplyScalar(1.6), roughness: 0.4, metalness: 0.5 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: c, emissiveIntensity: 2.2, roughness: 0.35 });
    const glowHot = new THREE.MeshBasicMaterial({ color: c2 });
    this.mats = [limb, limb2, glow];
    if (this.charId==='iw') { limb.color.set(0x0d1526); limb2.color.set(0x182a4a); }

    const g = this.group;
    this.hips = new THREE.Group(); this.hips.position.y = 0.98; g.add(this.hips);
    const pelvis = ball(0.11, limb2); pelvis.scale.set(1.25,0.8,0.9); this.hips.add(pelvis);
    // faixa de energia na cintura
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.13,0.022,8,20), glow);
    belt.rotation.x = Math.PI/2; belt.position.y = 0.06; this.hips.add(belt);

    this.torso = new THREE.Group(); this.torso.position.y = 0.1; this.hips.add(this.torso);
    const spine = capsule(0.055, 0.42, limb); spine.position.y = 0.36; this.torso.add(spine);
    // linha de energia no peito
    const coreLine = box(0.035,0.34,0.035,glow); coreLine.position.set(0,0.36,0.075); this.torso.add(coreLine);
    const core = ball(0.06, glow); core.position.set(0,0.44,0.08); this.torso.add(core); this.coreGem = core;
    const coreHot = ball(0.028, glowHot); coreHot.position.copy(core.position); this.torso.add(coreHot);

    // ombros: pequenas juntas brilhantes (silhueta de stickman atlético)
    for (const s of [-1,1]) {
      const j = ball(0.055, glow); j.position.set(s*0.2,0.56,0); this.torso.add(j);
    }
    // acessório de silhueta por personagem (fino, energético)
    if (this.charId==='phoenix') {
      // fita de fogo nas costas (balança no update)
      this._crestHolder = new THREE.Group();
      const ribbon = box(0.05,0.55,0.02,glow); ribbon.position.set(0,-0.15,-0.12); ribbon.rotation.x=0.3;
      this._crestHolder.add(ribbon);
      this.neckAcc = ribbon;
    } else if (this.charId==='chaos') {
      // espinhos caóticos nos ombros/costas
      for (const s of [-1,1]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.26,5), glow);
        spike.position.set(s*0.22,0.66,-0.04); spike.rotation.z=-s*0.5; spike.rotation.x=-0.3;
        this.torso.add(spike);
      }
    } else {
      // anel orbital de força na cintura (gira no update)
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24,0.018,8,32), glow);
      halo.rotation.x = Math.PI/2 - 0.25; halo.position.y = -0.02; this.hips.add(halo);
      this.orbitHalo = halo;
    }

    this.neck = new THREE.Group(); this.neck.position.y = 0.66; this.torso.add(this.neck);
    const head = ball(0.135, limb2); head.position.y=0.16; head.scale.set(0.95,1.05,0.95); this.neck.add(head);
    this.headMesh = head;
    // faixa-olhos brilhante (visually striking, barato)
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.charId==='chaos'?0xff3355:c2 });
    const visor = box(0.15,0.045,0.03,eyeMat); visor.position.set(0,0.18,0.115); this.neck.add(visor);
    if (this.charId==='phoenix') {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.055,0.3,6), glow);
      crest.position.set(0,0.36,-0.02); crest.rotation.x=-0.3; this.neck.add(crest); this.crest=crest;
    } else if (this.charId==='chaos') {
      for (let i=-1;i<=1;i++){
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.2,5), glow);
        horn.position.set(i*0.07,0.3,-0.03); horn.rotation.x=-0.4; this.neck.add(horn);
      }
    } else {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.12,0.02,8,20,Math.PI*1.3), glow);
      band.position.y=0.2; band.rotation.z=Math.PI*0.85; this.neck.add(band);
    }
    if (this.neckAcc) this.neck.add(this._crestHolder), this._crestHolder.position.set(0,0.1,-0.08);

    const mkArm = (s)=>{
      const sh = new THREE.Group(); sh.position.set(s*0.21,0.55,0); this.torso.add(sh);
      const upper = capsule(0.042,0.24,limb); upper.position.y=-0.15; sh.add(upper);
      const el = new THREE.Group(); el.position.y=-0.3; sh.add(el);
      const elbowJ = ball(0.04, glow); el.add(elbowJ);
      const fore = capsule(0.037,0.22,limb); fore.position.y=-0.13; el.add(fore);
      const hand = ball(0.055,limb2); hand.position.y=-0.28; el.add(hand);
      const palm = ball(0.038,glow); palm.position.set(0,-0.28,0.045); el.add(palm);
      const light = new THREE.PointLight(c, 0, 4.5, 2); light.position.y=-0.28; el.add(light);
      return {sh,el,hand,palm,light};
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);

    const mkLeg = (s)=>{
      const hip = new THREE.Group(); hip.position.set(s*0.1,-0.06,0); this.hips.add(hip);
      const hipJ = ball(0.05, glow); hip.add(hipJ);
      const thigh = capsule(0.052,0.3,limb); thigh.position.y=-0.19; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y=-0.4; hip.add(knee);
      const kneeJ = ball(0.042, glow); knee.add(kneeJ);
      const shin = capsule(0.042,0.3,limb); shin.position.y=-0.19; knee.add(shin);
      const foot = box(0.09,0.06,0.2,limb2); foot.position.set(0,-0.4,0.04); knee.add(foot);
      return {hip,knee};
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);

    const ringMat = new THREE.MeshBasicMaterial({ color: c, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
    this.aura = new THREE.Mesh(new THREE.RingGeometry(0.5,0.66,32), ringMat);
    this.aura.rotation.x=-Math.PI/2; this.aura.position.y=0.03; g.add(this.aura);

    g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    this.baseY = 0;
  }
  setAnim(name, dur=null) {
    const defaults = { idle:0.5, walk:0.5, attack:0.55, cast:0.9, dash:0.35, block:0.4, hit:0.45, down:1.2, win:2.0, entrance:1.4, grab:2.2, channel:1.0, lift:1.2, stun:1.0 };
    this.anim = { name, t:0, dur: dur ?? defaults[name] ?? 0.5 };
  }
  get busy() {
    const a=this.anim.name;
    return ['attack','cast','dash','hit','grab','channel','lift','stun','down'].includes(a) && this.anim.t < this.anim.dur;
  }
  update(dt, time, moving=false) {
    this.anim.t += dt;
    this.phase += dt * (moving?11:2.2);
    this.moveAmt += ((moving?1:0)-this.moveAmt)*Math.min(1,dt*8);
    this.hitFlash = Math.max(0,this.hitFlash-dt*3);
    const A=this.anim, t=A.t, k=Math.min(1,t/A.dur);
    const m=this.moveAmt, ph=this.phase;
    const breathe = Math.sin(time*2.2+this.phase)*0.02;
    const swing = Math.sin(ph)*0.55*m, swing2=Math.sin(ph+Math.PI)*0.55*m;
    this.hips.position.y = 0.98 + Math.abs(Math.sin(ph))*0.05*m + breathe + this.floatH;
    this.hips.rotation.x = 0.06*m + (A.name==='dash'?0.35:0);
    this.torso.rotation.x = -0.03 + breathe*0.6;
    this.torso.position.y = 0.1;
    this.legL.hip.rotation.x = swing; this.legR.hip.rotation.x = swing2;
    this.legL.knee.rotation.x = Math.max(0,-swing2)*1.2 + 0.06;
    this.legR.knee.rotation.x = Math.max(0,-swing)*1.2 + 0.06;
    this.armL.sh.rotation.set(Math.sin(ph+Math.PI)*0.4*m - 0.1, 0, 0.14);
    this.armR.sh.rotation.set(Math.sin(ph)*0.4*m - 0.1, 0, -0.14);
    this.armL.el.rotation.x = -0.35 - m*0.3; this.armR.el.rotation.x = -0.35 - m*0.3;
    this.neck.rotation.set(0,0,0); this.torso.rotation.y=0; this.torso.rotation.z=0;
    this.aura.material.opacity = 0.4+Math.sin(time*3)*0.12;
    if (this.orbitHalo) this.orbitHalo.rotation.z += dt*2.2;
    if (this.neckAcc) this.neckAcc.rotation.x = 0.3 + Math.sin(time*5)*0.18;

    const punch = (arm, side, kk)=>{
      if (kk<0.3){ const w=kk/0.3; arm.sh.rotation.set(-0.4*w-0.1, side*0.5*w, side*0.4*w); arm.el.rotation.x=-1.4*w-0.2; }
      else if (kk<0.55){ const s=(kk-0.3)/0.25; arm.sh.rotation.set( -0.4+1.9*s, -side*0.15, -side*0.1); arm.el.rotation.x=-1.6+1.5*s; }
      else { const r=(kk-0.55)/0.45; arm.sh.rotation.set(1.5-1.6*r,0,side*0.14*(1-r)); arm.el.rotation.x=-0.1-0.25*r; }
    };
    switch(A.name){
      case 'attack': {
        const combo = this.comboStep||0;
        if (combo===2){
          if(k<0.35){ this.legR.hip.rotation.x=-0.5*k/0.35; this.torso.rotation.y=0.4*k/0.35; }
          else if(k<0.6){ const s=(k-0.35)/0.25; this.legR.hip.rotation.x=-0.5+1.9*s; this.torso.rotation.y=0.4-0.9*s; this.armL.sh.rotation.x=-1.2*s; }
          else { const r=(k-0.6)/0.4; this.legR.hip.rotation.x=1.4-1.4*r; this.torso.rotation.y=-0.5+0.5*r; }
        } else {
          const arm = (combo===0?this.armR:this.armL); const other=this.armL===arm?this.armR:this.armL;
          punch(arm, this.armL===arm?-1:1, k);
          other.sh.rotation.set(-0.5,0,(this.armL===other?-1:1)*-0.3);
          this.torso.rotation.y = (combo===0?-0.5:0.5)*(k<0.55?k/0.55:(1-k)/0.45);
        }
        break;
      }
      case 'cast':
        this.armL.sh.rotation.set(-2.4+Math.sin(t*30)*0.06,0,0.5);
        this.armR.sh.rotation.set(-2.4-Math.sin(t*30)*0.06,0,-0.5);
        this.armL.el.rotation.x=this.armR.el.rotation.x=-0.15;
        this.torso.rotation.x=-0.18; this.hips.position.y-=0.06;
        this.armL.light.intensity=this.armR.light.intensity=14;
        break;
      case 'channel':
        this.armL.sh.rotation.set(-2.9,0,0.3); this.armR.sh.rotation.set(-2.9,0,-0.3);
        this.torso.rotation.x=-0.3;
        this.armL.light.intensity=this.armR.light.intensity=20;
        break;
      case 'grab':
        this.armR.sh.rotation.set(-1.5,0,-0.15); this.armR.el.rotation.x=-0.25;
        this.armL.sh.rotation.set(-0.6,0.6,0.6);
        this.torso.rotation.x=0.12; this.torso.rotation.y=-0.25;
        this.armR.light.intensity=22;
        break;
      case 'dash':
        this.torso.rotation.x=0; this.hips.rotation.x=0.5;
        this.legL.hip.rotation.x=-0.9; this.legR.hip.rotation.x=0.7;
        this.legL.knee.rotation.x=1.2; this.legR.knee.rotation.x=0.4;
        this.armL.sh.rotation.x=0.8; this.armR.sh.rotation.x=0.8;
        break;
      case 'block':
        this.armL.sh.rotation.set(-1.7,0.5,0.9); this.armR.sh.rotation.set(-1.7,-0.5,-0.9);
        this.armL.el.rotation.x=this.armR.el.rotation.x=-1.5;
        this.hips.position.y-=0.12; this.torso.rotation.x=0.15;
        break;
      case 'hit':
        this.torso.rotation.x=0.45*(1-k); this.torso.rotation.y=0.4*(1-k);
        this.armL.sh.rotation.set(-0.8,0,1.1); this.armR.sh.rotation.set(-0.8,0,-1.1);
        this.hips.position.y-=0.05*(1-k);
        break;
      case 'stun':
        this.neck.rotation.z=Math.sin(t*14)*0.18; this.torso.rotation.z=Math.sin(t*9)*0.1;
        this.armL.sh.rotation.set(-0.3,0,1.3); this.armR.sh.rotation.set(-0.3,0,-1.3);
        break;
      case 'lift':
        this.floatH += ((1.6)-this.floatH)*Math.min(1,dt*4);
        this.legL.hip.rotation.x=-0.4+Math.sin(t*10)*0.15; this.legR.hip.rotation.x=0.3;
        this.legL.knee.rotation.x=0.9; this.legR.knee.rotation.x=0.5;
        this.armL.sh.rotation.set(0.4,0,1.2); this.armR.sh.rotation.set(0.4,0,-1.2);
        this.neck.rotation.x=-0.4; this.torso.rotation.z=Math.sin(t*6)*0.12;
        this.group.rotation.y+=dt*3;
        break;
      case 'down':
        this.downPose=Math.min(1,k*1.4);
        break;
      case 'win':
        this.armL.sh.rotation.set(-2.8,0,0.35); this.armR.sh.rotation.set(-2.8,0,-0.35);
        this.hips.position.y+=Math.abs(Math.sin(t*5))*0.08;
        break;
      case 'entrance': {
        const e = 1-Math.pow(1-k,3);
        this.hips.position.y = 0.98 + (1-e)*7;
        this.armL.sh.rotation.set(-2.6,0,0.4); this.armR.sh.rotation.set(-2.6,0,-0.4);
        this.legL.hip.rotation.x=-0.5; this.legR.hip.rotation.x=0.35;
        break;
      }
      default: break;
    }
    if (A.name!=='lift' && A.name!=='channel') this.floatH += (0-this.floatH)*Math.min(1,dt*5);
    if (A.name!=='cast'&&A.name!=='channel'&&A.name!=='grab'){ this.armL.light.intensity*=0.8; this.armR.light.intensity*=0.8; }
    if (this.crest) this.crest.rotation.z = Math.sin(time*7)*0.12;
    if (this.downPose>0){
      this.group.rotation.x = -Math.PI/2*this.downPose*0.94;
      this.hips.position.y = 0.98*(1-this.downPose)+0.35*this.downPose;
    } else this.group.rotation.x = 0;
    const f = this.hitFlash;
    for (const mt of this.mats){ if(mt.emissive) mt.emissiveIntensity = 2.2 + f*4; }
    const targetOp = this.invisible?0.13:1;
    for (const mt of this.mats){ mt.transparent = targetOp<1; mt.opacity += (targetOp-mt.opacity)*Math.min(1,dt*6); }
  }
  palm(side='R') { return this.palmPos(side); }
  chest() { return this.chestPos(); }
  palmPos(side='R') {
    const arm = side==='R'?this.armR:this.armL;
    const p = new THREE.Vector3();
    arm.palm.getWorldPosition(p);
    return p;
  }
  chestPos() { const p=new THREE.Vector3(); this.coreGem.getWorldPosition(p); return p; }
  headPos() { const p=new THREE.Vector3(); this.headMesh.getWorldPosition(p); return p; }
  dispose(scene){ scene.remove(this.group); }
}
