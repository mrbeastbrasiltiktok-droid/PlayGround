// Procedural hero models: properly connected hierarchical rigs (no floating parts).
// Rig joints: root > hips > torso > head; shoulderL/R > elbow > hand; hipL/R > knee > foot.
// Accessories per hero built from primitives but parented to joints.
import * as THREE from 'three';
function mat(color,opts={}){ return new THREE.MeshStandardMaterial({color,roughness:0.55,metalness:0.35,...opts}); }
function em(color,intensity=1.2){ return new THREE.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:intensity,roughness:0.4,metalness:0.1}); }
export function buildHeroMesh(def){
  const C=def.colors;
  const g=new THREE.Group();
  const joints={};
  const M={
    main:mat(C.main), trim:mat(C.trim,{metalness:0.6,roughness:0.35}),
    dark:mat(0x141824,{roughness:0.7}), skin:mat(C.skin,{roughness:0.8,metalness:0}),
    glow:em(C.glow,1.6), white:mat(0xeef2ff,{roughness:0.5}),
  };
  const root=new THREE.Group(); g.add(root); joints.root=root;
  const hips=new THREE.Group(); hips.position.y=1.02; root.add(hips); joints.hips=hips;
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(0.21,12,10),M.dark); pelvis.scale.set(1.15,0.8,0.9); hips.add(pelvis);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(0.21,0.035,8,18),M.trim); belt.rotation.x=Math.PI/2; belt.position.y=0.08; hips.add(belt);
  const torso=new THREE.Group(); torso.position.y=0.12; hips.add(torso); joints.torso=torso;
  const chest=new THREE.Mesh(new THREE.CapsuleGeometry(0.21,0.34,6,12),M.main); chest.position.y=0.32; torso.add(chest);
  const chestPlate=new THREE.Mesh(new THREE.SphereGeometry(0.2,12,10),M.trim); chestPlate.scale.set(1,1.15,0.55); chestPlate.position.set(0,0.36,0.13); torso.add(chestPlate);
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(0.07),M.glow); core.position.set(0,0.36,0.24); torso.add(core); joints.core=core;
  const neck=new THREE.Group(); neck.position.y=0.62; torso.add(neck);
  const head=new THREE.Group(); head.position.y=0.12; neck.add(head); joints.head=head;
  const skull=new THREE.Mesh(new THREE.SphereGeometry(0.155,14,12),M.skin); skull.scale.set(0.92,1.08,0.95); head.add(skull);
  const visor=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,8,0,Math.PI*2,0,1.5),M.glow); visor.position.set(0,0.02,0.045); head.add(visor);
  // hair/helmet per hero
  addHelmet(head,M,def);
  function limb(side,top){
    const sh=new THREE.Group(); sh.position.set(0.28*side,(top?0.52:0.02),0); (top?torso:hips).add(sh);
    const up=new THREE.Mesh(new THREE.CapsuleGeometry(top?0.075:0.095,top?0.26:0.34,4,10),top?M.main:M.dark);
    up.position.y=top?-0.16:-0.2; sh.add(up);
    const mid=new THREE.Group(); mid.position.y=top?-0.32:-0.42; sh.add(mid);
    const lo=new THREE.Mesh(new THREE.CapsuleGeometry(top?0.065:0.08,top?0.24:0.32,4,10),top?M.skin:M.main);
    lo.position.y=top?-0.13:-0.18; mid.add(lo);
    const end=new THREE.Group(); end.position.y=top?-0.28:-0.4; mid.add(end);
    if(top){ const hand=new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),M.skin); hand.scale.set(0.9,1.2,0.9); end.add(hand);
      const glove=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.08,10),M.trim); glove.position.y=0.06; end.add(glove);
      // weapon in right hand
      if(side>0){ const w=buildWeapon(def,M); w.position.set(0,-0.06,0.14); end.add(w); joints.weapon=w; }
      else { const g2=buildOffhand(def,M); if(g2){g2.position.set(0,-0.08,0.1); end.add(g2);} }
    } else { const foot=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.26),M.trim); foot.position.set(0,-0.03,0.06); end.add(foot); }
    return {top:sh,mid,end};
  }
  joints.armL=limb(-1,true); joints.armR=limb(1,true);
  joints.legL=limb(-1,false); joints.legR=limb(1,false);
  // shoulder pads connected to torso (not floating: overlap shoulder joint)
  for(const s of [-1,1]){ const pad=new THREE.Mesh(new THREE.SphereGeometry(0.115,10,8),M.trim);
    pad.scale.set(1,0.75,1); pad.position.set(0.29*s,0.5,0); torso.add(pad); }
  // hero flair
  addFlair(g,joints,M,def);
  // shadow blob
  const sh=new THREE.Mesh(new THREE.CircleGeometry(0.45,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.35,depthWrite:false}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.02; g.add(sh);
  // team ring
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.62,28),new THREE.MeshBasicMaterial({color:0x27e0ff,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.03; g.add(ring); joints.teamRing=ring;
  // ultimate aura
  const aura=new THREE.Mesh(new THREE.SphereGeometry(0.9,12,10),new THREE.MeshBasicMaterial({color:C.glow,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  aura.position.y=1.1; g.add(aura); joints.aura=aura;
  g.traverse(o=>{ if(o.isMesh){o.castShadow=true;} });
  return {group:g,joints,mats:M};
}
function addHelmet(head,M,def){
  const id=def.id;
  if(id==='aegis'){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.17,12,8,0,Math.PI*2,0,1.4),M.trim); h.position.y=0.04; head.add(h);
    const fin=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.16,0.2),M.glow); fin.position.set(0,0.2,-0.02); head.add(fin); }
  else if(id==='volt'){ for(const s of [-1,1]){ const spike=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.22,8),M.glow); spike.position.set(0.1*s,0.16,0); spike.rotation.z=-0.5*s; head.add(spike);} }
  else if(id==='hexa'){ const halo=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.02,8,24),M.glow); halo.position.y=0.24; halo.rotation.x=Math.PI/2.3; head.add(halo); }
  else if(id==='ronin'){ const band=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.07,14),M.trim); band.position.y=0.08; head.add(band);
    const knot=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.3,0.03),M.trim); knot.position.set(-0.1,0,-0.15); knot.rotation.z=0.3; head.add(knot); }
  else if(id==='inferno'){ const crown=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.2,8),M.trim); crown.position.y=0.2; head.add(crown);
    const fl=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.18,7),M.glow); fl.position.y=0.36; head.add(fl); }
  else { const hood=new THREE.Mesh(new THREE.ConeGeometry(0.19,0.3,10,1,true),M.main); hood.position.y=0.12; head.add(hood); }
}
function buildWeapon(def,M){
  const w=new THREE.Group(); const id=def.id;
  if(id==='ronin'){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.045,0.85),M.trim); b.position.z=0.4; w.add(b);
    const e=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.5),M.glow); e.position.z=0.75; w.add(e); }
  else if(id==='spectre'){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.05,0.9,8),M.dark); b.rotation.x=Math.PI/2; b.position.z=0.35; w.add(b);
    const coil=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.02,8,12),M.glow); coil.position.z=0.5; w.add(coil); }
  else if(id==='hexa'){ const orb=new THREE.Mesh(new THREE.SphereGeometry(0.09,12,10),M.glow); orb.position.z=0.15; w.add(orb);
    const h=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.02,8,16),M.trim); h.position.z=0.15; w.add(h); }
  else if(id==='inferno'){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,0.5,8),M.dark); b.rotation.x=Math.PI/2; b.position.z=0.2; w.add(b);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),M.glow); tip.position.z=0.45; w.add(tip); }
  else { const b=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.12,0.55),M.dark); b.position.z=0.25; w.add(b);
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.4,8),M.trim); bar.rotation.x=Math.PI/2; bar.position.z=0.6; w.add(bar);
    const sight=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6),M.glow); sight.position.set(0,0.09,0.2); w.add(sight); }
  return w;
}
function buildOffhand(def,M){
  if(def.id==='aegis'){ const s=new THREE.Group(); const p=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.3),M.trim); s.add(p);
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.38),new THREE.MeshBasicMaterial({color:def.colors.glow,transparent:true,opacity:0.5,side:THREE.DoubleSide})); gl.rotation.y=Math.PI/2; gl.position.x=-0.05; s.add(gl); return s; }
  if(def.id==='hexa'){ const o=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),M.glow); return o; }
  return null;
}
function addFlair(g,joints,M,def){
  if(def.id==='aegis'){ const cape=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.7,1,3),new THREE.MeshStandardMaterial({color:0x12306e,roughness:0.9,side:THREE.DoubleSide})); cape.position.set(0,1.35,-0.24); cape.rotation.x=0.15; joints.torso.add(cape); joints.cape=cape; }
  if(def.id==='ronin'){ const sc=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.6,8),M.dark); sc.position.set(-0.15,1.15,-0.25); sc.rotation.z=0.7; joints.torso.add(sc); }
  if(def.id==='inferno'){ for(const s of [-1,1]){ const pa=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.2,6),M.glow); pa.position.set(0.29*s,1.72,0); joints.torso.add(pa);} }
  if(def.id==='spectre'){ const cl=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.8),new THREE.MeshStandardMaterial({color:0x241a55,roughness:0.9,side:THREE.DoubleSide,transparent:true,opacity:0.95})); cl.position.set(0,1.3,-0.26); joints.torso.add(cl); joints.cape=cl; }
}
