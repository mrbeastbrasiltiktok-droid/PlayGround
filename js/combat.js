// Combat: pooled projectiles, hitscan resolution, shields, zones, barrels.
import * as THREE from 'three';
import { sfx } from './audio.js';
const _v1=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3();
export class Combat {
  constructor(scene,world,vfx){
    this.scene=scene; this.world=world; this.vfx=vfx;
    this.projectiles=[]; this.zones=[]; this.shields=[];
    this.projGeo=new THREE.SphereGeometry(1,10,8);
    this.onEvent=null; // (type, data) -> match hooks (damage numbers, killfeed, sounds)
  }
  clear(){ for(const p of this.projectiles) this.scene.remove(p.mesh);
    for(const z of this.zones) this.scene.remove(z.mesh);
    for(const s of this.shields) this.scene.remove(s.mesh);
    this.projectiles.length=0; this.zones.length=0; this.shields.length=0; }
  fireProjectile(owner,origin,dir,spec){
    const color=spec.color??0xffcc55;
    const mesh=new THREE.Mesh(this.projGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}));
    mesh.scale.setScalar(spec.size??0.3); mesh.position.copy(origin); this.scene.add(mesh);
    this.projectiles.push({mesh,pos:mesh.position.clone(),vel:dir.clone().multiplyScalar(spec.speed??30),
      team:owner.team,owner,dmg:spec.dmg,splash:spec.splash??0,life:spec.range?(spec.range/(spec.speed??30)):2.2,
      heal:spec.heal??0,radius:spec.size??0.3,color,grav:spec.grav??0});
    sfx(spec.sfx||'orb',{vol:0.7});
  }
  hitscan(owner,origin,dir,dmg,range,falloff,color=0xffe27a){
    // shield interception
    let end=_v1.copy(origin).addScaledVector(dir,range).clone();
    for(const s of this.shields){ if(s.team===owner.team) continue;
      if(rayHitsShield(origin,dir,s)){ end.copy(s.pos); this.damageShield(s,dmg,owner); this.vfx.impact(end,color,8); return {hit:'shield'}; } }
    // characters: closest along ray
    let best=null,bestT=range;
    for(const c of this.chars||[]){ if(!c.alive||c.team===owner.team||c.untargetable>0) continue;
      _v2.copy(c.center()); _v3.subVectors(_v2,origin);
      const t=_v3.dot(dir); if(t<0||t>bestT) continue;
      const perp=_v3.addScaledVector(dir,-t).length();
      const r=c.heroId==='aegis'?0.85:0.65;
      if(perp<r){ // LOS check
        if(this.world.losBlocked(origin,_v2)) continue;
        best=c; bestT=t; } }
    if(best){ end.copy(origin).addScaledVector(dir,bestT);
      this.vfx.impact(end,color,6); return {hit:'char',char:best,dist:bestT,point:end.clone()}; }
    // world: march to find wall
    for(let t=0;t<range;t+=0.8){ _v2.copy(origin).addScaledVector(dir,t);
      if(this.world.losBlocked(origin,_v2)){ end.copy(_v2); this.vfx.impact(end,color,4); return {hit:'world',point:end.clone()}; } }
    return {hit:'none',point:end};
  }
  melee(owner,origin,dir,range,arc,dmg){
    let hitAny=false;
    for(const c of this.chars||[]){ if(!c.alive||c.team===owner.team||c.untargetable>0) continue;
      _v2.copy(c.center()).sub(origin); const dist=_v2.length();
      if(dist>range+0.6) continue;
      _v2.normalize(); if(_v2.dot(dir)<Math.cos(arc)) continue;
      if(this.world.losBlocked(origin,c.center())) continue;
      this.onEvent&&this.onEvent('damage',{from:owner,to:c,amount:dmg,point:c.center(),melee:true});
      hitAny=true; }
    return hitAny;
  }
  damageShield(s,amount,from){ s.hp-=amount; s.mesh.material.opacity=0.25+0.3*Math.max(0,s.hp/s.max);
    this.onEvent&&this.onEvent('shieldhit',{shield:s,from});
    if(s.hp<=0){ this.scene.remove(s.mesh); this.shields.splice(this.shields.indexOf(s),1);
      this.vfx.shockwave(s.pos,4,0x27e0ff); sfx('explosion',{vol:0.5}); } }
  deployShield(owner,pos,yaw,hp,dur,w=4,h=2.6,color=0x27e0ff){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    mesh.position.copy(pos); mesh.position.y+=h/2; mesh.rotation.y=yaw; this.scene.add(mesh);
    const n=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    this.shields.push({mesh,team:owner.team,hp,max:hp,dur,pos:mesh.position.clone(),n,w,h,owner});
    sfx('wall'); return mesh;
  }
  addZone(spec){ // {pos,r,dur,tick,type,team,owner,dmg|heal,color}
    let mesh;
    if(spec.type==='dome'){
      mesh=new THREE.Mesh(new THREE.SphereGeometry(spec.r,18,12,0,Math.PI*2,0,Math.PI/2),
        new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    } else {
      mesh=new THREE.Mesh(new THREE.CylinderGeometry(spec.r,spec.r,0.25+ (spec.h||0),24,1,true),
        new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:0.4,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    }
    mesh.position.copy(spec.pos); this.scene.add(mesh);
    const z={...spec,mesh,t:0,tickT:0}; this.zones.push(z);
    if(spec.type==='meteor'){ // delayed strike handled by tick
      this.vfx.shockwave(spec.pos,2,0xff6a00); }
    return z;
  }
  explode(pos,r,dmg,team,owner,falloff=true,color=0xff9d00){
    this.vfx.explosion(pos,r);
    sfx('explosion',{vol:0.9});
    for(const c of this.chars||[]){ if(!c.alive) continue;
      if(c.team===team&&owner.heroId!=='inferno') continue; // no friendly fire (except self-splash for rocket leap)
      const d=c.pos.distanceTo(pos);
      if(d<r+0.7){ if(this.world.losBlocked(_v1.set(pos.x,pos.y+0.5,pos.z),c.center())) continue;
        const k=falloff?Math.max(0.25,1-d/(r+0.7)):1;
        const amt=dmg*k*(c===owner?0.4:1);
        this.onEvent&&this.onEvent('damage',{from:owner,to:c,amount:amt,point:c.center(),aoe:true});
        // knockback
        _v2.subVectors(c.pos,pos).setY(0).normalize();
        c.vel.addScaledVector(_v2,3.2*k); c.vel.y+=2.2*k; } }
    // barrels chain
    for(const b of this.world.barrels){ if(!b.alive) continue;
      if(b.pos.distanceTo(pos)<r+1){ this.detonateBarrel(b,owner); } }
  }
  detonateBarrel(b,owner){
    if(!b.alive) return; b.alive=false; b.m.visible=false;
    this.explode(b.pos.clone().setY(1),5,80,owner?owner.team:'X',owner||{team:'X',heroId:'x'});
  }
  update(dt){
    // projectiles
    for(let i=this.projectiles.length-1;i>=0;i--){ const p=this.projectiles[i];
      p.life-=dt; p.vel.y-= (p.grav||0)*dt;
      p.pos.addScaledVector(p.vel,dt);
      this.vfx.trail(p.pos,p.color);
      let dead=p.life<=0||p.pos.y<0.02;
      // shields
      if(!dead) for(const s of this.shields){ if(s.team===p.team) continue;
        _v1.subVectors(p.pos,s.pos); const dn=Math.abs(_v1.dot(s.n));
        const side=_v1.clone().addScaledVector(s.n,-_v1.dot(s.n));
        if(dn<0.4&&Math.abs(side.x)+Math.abs(side.z)<s.w/2&&p.pos.y<s.pos.y+s.h/2+0.4&&p.pos.y>s.pos.y-s.h/2){
          this.damageShield(s,p.dmg,p.owner); this.vfx.impact(p.pos,p.color,6); dead=true; break; } }
      // characters
      if(!dead) for(const c of this.chars||[]){
        if(!c.alive) continue;
        if(c.untargetable>0) continue;
        if(p.pos.distanceToSquared(c.center())>Math.pow(0.75+p.radius,2)) continue;
        if(p.heal){ // heal orb: heals allies, passes through enemies
          if(c.team===p.team&&c.hp<c.maxHp){
            this.onEvent&&this.onEvent('heal',{from:p.owner,to:c,amount:p.heal,point:c.center()});
            this.vfx.impact(p.pos,p.color,6); dead=true; break; }
          continue; }
        if(c.team===p.team) continue;
        this.onEvent&&this.onEvent('damage',{from:p.owner,to:c,amount:p.dmg,point:p.pos.clone()});
        if(p.splash){ this.explode(p.pos.clone(),p.splash,p.dmg,p.team,p.owner,true); }
        else this.vfx.impact(p.pos,p.color,6);
        dead=true; break;
      }
      // heal orbs also heal on ground proximity? skip
      // world hit
      if(!dead){ _v1.copy(p.pos); _v1.y=Math.max(0.1,_v1.y);
        // crude wall check: bounds + tall colliders
        if(Math.abs(p.pos.x)>29||Math.abs(p.pos.z)>25){ dead=true; }
        else { for(const col of this.world.colliders){ if(col.barrel&&!col.barrel.alive) continue;
          if(p.pos.x>col.min.x&&p.pos.x<col.max.x&&p.pos.y>col.min.y&&p.pos.y<col.max.y&&p.pos.z>col.min.z&&p.pos.z<col.max.z){
            if(col.barrel&&col.barrel.alive&&p.team!==undefined){ this.detonateBarrel(col.barrel,p.owner); }
            if(p.splash) this.explode(p.pos.clone(),p.splash,p.dmg,p.team,p.owner,true);
            else this.vfx.impact(p.pos,p.color,6);
            dead=true; break; } } } }
      p.mesh.position.copy(p.pos);
      if(dead){ this.scene.remove(p.mesh); p.mesh.material.dispose(); this.projectiles.splice(i,1); } }
    // zones
    for(let i=this.zones.length-1;i>=0;i--){ const z=this.zones[i]; z.t+=dt; z.tickT+=dt;
      z.mesh.material.opacity=0.3+Math.sin(z.t*6)*0.08;
      if(z.mesh.rotation) z.mesh.rotation.y+=dt*0.6;
      if(z.type==='meteor'&&!z.struck&&z.t>=z.delay){ z.struck=true; this.explode(z.pos.clone(),z.r,z.dmg,z.team,z.owner,true); }
      else if(z.tickT>= (z.rate||0.5)&&z.type!=='meteor'&&z.type!=='dome'){
        z.tickT=0;
        for(const c of this.chars||[]){ if(!c.alive) continue;
          const d=Math.hypot(c.pos.x-z.pos.x,c.pos.z-z.pos.z);
          if(d<z.r){ if(z.type==='firewall'&&c.team!==z.team) this.onEvent&&this.onEvent('damage',{from:z.owner,to:c,amount:z.dmg,point:c.center(),dot:true});
            if(z.type==='pylon'&&c.team===z.team) this.onEvent&&this.onEvent('heal',{from:z.owner,to:c,amount:z.heal,point:c.center()});
            if(z.type==='lance'&&c.team!==z.team){ this.onEvent&&this.onEvent('damage',{from:z.owner,to:c,amount:z.dmg,point:c.center(),dot:true});
              this.vfx.beam(_v1.set(z.pos.x,18,z.pos.z),c.center(),0xb49bff,0.3,0.1); } } } }
      if(z.t>=z.dur){ this.scene.remove(z.mesh); z.mesh.material.dispose(); this.zones.splice(i,1); } }
    // shields decay
    for(let i=this.shields.length-1;i>=0;i--){ const s=this.shields[i]; s.dur-=dt;
      if(s.dur<=0){ this.scene.remove(s.mesh); s.mesh.material.dispose(); this.shields.splice(i,1); } }
  }
}
function rayHitsShield(o,d,s){
  // plane intersect
  const denom=d.dot(s.n); if(Math.abs(denom)<1e-4) return false;
  _v2.subVectors(s.pos,o); const t=_v2.dot(s.n)/denom; if(t<0||t>60) return false;
  _v3.copy(o).addScaledVector(d,t).sub(s.pos);
  return Math.abs(_v3.x)+Math.abs(_v3.z)<s.w/2+0.3 && _v3.y>-s.h/2&&_v3.y<s.h/2;
}
