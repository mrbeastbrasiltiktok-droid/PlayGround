// Bot AI: objective play, target selection, aiming w/ error, abilities, retreat, respawn.
import * as THREE from 'three';
const _d=new THREE.Vector3();
export class BotAI {
  constructor(char,match){ this.c=char; this.m=match; this.thinkT=Math.random()*0.3;
    this.strafe=Math.random()<0.5?-1:1; this.strafeT=0; this.target=null; this.tgtT=0;
    this.dest=null; this.abilityT=2+Math.random()*3; this.skill=0.45+Math.random()*0.35; }
  update(dt){
    const c=this.c, m=this.m;
    if(!c.alive){ c._botMove={x:0,y:0}; c.fireHeld=false; return; }
    this.thinkT-=dt; this.tgtT-=dt; this.strafeT-=dt; this.abilityT-=dt;
    if(this.strafeT<=0){ this.strafeT=1+Math.random()*2; if(Math.random()<0.6) this.strafe*=-1; }
    if(this.thinkT<=0){ this.think(); this.thinkT=0.25+Math.random()*0.2; }
    // steering
    let mx=0,my=0;
    if(this.dest){ _d.subVectors(this.dest,c.pos); _d.y=0; const dist=_d.length();
      if(dist>1.2){ const want=Math.atan2(_d.x,_d.z);
        let rel=want-c.yaw; while(rel>Math.PI)rel-=Math.PI*2; while(rel<-Math.PI)rel+=Math.PI*2;
        // bots turn towards movement when far, towards target when close
        if(!this.target||dist>6){ c.yaw+=Math.max(-3*dt,Math.min(3*dt,rel*4*dt*3)); }
        my=1; mx=this.target?this.strafe*0.7:0;
        if(dist<2.5&&m.mode==='control'&&m.pointHeldBy(c)) { my=0.1; mx=this.strafe*0.3; }
      } }
    c._botMove={x:mx,y:my};
    // aim at target with error + reaction
    if(this.target&&this.target.alive){
      _d.copy(this.target.center()).sub(c.center());
      const dist=_d.length();
      const wantYaw=Math.atan2(_d.x,_d.z);
      const wantPitch=Math.asin(Math.max(-1,Math.min(1,_d.y/dist)));
      const err=(1-this.skill)*0.25+ (dist>25?0.08:0);
      const jx=(Math.random()-0.5)*err, jy=(Math.random()-0.5)*err;
      const turn=4.5*this.skill+1.5;
      c.yaw+=clampAngle(wantYaw+jx-c.yaw)*Math.min(1,dt*turn);
      c.pitch+=(wantPitch+jy-c.pitch)*Math.min(1,dt*turn);
      // fire decision
      const inRange=dist<(c.def.weapon.range??40);
      const los=!m.world.losBlocked(c.center(),this.target.center());
      c.fireHeld=inRange&&los&&Math.abs(clampAngle(wantYaw-c.yaw))<0.3;
      if(c.heroId==='hexa'&&this.allyHurt&&this.allyHurt.alive){ // heal ally instead sometimes
        _d.copy(this.allyHurt.center()).sub(c.center());
        c.yaw=Math.atan2(_d.x,_d.z); c.aiming=true; c.fireHeld=true;
      } else c.aiming=c.heroId==='spectre';
      // abilities
      if(this.abilityT<=0&&dist<20&&los){ this.abilityT=3+Math.random()*4;
        const ctx=m.ctx();
        if(Math.random()<0.6) c.useAbility('E',ctx); else c.useAbility('SHIFT',ctx);
        if(c.ultCharge>=100&&Math.random()<0.7) c.useUlt(ctx); }
      // jump occasionally in duel
      if(Math.random()<dt*0.4&&dist<10) c.jump();
    } else { c.fireHeld=false; c.aiming=false; }
  }
  think(){
    const c=this.c, m=this.m;
    // target: nearest visible enemy, prefer low HP / close / objective carriers
    let best=null,bs=-1e9;
    for(const e of m.chars){ if(!e.alive||e.team===c.team||e.untargetable>0) continue;
      const d=e.pos.distanceTo(c.pos); if(d>45) continue;
      if(d>6&&m.world.losBlocked(c.center(),e.center())) continue;
      let score=60-d*1.2+(e.maxHp-e.hp)*0.15;
      if(e.isPlayer) score+=4;
      if(m.mode==='control'&&m.pointHeldBy(e)) score+=8;
      if(score>bs){bs=score;best=e;} }
    this.target=best;
    // ally hurt (hexa)
    this.allyHurt=null;
    if(c.heroId==='hexa'){ for(const a of m.chars){ if(a.team===c.team&&a.alive&&a.hp<a.maxHp*0.6){ this.allyHurt=a; break; } } }
    // destination
    if(m.mode==='control'){
      const lowHp=c.hp<c.maxHp*0.3;
      if(lowHp&&Math.random()<0.5){ // retreat to spawn a bit
        this.dest=m.spawnOf(c.team).clone(); this.dest.x+=(Math.random()-0.5)*4;
      } else {
        this.dest=m.pointPos().clone(); this.dest.x+=(Math.random()-0.5)*7; this.dest.z+=(Math.random()-0.5)*7;
        // flankers offset
        if(c.heroId==='ronin'||c.heroId==='volt'){ this.dest.x+=(c.team==='A'?1:-1)*6*Math.random(); }
        if(this.target&&Math.random()<0.4){ this.dest=this.target.pos.clone(); }
      }
    } else if(m.mode==='tdm'){
      this.dest=this.target?this.target.pos.clone():m.pointPos().clone();
    } else { this.dest=this.target?this.target.pos.clone():new THREE.Vector3((Math.random()-0.5)*20,0,(Math.random()-0.5)*20); }
  }
}
function clampAngle(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }
