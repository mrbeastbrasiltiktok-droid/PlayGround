// Match: teams, spawns, scoring, objectives, respawns, announcements, stats.
import * as THREE from 'three';
import { Character } from './character.js';
import { BotAI } from './bots.js';
import { HERO_MAP } from './config.js';
import { sfx } from './audio.js';
const NAMES_A=['YOU','PIP','JUNO']; const NAMES_B=['VIPER','HALO','GRIM'];
export class Match {
  constructor(opts){
    this.scene=opts.scene; this.world=opts.world; this.combat=opts.combat; this.vfx=opts.vfx;
    this.camera=opts.camera; this.ui=opts.ui; this.mode=opts.mode; this.playerHero=opts.heroId;
    this.chars=[]; this.bots=[]; this.state='countdown'; this.timeLeft=opts.mode==='training'?Infinity:(opts.mode==='tdm'?360:360);
    this.scoreA=0; this.scoreB=0; this.capA=0; this.capB=0; this.capProgress=0; this.holder=null;
    this.overtime=false; this.endInfo=null; this.t=0;
    this.combat.chars=this.chars;
    this.combat.onEvent=(type,d)=>this.onCombatEvent(type,d);
    this.buildTeams();
  }
  ctx(){ return {world:this.world,combat:this.combat,vfx:this.vfx,camera:this.camera,match:this,ui:this.ui,input:null}; }
  buildTeams(){
    const pool=['aegis','volt','hexa','ronin','inferno','spectre'];
    const pick=(ex)=>{ const c=pool.filter(h=>!ex.includes(h)); return c[Math.floor(Math.random()*c.length)]; };
    const used=[this.playerHero];
    // player team: player + 2 bots (ensure a healer often)
    const mates=[pick(used)]; used.push(mates[0]);
    if(!used.includes('hexa')&&Math.random()<0.6) mates.push('hexa'); else mates.push(pick(used)); used.push(mates[1]);
    const foes=[pick(used)]; used.push(foes[0]); foes.push(pick(used)); used.push(foes[1]); foes.push(pick(used));
    const mk=(heroId,team,isBot,name)=>{ const ch=new Character(this.scene,HERO_MAP[heroId],team,isBot,name);
      ch.isPlayer=!isBot; this.chars.push(ch); if(isBot) this.bots.push(new BotAI(ch,this));
      else this.player=ch; return ch; };
    mk(this.playerHero,'A',false,'YOU');
    mates.forEach((h,i)=>mk(h,'A',true,NAMES_A[i+1]));
    foes.forEach((h,i)=>mk(h,'B',true,NAMES_B[i]));
    // spawn
    this.chars.forEach((c,i)=>{ const sp=this.spawnOf(c.team,i); c.spawnAt(sp); });
    this.player.ultCharge=20;
  }
  spawnOf(team,i=0){ const arr=team==='A'?this.world.spawnsA:this.world.spawnsB;
    return arr[(i??Math.floor(Math.random()*3))%arr.length].clone(); }
  pointPos(){ return this.world.point.clone().setY(0); }
  pointHeldBy(c){ return Math.hypot(c.pos.x-this.world.point.x,c.pos.z-this.world.point.z)<this.world.pointR&&c.pos.y<2; }
  onCombatEvent(type,d){
    if(type==='damage'){ this.applyDamage(d.from,d.to,d.amount,d.point,d.melee); }
    else if(type==='heal'){ const real=d.to.heal(d.amount,d.from);
      if(real>0){ this.vfx.healFx(d.point); this.vfx.damageNumber(d.point,real,this.camera,true);
        if(d.from===this.player) sfx('heal',{vol:0.4}); } }
    else if(type==='shieldhit'){ this.vfx.impact(d.shield.pos,0x27e0ff,4); }
  }
  applyDamage(from,to,amount,point,melee){
    if(this.state!=='play'||!to.alive) return;
    if(from&&from.team===to.team) return; // no friendly fire
    // damage falloff for hitscan already in range; melee full
    const real=to.takeDamage(amount,from);
    if(from){ from.dmgDealt+=real; from.addUlt(real*0.06); }
    to.addUlt?.(0);
    this.vfx.damageNumber(point||to.center(),real,this.camera,false,melee);
    if(from===this.player){ this.ui.hitmarker(melee||real>=50);
      // crosshair pulse handled by UI
    }
    if(!to.alive){ this.onKill(from,to,point); }
    else if(to===this.player){ this.ui.damageFlash(); sfx('hurt',{vol:0.5}); }
    else sfx('hitmark',{vol:from===this.player?0.5:0.15});
  }
  onKill(killer,victim,point){
    victim.deaths; killer&&(killer.kills++,killer.killStreak++,(killer===this.player&&sfx('kill')));
    killer&&killer.addUlt(18);
    this.vfx.explosion(victim.pos.clone().setY(1),2.5);
    this.ui.killfeed(killer?killer.name:'—',victim.name,killer?killer.team:'A',victim.team,killer?victim===this.player||killer===this.player:false);
    if(victim===this.player){ this.ui.showRespawn(killer?killer.name:'',4); }
    if(this.mode==='tdm'){ if(killer) (killer.team==='A'?this.scoreA++:this.scoreB++);
      this.ui.announceScore(this.scoreA,this.scoreB,30);
      if(this.scoreA>=30||this.scoreB>=30) this.finish(this.scoreA>=30?'A':'B','ELIMINATION TARGET REACHED'); }
    // killer streak announcements
    if(killer&&killer.killStreak===3) this.ui.toast(`🔥 ${killer.name} is on a RAMPAGE`);
    if(killer&&killer.killStreak===5) this.ui.toast(`⚡ ${killer.name} is UNSTOPPABLE`);
  }
  announceUlt(ch){ this.ui.ultBanner(`${ch.name} — ${ch.def.ult.name}!`); }
  update(dt,input){
    this.t+=dt;
    if(this.state==='countdown'){ /* handled by ui countdown then state=play */ return; }
    if(this.state!=='play') return;
    if(this.timeLeft!==Infinity){ this.timeLeft-=dt;
      if(this.timeLeft<=10&&this.timeLeft>0&&Math.ceil(this.timeLeft)!==this._lastTick){ this._lastTick=Math.ceil(this.timeLeft); sfx('count'); }
      if(this.timeLeft<=0){ this.timeLeft=0;
        if(this.mode==='control'&&(Math.abs(this.capA-this.capB)<5||this.contested())){ this.overtime=true; this.ui.toast('OVERTIME — point decides it!'); sfx('announce'); }
        else this.decideOnTime(); } }
    // objective: control
    if(this.mode==='control'&&!this.overtime||this.mode==='control'&&this.overtime){
      let nA=0,nB=0;
      for(const c of this.chars){ if(!c.alive) continue;
        if(this.pointHeldBy(c)){ c.objTime+=dt; c.team==='A'?nA++:nB++; } }
      const contested=nA>0&&nB>0;
      if(!contested){
        if(nA>0){ this.capA=Math.min(100,this.capA+dt*(4+nA*2.2)); this.holder='A'; }
        else if(nB>0){ this.capB=Math.min(100,this.capB+dt*(4+nB*2.2)); this.holder='B'; }
        else this.holder=null;
      }
      if(this.capA>=100) this.finish('A','POINT CAPTURED');
      if(this.capB>=100) this.finish('B','POINT CAPTURED');
      if(this.overtime&&!contested&&(nA>0||nB>0)){ /* sudden death continues until cap */ }
    }
    // respawns
    for(const c of this.chars){ if(!c.alive){ c.respawnT-=dt;
      if(c===this.player) this.ui.updateRespawn(Math.ceil(c.respawnT));
      if(c.respawnT<=0&&this.state==='play'){ c.spawnAt(this.spawnOf(c.team)); c.group.rotation.x=0;
        this.vfx.burst(c.pos,10,c.team==='A'?0x27e0ff:0xff4d6d,4,0.5,1,3);
        if(c===this.player) this.ui.hideRespawn(); } } }
    // bots
    for(const b of this.bots) b.update(dt);
    // barrels respawn
    for(const b of this.world.barrels){ if(!b.alive){ b._t=(b._t||0)+dt; if(b._t>20){b._t=0;b.alive=true;b.m.visible=true;} } }
    // HUD
    this.ui.updateHUD(this);
  }
  contested(){ let nA=0,nB=0; for(const c of this.chars){ if(!c.alive)continue; if(this.pointHeldBy(c)) c.team==='A'?nA++:nB++; } return nA>0&&nB>0; }
  decideOnTime(){
    if(this.mode==='control'){ if(this.capA!==this.capB) this.finish(this.capA>this.capB?'A':'B','HIGHER CAPTURE %');
      else { const kA=this.teamKills('A'),kB=this.teamKills('B'); this.finish(kA>=kB?'A':'B','TIEBREAK: ELIMINATIONS'); } }
    else if(this.mode==='tdm'){ this.finish(this.scoreA>=this.scoreB?'A':'B','TIME EXPIRED'); }
  }
  teamKills(t){ return this.chars.filter(c=>c.team===t).reduce((s,c)=>s+c.kills,0); }
  finish(winner,reason){
    if(this.state!=='play') return;
    this.state='over'; this.winner=winner; this.endReason=reason;
    // victory poses
    for(const c of this.chars){ if(c.team===winner&&c.alive){ c.anim.state='victory'; c.fireHeld=false; } }
    const mvp=[...this.chars].sort((a,b)=>(b.kills*3+b.dmgDealt*0.01+b.healDone*0.008+b.objTime*0.2)-(a.kills*3+a.dmgDealt*0.01+a.healDone*0.008+a.objTime*0.2))[0];
    this.endInfo={winner,reason,mvp};
    if(winner==='A'){ sfx('win'); } else sfx('lose');
    setTimeout(()=>this.ui.showResults(this),2200);
  }
  dispose(){ for(const c of this.chars) this.scene.remove(c.group); this.combat.clear(); }
}
