// Procedural animation: blended poses for idle/run/jump/fire/cast/hit/death/victory.
export class Animator {
  constructor(joints){ this.j=joints; this.t=0; this.state='idle'; this.blend=1;
    this.fireT=9; this.castT=9; this.hitT=9; this.deathT=0; this.victT=0; this.moveAmt=0; this.grounded=true; this.aimPitch=0; }
  setState(s){ if(this.state!==s){this.state=s;} }
  triggerFire(){ this.fireT=0; } triggerCast(){ this.castT=0; } triggerHit(){ this.hitT=0; }
  update(dt,moveSpeed,airborne){
    this.t+=dt; this.fireT+=dt; this.castT+=dt; this.hitT+=dt;
    const j=this.j, t=this.t;
    const run = Math.min(1, moveSpeed/5);
    this.moveAmt += ((run)-this.moveAmt)*Math.min(1,dt*8);
    const r=this.moveAmt, idle=1-r;
    // base: hips bob + breathing
    const bob = Math.sin(t*(4+r*7))*0.035*(0.4+r);
    j.root.position.y = bob;
    j.torso.rotation.x = -0.06*r + Math.sin(t*2)*0.015*idle + (airborne?-0.12:0) + this.aimPitch*0.25;
    j.torso.rotation.y = 0;
    j.head.rotation.x = -this.aimPitch*0.35;
    // arms swing
    const sw = Math.sin(t*(6+r*6))*0.7*r;
    const aimRaise = -0.9; // arms raised when in combat
    const combat = 0.65;
    j.armL.top.rotation.x = sw*0.8 + Math.sin(t*2)*0.04*idle + aimRaise*combat;
    j.armR.top.rotation.x = -sw*0.8 + Math.sin(t*2+1)*0.04*idle + aimRaise*combat + this.aimPitch*0.3;
    j.armL.top.rotation.z = 0.15; j.armR.top.rotation.z = -0.15;
    // fire recoil
    if(this.fireT<0.18){ const k=1-this.fireT/0.18; j.armR.top.rotation.x -= 0.35*k; j.root.position.z = -0.03*k; }
    // cast pose (both arms up)
    if(this.castT<0.5){ const k=Math.sin(Math.min(1,this.castT/0.5)*Math.PI); j.armL.top.rotation.x=-2.2*k-0.3; j.armR.top.rotation.x=-2.2*k-0.3; j.torso.rotation.x=-0.25*k; }
    // elbows
    j.armL.mid.rotation.x = -0.5 - r*0.3; j.armR.mid.rotation.x = -0.5 - r*0.3;
    // legs: run cycle (no foot slide illusion: swing + knee bend phased)
    if(!airborne){
      const ph=t*(7+r*5);
      const s1=Math.sin(ph), s2=Math.sin(ph+Math.PI);
      j.legL.top.rotation.x = s1*0.8*r; j.legR.top.rotation.x = s2*0.8*r;
      j.legL.mid.rotation.x = Math.max(0,-s1)*1.1*r + 0.06; j.legR.mid.rotation.x = Math.max(0,-s2)*1.1*r + 0.06;
      j.legL.top.rotation.x += idle*Math.sin(t*2)*0.02; j.legR.top.rotation.x += idle*Math.sin(t*2+2)*0.02;
    } else {
      j.legL.top.rotation.x = 0.35; j.legR.top.rotation.x = -0.25;
      j.legL.mid.rotation.x = 0.9; j.legR.mid.rotation.x = 0.5;
      j.armL.top.rotation.z = 0.7; j.armR.top.rotation.z = -0.7;
    }
    // landing crouch handled by caller via root scale? keep simple: hips dip
    // hit flinch
    if(this.hitT<0.25){ const k=1-this.hitT/0.25; j.torso.rotation.z=0.25*k; j.head.rotation.z=-0.2*k; }
    else { j.torso.rotation.z*=0.9; j.head.rotation.z*=0.9; }
    // cape wave
    if(j.cape){ j.cape.rotation.x = 0.15 + Math.sin(t*3)*0.08 + r*0.5 + (airborne?0.5:0); }
    // aura pulse (ult ready / active)
    if(j.aura){ const target = (this.state==='ult')?0.35:(this.ultReady?0.12:0);
      j.aura.material.opacity += (target-j.aura.material.opacity)*Math.min(1,dt*4);
      const s=1+Math.sin(t*5)*0.05; j.aura.scale.set(s,s,s); }
    // victory pose
    if(this.state==='victory'){ j.armL.top.rotation.x=-2.8; j.armR.top.rotation.x=-2.8; j.torso.rotation.x=-0.15; j.root.position.y=Math.abs(Math.sin(t*3))*0.08; }
    // death handled by character (fall over), keep joints relaxed
  }
}
