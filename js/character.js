// Character: third-person controller + camera + per-hero combat kit.
import * as THREE from 'three';
import { buildHeroMesh } from './models.js';
import { Animator } from './anim.js';
import { sfx } from './audio.js';
const _f=new THREE.Vector3(), _r=new THREE.Vector3(), _m=new THREE.Vector3(), _c=new THREE.Vector3();
let UID=1;
export class Character {
  constructor(scene,def,team,isBot,name){
    this.uid=UID++; this.heroId=def.id; this.def=def; this.team=team; this.isBot=!!isBot;
    this.name=name||(isBot?'BOT-'+def.name:'YOU');
    const built=buildHeroMesh(def);
    this.group=built.group; this.joints=built.joints;
    this.joints.teamRing.material.color.set(team==='A'?0x27e0ff:0xff4d6d);
    scene.add(this.group);
    this.anim=new Animator(this.joints);
    this.pos=this.group.position; this.vel=new THREE.Vector3();
    this.yaw=Math.random()*Math.PI*2; this.pitch=-0.08;
    this.hp=def.hp; this.maxHp=def.hp; this.alive=true; this.respawnT=0;
    this.ammo=def.weapon.mag??Infinity; this.reloading=false; this.reloadT=0;
    this.fireCd=0; this.cdE=0; this.cdS=0; this.ultCharge=0; this.ultActive=0; this.ultReadyPlayed=false;
    this.chargeShot=0; this.aiming=false; this.grounded=true; this.groundY=0;
    this.speedBuff=0; this.fireBuff=0; this.dmgBuff=1; this.slashBonus=0; this.untargetable=0;
    this.kills=0; this.deaths=0; this.dmgDealt=0; this.healDone=0; this.objTime=0;
    this.hitT=0; this.stepT=0; this.fireHeld=false; this.killStreak=0;
    this.camDist=4.4;
  }
  center(){ return _c.set(this.pos.x,this.pos.y+1.35,this.pos.z); }
  muzzle(){ // gun tip approx: right hand forward
    _m.set(this.pos.x+Math.sin(this.yaw)*0.9, this.pos.y+1.45+Math.sin(this.pitch)*0.8, this.pos.z+Math.cos(this.yaw)*0.9);
    return _m;
  }
  aimDir(){ _f.set(Math.sin(this.yaw)*Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw)*Math.cos(this.pitch)); return _f; }
  spawnAt(p,yaw){ this.pos.copy(p); this.yaw=yaw??(this.team==='A'?0:Math.PI); this.pitch=-0.05;
    this.hp=this.maxHp; this.alive=true; this.ammo=this.def.weapon.mag??Infinity;
    this.vel.set(0,0,0); this.group.visible=true; this.group.rotation.set(0,this.yaw,0);
    this.cdE=0; this.cdS=0; this.ultActive=0; this.untargetable=0; }
  takeDamage(amount,from){
    if(!this.alive) return 0;
    if(this.ultActive>0&&this.heroId==='aegis') amount*=0.5; // dome DR
    amount=Math.max(1,Math.round(amount));
    this.hp-=amount; this.hitT=0.25; this.anim.triggerHit();
    if(from&&from.isPlayer) from._lastHitT=performance.now();
    if(this.hp<=0){ this.hp=0; this.die(from); }
    return amount;
  }
  heal(amount,from){
    if(!this.alive) return 0;
    const real=Math.min(amount,this.maxHp-this.hp); this.hp+=real;
    if(from) from.healDone+=real;
    return real;
  }
  die(from){
    this.alive=false; this.deaths++; this.killStreak=0; this.respawnT=4; this.fireHeld=false;
    this.ultActive=0;
    sfx('kill',{vol:0.5});
  }
  addUlt(n){ if(!this.alive) return; this.ultCharge=Math.min(100,this.ultCharge+n);
    if(this.ultCharge>=100&&!this.ultReadyPlayed){ this.ultReadyPlayed=true; if(this.isPlayer) sfx('ult_ready'); } }
  // ---- per-frame ----
  update(dt,ctx){
    const {world,combat,vfx,camera,match,input}=ctx;
    if(!this.alive){ // death pose: sink (respawn timer owned by Match)
      this.group.rotation.x+= ( -Math.PI/2 - this.group.rotation.x)*Math.min(1,dt*4);
      this.group.position.y=Math.max(-0.6,this.group.position.y-dt*0.2);
      return;
    }
    this.group.rotation.x=0;
    // timers
    this.fireCd-=dt; this.cdE-=dt; this.cdS-=dt; this.hitT-=dt; this.untargetable-=dt;
    if(this.speedBuff>0)this.speedBuff-=dt; if(this.fireBuff>0)this.fireBuff-=dt;
    if(this.ultActive>0){ this.ultActive-=dt; this.anim.state='ult';
      if(this.ultActive<=0){ this.anim.state='idle'; if(this.heroId==='volt'){this.fireBuff=0;} } }
    else if(this.anim.state==='ult') this.anim.state='idle';
    this.joints.aura && (this.anim.ultReady=this.ultCharge>=100);
    // --- movement ---
    let mx=0,mz=0;
    if(this.isPlayer&&input){ mx=input.move.x; mz=input.move.y; this.aiming=input.aiming; }
    else if(this._botMove){ mx=this._botMove.x; mz=this._botMove.y; }
    const speed=this.def.speed*(this.speedBuff>0?1.4:1)*(this.aiming?0.6:1)*(this.heroId==='ronin'&&this.ultActive>0?1.8:1);
    _r.set(Math.sin(this.yaw),0,Math.cos(this.yaw)); // forward
    _f.set(_r.z,0,-_r.x); // right? careful: right = forward × up
    _f.set(Math.cos(this.yaw),0,-Math.sin(this.yaw)).multiplyScalar(-1); // right vector
    // recompute cleanly:
    const fx=Math.sin(this.yaw), fz=Math.cos(this.yaw);
    const rx=Math.cos(this.yaw), rz=-Math.sin(this.yaw);
    const wishX=fx*mz+rx*mx, wishZ=fz*mz+rz*mx;
    const accel=this.grounded?34:10;
    this.vel.x+=(wishX*speed-this.vel.x)*Math.min(1,dt*(this.grounded?10:2.5));
    this.vel.z+=(wishZ*speed-this.vel.z)*Math.min(1,dt*(this.grounded?10:2.5));
    // gravity/jump
    this.vel.y-=22*dt;
    this.pos.x+=this.vel.x*dt; this.pos.z+=this.vel.z*dt; this.pos.y+=this.vel.y*dt;
    // collide + ground
    const g=world.collide(this.pos,0.45,1.7);
    this.groundY=g;
    if(this.pos.y<=g){ if(!this.grounded&&this.vel.y<-8){ sfx('land',{vol:0.4}); vfx.burst(this.pos,6,0x8899bb,3,0.4,1,2);} this.pos.y=g; this.vel.y=0; this.grounded=true; }
    else this.grounded=this.pos.y-g<0.05;
    // mesh transform
    this.group.rotation.y=this.yaw+Math.PI; // model faces +Z? built facing +Z... adjust
    this.group.rotation.y=this.yaw;
    // footsteps
    const hSpeed=Math.hypot(this.vel.x,this.vel.z);
    if(this.grounded&&hSpeed>2){ this.stepT-=dt*hSpeed; if(this.stepT<=0){ this.stepT=9; if(!this.isBot||Math.random()<0.5) sfx('step',{vol:0.25}); } }
    // animation
    this.anim.aimPitch=this.pitch; this.anim.update(dt,hSpeed,!this.grounded);
    // aim assist for player
    // reload
    if(this.reloading){ this.reloadT-=dt; if(this.reloadT<=0){ this.reloading=false; this.ammo=this.def.weapon.mag; } }
    else if(this.ammo===0) this.startReload();
    // continuous fire
    if(this.fireHeld) this.tryFire(ctx);
    // passive ult charge
    this.addUlt(dt*1.1);
    // heal pylon/firewall ticks handled by combat zones
  }
  startReload(){ if(this.reloading||this.def.weapon.mag===undefined) return;
    this.reloading=true; this.reloadT=1.4; sfx('reload'); }
  jump(){ if(this.alive&&this.grounded){ this.vel.y=8.2; this.grounded=false; sfx('jump',{vol:0.4}); } }
  tryFire(ctx){
    if(!this.alive||this.fireCd>0||this.reloading) return;
    const w=this.def.weapon;
    if(this.ammo<=0){ this.startReload(); return; }
    const rateMul=(this.fireBuff>0?1.6:1)*(this.ultActive>0&&this.heroId==='aegis'?2:1);
    this.fireCd=(60/w.rpm)/rateMul;
    const origin=this.muzzle().clone(), dir=this.aimDir().clone();
    // spread
    const sp=w.spread??0.02;
    dir.x+=(Math.random()-0.5)*sp*2; dir.y+=(Math.random()-0.5)*sp*2; dir.z+=(Math.random()-0.5)*sp*2; dir.normalize();
    this.anim.triggerFire();
    const dmgMul=this.dmgBuff*(this.slashBonus>0?1.5:1);
    if(w.type==='hitscan'){
      this.ammo--;
      const {combat,vfx}=ctx;
      vfx.muzzle(origin,dir,this.team==='A'?0x27e0ff:0xff8ba0);
      const res=combat.hitscan(this,origin,dir,w.dmg*dmgMul,w.range,w.falloff,this.team==='A'?0x9be8ff:0xffb3c1);
      vfx.beam(origin,res.point||origin.clone().addScaledVector(dir,w.range),this.team==='A'?0x9be8ff:0xffb3c1,0.09,0.1);
      sfx(this.heroId==='spectre'?'rail':'shoot',{vol:0.55});
      this.jolt(0.35);
      if(res.hit==='char'){ ctx.match.applyDamage(this,res.char,w.dmg*dmgMul,res.point,false); }
      this.addUlt(3);
      if(this.ultActive>0&&this.heroId==='volt'){ // chain lightning
        for(const c of matchChars(ctx)){ if(c.alive&&c.team!==this.team&&c!==res.char&&c.pos.distanceTo(res.point||origin)<7){
          ctx.match.applyDamage(this,c,30,res.point||origin,false); vfx.beam(res.point||origin,c.center(),0xf6ff5c,0.12,0.15); break; } }
      }
      if(this.ammo===0) this.startReload();
    } else if(w.type==='projectile'){
      this.ammo--;
      const {combat}=ctx;
      const spec={speed:w.speed,size:w.size,splash:w.splash,range:w.range,dmg:w.dmg*dmgMul,
        color:this.heroId==='inferno'?0xff6a00:this.heroId==='hexa'?0x37e08b:0xffcc55, sfx:this.heroId==='inferno'?'shoot_heavy':'orb'};
      if(this.heroId==='hexa'&&this.aiming){ spec.heal=70; spec.color=0x37e08b; } // alt: heal orb
      combat.fireProjectile(this,origin,dir,spec);
      this.jolt(0.5);
      this.addUlt(3);
      if(this.ammo===0) this.startReload();
    } else if(w.type==='melee'){
      sfx('melee',{vol:0.6});
      const {combat,vfx}=ctx;
      const bonus=this.slashBonus>0; if(bonus) this.slashBonus=0;
      const hit=combat.melee(this,origin.clone().setY(this.pos.y+1.3),dir,w.range,w.arc,w.dmg*dmgMul*(this.ultActive>0?1.4:1));
      vfx.shockwave(this.pos.clone().setY(1),bonus?4:2.5,this.def.colors.glow);
      this.jolt(0.7);
      this.addUlt(hit?7:2);
    } else if(w.type==='charged'){ // spectre railgun: instant but heavy
      this.ammo--;
      const {combat,vfx}=ctx;
      vfx.muzzle(origin,dir,0xb49bff);
      const res=combat.hitscan(this,origin,dir,w.dmg*dmgMul,w.range,w.falloff,0xb49bff);
      vfx.beam(origin,res.point||origin.clone().addScaledVector(dir,w.range),0xb49bff,0.16,0.22);
      sfx('rail',{vol:0.7});
      this.jolt(1.2);
      if(res.hit==='char') ctx.match.applyDamage(this,res.char,w.dmg*dmgMul,res.point,true);
      this.addUlt(4);
      if(this.ammo===0) this.startReload();
    }
  }
  jolt(k){ this._jolt=(this._jolt||0)+k; }
  useAbility(slot,ctx){
    if(!this.alive) return false;
    const {combat,vfx,match}=ctx;
    const origin=this.muzzle().clone(), dir=this.aimDir().clone();
    if(slot==='E'){
      if(this.cdE>0) return false;
      this.cdE=this.def.abilities[0].cd; this.anim.triggerCast(); sfx('ability');
      switch(this.heroId){
        case 'aegis': combat.deployShield(this,this.pos.clone().addScaledVector(dir,2.5),this.yaw,450,6); vfx.wallFx(this.pos,4,2.6,0x27e0ff); break;
        case 'volt': { const o=origin; const d=dir.clone(); d.y=Math.max(d.y,0.15); d.normalize();
          combat.fireProjectile(this,o,d,{speed:22,size:0.4,splash:5,range:40,dmg:70,color:0xf6ff5c,sfx:'shoot_heavy',grav:8}); this.vel.addScaledVector(dir,-2); break; }
        case 'hexa': { const d=dir.clone(); d.y=Math.max(d.y+0.35,0.4); d.normalize();
          combat.fireProjectile(this,origin,d,{speed:18,size:0.45,splash:5,range:35,dmg:40,heal:90,color:0x37e08b,grav:6}); vfx.healFx(origin); break; }
        case 'ronin': for(let i=-1;i<=1;i++){ const d=dir.clone(); const a=Math.atan2(d.x,d.z)+i*0.12; d.set(Math.sin(a),d.y,Math.cos(a));
          combat.fireProjectile(this,origin,d,{speed:30,size:0.25,range:30,dmg:30,color:0xff4d6d,sfx:'melee'}); } break;
        case 'inferno': { const p=this.pos.clone().addScaledVector(dir,4); p.y=this.groundY;
          combat.addZone({pos:p,r:3,dur:6,rate:0.5,type:'firewall',team:this.team,owner:this,dmg:25,color:0xff6a00}); break; }
        case 'spectre': { // recon pulse: reveal + damage
          vfx.shockwave(this.pos.clone().setY(1),14,0xb49bff); sfx('ability');
          for(const c of match.chars){ if(c.alive&&c.team!==this.team&&c.pos.distanceTo(this.pos)<26){
            match.applyDamage(this,c,40,c.center(),false); c._revealed=5; } } break; }
      }
      this.addUlt(6); return true;
    } else {
      if(this.cdS>0) return false;
      this.cdS=this.def.abilities[1].cd; sfx('dash');
      switch(this.heroId){
        case 'aegis': { // seismic charge dash + slam
          this.vel.addScaledVector(dir,22); this.vel.y=3; this._slamArmed=0.5;
          setTimeout(()=>{},0); break; }
        case 'volt': this.pos.addScaledVector(dir,9); this.pos.y=Math.max(this.groundY,this.pos.y); this.speedBuff=1; vfx.burst(this.pos,12,0x27e0ff,5,0.4,1,2); break;
        case 'hexa': { const p=this.pos.clone(); p.y=this.groundY;
          combat.addZone({pos:p,r:4,dur:6,rate:0.5,type:'pylon',team:this.team,owner:this,heal:30,color:0x37e08b}); break; }
        case 'ronin': { // shadow step behind nearest visible enemy
          let best=null,bd=18; for(const c of match.chars){ if(!c.alive||c.team===this.team) continue;
            const d=c.pos.distanceTo(this.pos); if(d<bd){bd=d;best=c;} }
          if(best){ const a=Math.atan2(this.pos.x-best.pos.x,this.pos.z-best.pos.z);
            this.pos.set(best.pos.x+Math.sin(a)*1.6,this.pos.y,best.pos.z+Math.cos(a)*1.6);
            this.yaw=Math.atan2(best.pos.x-this.pos.x,best.pos.z-this.pos.z);
            this.slashBonus=5; } else this.pos.addScaledVector(dir,8);
          vfx.burst(this.pos,14,0xff4d6d,6,0.4,1,2); break; }
        case 'inferno': this.vel.y=11; this.vel.addScaledVector(dir,6); this._rocketSlam=true; vfx.explosion(this.pos,2); break;
        case 'spectre': this.pos.addScaledVector(dir,14); this.pos.y=Math.max(this.groundY+0.5,this.pos.y+1); this.untargetable=Math.max(this.untargetable,0.4);
          vfx.burst(this.pos,16,0xb49bff,6,0.5,1,2); break;
      }
      this.addUlt(6); return true;
    }
  }
  useUlt(ctx){
    if(!this.alive||this.ultCharge<100) return false;
    const {combat,vfx,match}=ctx;
    this.ultCharge=0; this.ultReadyPlayed=false; this.ultActive=this.ultDuration();
    this.anim.triggerCast(); this.anim.state='ult'; sfx('ult');
    ctx.match.announceUlt(this);
    const dir=this.aimDir().clone();
    switch(this.heroId){
      case 'aegis': { const p=this.pos.clone(); combat.addZone({pos:p,r:6,dur:6,rate:1,type:'dome',team:this.team,owner:this,color:0x27e0ff});
        combat.deployShield(this,this.pos.clone().addScaledVector(dir,1),this.yaw,900,6,12,3.2,0x27e0ff);
        this.heal(150,this); break; }
      case 'volt': this.fireBuff=8; this.ammo=999; break;
      case 'hexa': for(const c of match.chars){ if(c.alive&&c.team===this.team){ c.heal(220,this); vfx.healFx(c.pos.clone().setY(1)); c.ultCharge=Math.min(100,c.ultCharge+20);} }
        vfx.shockwave(this.pos.clone().setY(1),12,0x37e08b); break;
      case 'ronin': this.speedBuff=Math.max(this.speedBuff,5); break;
      case 'inferno': { const target=this.pos.clone().addScaledVector(dir,14); target.y=0;
        combat.addZone({pos:target,r:8,dur:1.4,rate:9,type:'meteor',delay:1.2,team:this.team,owner:this,dmg:170,color:0xff4400});
        vfx.shockwave(target,3,0xff4400); if(ctx.ui) ctx.ui.toast('☄ INFERNO calls STARFALL — clear the zone!'); break; }
      case 'spectre': { const target=this.pos.clone().addScaledVector(dir,16); target.y=0;
        combat.addZone({pos:target,r:6,dur:4,rate:0.5,type:'lance',team:this.team,owner:this,dmg:45,color:0xb49bff}); break; }
    }
    return true;
  }
  ultDuration(){ return {aegis:6,volt:8,hexa:1,ronin:5,inferno:1,spectre:1}[this.heroId]??3; }
  // landing slam checks (aegis charge / inferno rocket)
  postMove(dt,ctx){
    if(this._slamArmed!==undefined&&this._slamArmed>0){ this._slamArmed-=dt;
      for(const c of ctx.match.chars){ if(!c.alive||c.team===this.team) continue;
        if(c.pos.distanceTo(this.pos)<3){ ctx.match.applyDamage(this,c,60,c.center(),false);
          c.vel.y+=7; ctx.vfx.shockwave(this.pos.clone().setY(0.5),4,0xffb300); this._slamArmed=0; break; } }
      if(this._slamArmed<=0&&this._slamArmed>-1){ ctx.vfx.shockwave(this.pos.clone().setY(0.3),5,0xffb300); sfx('explosion',{vol:0.5}); this._slamArmed=-2; } }
    if(this._rocketSlam&&this.grounded&&this.vel.y<=0.1){ this._rocketSlam=false;
      ctx.combat.explode(this.pos.clone(),4.5,70,this.team,this,true); }
  }
}
function matchChars(ctx){ return ctx.match?ctx.match.chars:[]; }
