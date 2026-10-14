import * as THREE from 'three';

// ============ FREE FIRE 3D — Battle Royale demo (phone/tablet + desktop) ============
const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const WEAPONS = {
  ak:    { name:'AK-47',  slot:'RIFLE',  dmg:24, rpm:540, mag:30, reserve:90,  spread:0.028, range:130, auto:true,  reload:2.1, color:0x8a5a2b, len:1.1 },
  mp5:   { name:'MP5',    slot:'SMG',    dmg:16, rpm:800, mag:32, reserve:96,  spread:0.045, range:70,  auto:true,  reload:1.8, color:0x222831, len:0.8 },
  awm:   { name:'AWM',    slot:'SNIPER', dmg:95, rpm:42,  mag:5,  reserve:15,  spread:0.004, range:300, auto:false, reload:3.2, color:0x2e7d4f, len:1.35 },
  fist:  { name:'FISTS',  slot:'MELEE',  dmg:12, rpm:120, mag:Infinity, reserve:Infinity, spread:0.05, range:3.2, auto:true, reload:0, color:0x000000, len:0.3 },
};

const BOT_NAMES = ['Blaze','Viper','Ghost','Raptor','Nova','Falcon','Storm','Jax','Kilo','Echo','Onyx','Zed'];

// ---------- Audio (procedural, no assets) ----------
let AC = null, soundOn = true;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function beep(freq,dur,type='square',vol=0.12,slide=0){
  if(!soundOn) return; const ac=audio(); if(!ac) return;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,ac.currentTime);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),ac.currentTime+dur);
  g.gain.setValueAtTime(vol,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime+dur);
}
const SFX = {
  shoot:(w)=>{ beep(w==='awm'?140:520, w==='awm'?0.35:0.11, 'sawtooth', 0.14, -300); },
  hit:()=>beep(1200,0.07,'square',0.1),
  kill:()=>{ beep(700,0.12,'square',0.14); setTimeout(()=>beep(1050,0.18,'square',0.14),110); },
  hurt:()=>beep(180,0.2,'sawtooth',0.16,-80),
  pickup:()=>beep(880,0.09,'sine',0.12,220),
  reload:()=>beep(300,0.12,'square',0.08,150),
  med:()=>{ beep(520,0.15,'sine',0.12,200); setTimeout(()=>beep(780,0.2,'sine',0.12,200),140); },
  zone:()=>beep(240,0.5,'sawtooth',0.12,-120),
  win:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.25,'square',0.12),i*160));},
  click:()=>beep(600,0.06,'square',0.08),
};

// ---------- Renderer / scene ----------
let renderer, scene, camera, sunLight;
let HIGH_DETAIL = true;
try{
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
}catch(e){
  document.querySelector('.tagline').textContent = 'WebGL not available on this device.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, IS_TOUCH?1.8:2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x9fc3e5, 60, 340);
camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 800);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3d5a3a, 0.95));
sunLight = new THREE.DirectionalLight(0xfff2d9, 1.6);
sunLight.position.set(80,120,40);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

// sky dome (cheap gradient)
{
  const c=document.createElement('canvas'); c.width=4; c.height=256;
  const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#2f6fd0'); gr.addColorStop(0.55,'#87b5e0'); gr.addColorStop(0.75,'#cfe8f5'); gr.addColorStop(1,'#e8f3ff');
  g.fillStyle=gr; g.fillRect(0,0,4,256);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(700,16,12), new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false}));
  scene.add(sky);
}

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- World ----------
const WORLD = 440; // playable half = 220
const obstacles = []; // {x,z,hx,hz} AABB for collision + LOS block
const colliders = [];
function addBoxCollider(x,z,hx,hz){ const c={x,z,hx,hz}; obstacles.push(c); colliders.push(c); return c; }
function collideCircle(px,pz,r){
  for(const c of colliders){
    const cx = clamp(px, c.x-c.hx, c.x+c.hx), cz = clamp(pz, c.z-c.hz, c.z+c.hz);
    const dx=px-cx, dz=pz-cz, d2=dx*dx+dz*dz;
    if(d2 < r*r){
      if(d2>1e-6){ const d=Math.sqrt(d2); px=cx+dx/d*r; pz=cz+dz/d*r; }
      else { px = c.x + (px>=c.x? c.hx+r : -(c.hx+r)); }
    }
  }
  const lim = WORLD/2 - 4;
  px = clamp(px,-lim,lim); pz = clamp(pz,-lim,lim);
  return [px,pz];
}
function losBlocked(ax,az,bx,bz){
  // 2D segment vs AABB (houses block sight)
  for(const c of obstacles){
    // sample 8 points
    for(let t=0.1;t<1;t+=0.12){
      const x=ax+(bx-ax)*t, z=az+(bz-az)*t;
      if(Math.abs(x-c.x)<c.hx && Math.abs(z-c.z)<c.hz) return true;
    }
  }
  return false;
}

// Ground with painted texture
{
  const c=document.createElement('canvas'); c.width=c.height=512;
  const g=c.getContext('2d');
  g.fillStyle='#5da24a'; g.fillRect(0,0,512,512);
  for(let i=0;i<2600;i++){ g.fillStyle=`rgba(${40+Math.random()*60|0},${120+Math.random()*70|0},${40+Math.random()*40|0},0.5)`; const s=1+Math.random()*3; g.fillRect(Math.random()*512,Math.random()*512,s,s); }
  g.strokeStyle='rgba(0,0,0,0.08)'; for(let i=0;i<=8;i++){ g.beginPath(); g.moveTo(i*64,0); g.lineTo(i*64,512); g.stroke(); g.beginPath(); g.moveTo(0,i*64); g.lineTo(512,i*64); g.stroke(); }
  // roads
  g.strokeStyle='#9a8a6a'; g.lineWidth=14; g.beginPath(); g.moveTo(0,256); g.lineTo(512,256); g.stroke();
  g.beginPath(); g.moveTo(256,0); g.lineTo(256,512); g.stroke();
  g.strokeStyle='#c9bb8f'; g.lineWidth=3; g.setLineDash([10,10]); g.beginPath(); g.moveTo(0,256); g.lineTo(512,256); g.stroke();
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,6); tex.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD+160,WORLD+160), new THREE.MeshLambertMaterial({map:tex}));
  ground.rotation.x=-Math.PI/2; scene.add(ground);
  // water ring
  const water=new THREE.Mesh(new THREE.RingGeometry(WORLD/2+40, 900, 48), new THREE.MeshBasicMaterial({color:0x2e7bcf}));
  water.rotation.x=-Math.PI/2; water.position.y=-0.4; scene.add(water);
}

const matTrunk=new THREE.MeshLambertMaterial({color:0x6b4a2b});
const matLeaf=new THREE.MeshLambertMaterial({color:0x2e7d3a});
const matLeaf2=new THREE.MeshLambertMaterial({color:0x3da14e});
const matRock=new THREE.MeshLambertMaterial({color:0x8d8d94});
const matWall=new THREE.MeshLambertMaterial({color:0xd9c9a8});
const matWall2=new THREE.MeshLambertMaterial({color:0xb8c7d9});
const matRoof=new THREE.MeshLambertMaterial({color:0xc0392b});
const matRoof2=new THREE.MeshLambertMaterial({color:0x2c3e50});
const matCrate=new THREE.MeshLambertMaterial({color:0x9c6b30});
const geoTrunk=new THREE.CylinderGeometry(0.35,0.5,3,6);
const geoLeaf=new THREE.ConeGeometry(2.2,4.5,7);
const geoRock=new THREE.DodecahedronGeometry(1.4,0);
const geoCrate=new THREE.BoxGeometry(1.6,1.6,1.6);

function addTree(x,z,s=1){
  const g=new THREE.Group();
  const t=new THREE.Mesh(geoTrunk,matTrunk); t.position.y=1.5*s; t.scale.setScalar(s); g.add(t);
  const l=new THREE.Mesh(geoLeaf,Math.random()<0.5?matLeaf:matLeaf2); l.position.y=(3+2)*s; l.scale.setScalar(s); g.add(l);
  const l2=new THREE.Mesh(geoLeaf,matLeaf); l2.position.y=(3+3.4)*s; l2.scale.setScalar(s*0.7); g.add(l2);
  g.position.set(x,0,z); g.rotation.y=Math.random()*6; scene.add(g);
}
function addRock(x,z,s=1){
  const m=new THREE.Mesh(geoRock,matRock); m.position.set(x,0.7*s,z); m.scale.setScalar(s); m.rotation.set(Math.random(),Math.random()*6,Math.random()); scene.add(m);
  if(s>1.2) addBoxCollider(x,z,1.1*s,1.1*s);
}
function addHouse(x,z,ry=0,style=0){
  const g=new THREE.Group();
  const w=rand(7,10), d=rand(6,9), h=3.4;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), style?matWall2:matWall);
  wall.position.y=h/2; g.add(wall);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.75,2.4,4), style?matRoof2:matRoof);
  roof.position.y=h+1.2; roof.rotation.y=Math.PI/4; g.add(roof);
  // door hole visual
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.4), new THREE.MeshBasicMaterial({color:0x1a120a}));
  door.position.set(0,1.2,d/2+0.01); g.add(door);
  // windows
  for(const sx of [-1,1]){
    const win=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1), new THREE.MeshBasicMaterial({color:0x9fd8ff}));
    win.position.set(sx*w*0.28,2,d/2+0.01); g.add(win);
  }
  g.position.set(x,0,z); g.rotation.y=ry; scene.add(g);
  // collider approx (axis aligned, inflate if rotated — use bounding)
  const hx=(Math.abs(Math.cos(ry))*w+Math.abs(Math.sin(ry))*d)/2, hz=(Math.abs(Math.sin(ry))*w+Math.abs(Math.cos(ry))*d)/2;
  addBoxCollider(x,z,hx,hz);
  return {x,z};
}
function addCrate(x,z){
  const m=new THREE.Mesh(geoCrate,matCrate); m.position.set(x,0.8,z); m.rotation.y=Math.random(); scene.add(m);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geoCrate), new THREE.LineBasicMaterial({color:0x4a2f10}));
  edge.position.copy(m.position); edge.rotation.copy(m.rotation); scene.add(edge);
  addBoxCollider(x,z,0.9,0.9);
}

const houseSpots=[];
{
  // deterministic-ish layout with randomness
  const spots=[[-70,-60,0.3],[60,-80,-0.4],[-20,10,0],[90,40,0.8],[-90,70,0.2],[10,-90,0],[40,90,-0.5],[-50,40,1.1],[120,-10,0.2],[-130,-20,-0.3],[0,50,0.6],[-10,-30,0.1],[150,120,0.4],[-150,130,-0.2]];
  spots.forEach(([x,z,ry],i)=>houseSpots.push(addHouse(x+rand(-6,6),z+rand(-6,6),ry,i%2)));
  for(let i=0;i<90;i++){ const x=rand(-200,200),z=rand(-200,200); if(Math.hypot(x,z)<12) continue; if(houseSpots.some(h=>Math.hypot(h.x-x,h.z-z)<14)&&Math.random()<0.7) continue; addTree(x,z,rand(0.8,1.6)); }
  for(let i=0;i<36;i++) addRock(rand(-200,200),rand(-200,200),rand(0.6,2.2));
  for(let i=0;i<26;i++) addCrate(rand(-180,180),rand(-180,180));
}

// Zone ring
const zoneMesh = new THREE.Mesh(new THREE.RingGeometry(0.96,1.0,72), new THREE.MeshBasicMaterial({color:0x37e0ff,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
zoneMesh.rotation.x=-Math.PI/2; zoneMesh.position.y=0.15; scene.add(zoneMesh);
const nextZoneMesh = new THREE.Mesh(new THREE.RingGeometry(0.96,1.0,72), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
nextZoneMesh.rotation.x=-Math.PI/2; nextZoneMesh.position.y=0.16; scene.add(nextZoneMesh);

// ---------- Characters ----------
function makeSoldier(color){
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color});
  const skin=new THREE.MeshLambertMaterial({color:0xe8b07d});
  const dark=new THREE.MeshLambertMaterial({color:0x222831});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.9,0.4),mat); body.position.y=1.15; g.add(body);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(0.76,0.5,0.46),dark); vest.position.y=1.2; g.add(vest);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.42),skin); head.position.y=1.85; g.add(head);
  const helm=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.2,0.5),dark); helm.position.y=2.1; g.add(helm);
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.7,0.24),dark); legL.position.set(-0.18,0.35,0); g.add(legL);
  const legR=legL.clone(); legR.position.x=0.18; g.add(legR);
  const armL=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.7,0.2),mat); armL.position.set(-0.48,1.2,0); g.add(armL);
  const armR=armL.clone(); armR.position.x=0.48; g.add(armR);
  const gun=new THREE.Group();
  const gm=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.16,1.0),new THREE.MeshLambertMaterial({color:0x111111}));
  gm.position.z=0.5; gun.add(gm);
  gun.position.set(0.48,1.35,0.3); g.add(gun);
  g.userData={legL,legR,armL,armR,gun,body,head,walk:Math.random()*6};
  return g;
}
function animateSoldier(g, moving, dt, crouch=false){
  const u=g.userData; u.walk+=dt*(moving?11:2);
  const a=moving?0.55:0.03;
  u.legL.rotation.x=Math.sin(u.walk)*a; u.legR.rotation.x=-Math.sin(u.walk)*a;
  u.armL.rotation.x=-Math.sin(u.walk)*a*0.7; u.armR.rotation.x=-0.9-(moving?Math.sin(u.walk)*0.1:0);
  g.scale.y = crouch?0.72:1;
}

// ---------- Loot ----------
const loots=[]; // {mesh,kind,wkey,ammo,meds,armor,x,z,taken}
const lootGeos={ gun:new THREE.BoxGeometry(0.9,0.3,0.25), box:new THREE.BoxGeometry(0.6,0.6,0.6) };
function spawnLoot(x,z,kind,wkey=null){
  let mesh;
  if(kind==='weapon'){
    const w=WEAPONS[wkey];
    mesh=new THREE.Group();
    const m=new THREE.Mesh(lootGeos.gun,new THREE.MeshLambertMaterial({color:w.color,emissive:w.color,emissiveIntensity:0.25}));
    m.scale.z=w.len; mesh.add(m);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.06,6,20),new THREE.MeshBasicMaterial({color:0xffcf5e}));
    ring.rotation.x=Math.PI/2; ring.position.y=-0.5; mesh.add(ring);
  } else if(kind==='med'){
    mesh=new THREE.Group();
    const b=new THREE.Mesh(lootGeos.box,new THREE.MeshLambertMaterial({color:0xffffff})); mesh.add(b);
    const c1=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.12,0.12),new THREE.MeshBasicMaterial({color:0xff2d2d})); mesh.add(c1);
    const c2=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.4,0.12),new THREE.MeshBasicMaterial({color:0xff2d2d})); mesh.add(c2);
  } else if(kind==='ammo'){
    mesh=new THREE.Group();
    const b=new THREE.Mesh(lootGeos.box,new THREE.MeshLambertMaterial({color:0x2e7bff})); b.scale.set(0.8,0.5,0.8); mesh.add(b);
  } else { // armor
    mesh=new THREE.Group();
    const b=new THREE.Mesh(lootGeos.box,new THREE.MeshLambertMaterial({color:0x37c8ff})); mesh.add(b);
  }
  // glow pillar
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3,8,1,true),new THREE.MeshBasicMaterial({color:kind==='weapon'?0xffcf5e:kind==='med'?0x2eff7a:0x37c8ff,transparent:true,opacity:0.25,side:THREE.DoubleSide}));
  pillar.position.y=1.2; mesh.add(pillar);
  mesh.position.set(x,0.8,z); scene.add(mesh);
  const L={mesh,kind,wkey,x,z,taken:false,phase:Math.random()*6};
  loots.push(L); return L;
}
function scatterLoot(){
  const spots=[...houseSpots];
  for(let i=0;i<40;i++) spots.push({x:rand(-190,190),z:rand(-190,190)});
  const wpool=['ak','ak','mp5','mp5','mp5','awm'];
  spots.forEach((s,i)=>{
    const x=s.x+rand(-5,5), z=s.z+rand(-5,5);
    const r=Math.random();
    if(r<0.4) spawnLoot(x,z,'weapon',wpool[i%wpool.length]);
    else if(r<0.62) spawnLoot(x,z,'ammo');
    else if(r<0.8) spawnLoot(x,z,'med');
    else spawnLoot(x,z,'armor');
  });
}
scatterLoot();

// ---------- Game state ----------
const G = {
  state:'menu', time:0, matchTime:0,
  alive:12, kills:0,
  zone:{ x:0,z:0,r:205, tx:0,tz:0,tr:205, phase:0, wait:20, shrink:30, t:0, mode:'wait',
    phases:[{r:150,wait:25,shrink:30,dmg:3},{r:100,wait:20,shrink:25,dmg:5},{r:60,wait:15,shrink:20,dmg:8},{r:30,wait:12,shrink:18,dmg:12},{r:8,wait:10,shrink:15,dmg:16},{r:0.5,wait:8,shrink:12,dmg:22}] },
  tracers:[], hits:[],
};

const player = {
  mesh:makeSoldier(0xff7a18), pos:new THREE.Vector3(0,0,120), vel:new THREE.Vector3(),
  yaw:Math.PI, pitch:-0.15, hp:200, maxHp:200, armor:0, speed:7,
  weapons:[{key:'ak',mag:WEAPONS.ak.mag,res:WEAPONS.ak.reserve}], cur:0,
  meds:2, alive:true, kills:0, firing:false, aiming:false, crouch:false, onGround:true, vy:0,
  lastShot:0, reloadingUntil:0, healUntil:0, bob:0, dmgDir:0,
};
scene.add(player.mesh);

function giveWeapon(key){
  const w=WEAPONS[key];
  const ex=player.weapons.find(v=>v.key===key);
  if(ex){ ex.res=Math.min(ex.res+w.reserve, 999); return 'ammo'; }
  if(player.weapons.length>=3 && !player.weapons.some(v=>v.key==='fist')){
    // replace current
    player.weapons[player.cur]={key,mag:w.mag,res:w.reserve};
  } else player.weapons.push({key,mag:w.mag,res:w.reserve});
  player.cur=player.weapons.findIndex(v=>v.key===key);
  return 'weapon';
}
function curW(){ return player.weapons[player.cur]; }
function curDef(){ return WEAPONS[curW().key]; }

// ---------- Bots ----------
const bots=[];
function spawnBots(n){
  const colors=[0x2e9bff,0xff3b6b,0x9b2eff,0x2effa3,0xfff02e,0x7a2eff,0xff2e9e,0x2effee,0xa3ff2e,0xff6b2e,0x2e6bff,0xd12eff];
  for(let i=0;i<n;i++){
    const mesh=makeSoldier(colors[i%colors.length]);
    const a=(i/n)*Math.PI*2+rand(-0.3,0.3);
    const pos=new THREE.Vector3(Math.cos(a)*rand(120,180),0,Math.sin(a)*rand(120,180));
    mesh.position.copy(pos); scene.add(mesh);
    bots.push({
      id:i, name:BOT_NAMES[i%BOT_NAMES.length]+'-'+(i+1), mesh, pos,
      hp:200, alive:true, yaw:rand(0,6), speed:rand(4.5,6.2),
      state:'loot', target:null, tx:rand(-150,150), tz:rand(-150,150),
      weapon:{key:Math.random()<0.6?'ak':'mp5',mag:30,res:90},
      wdef:null, nextShot:0, nextThink:rand(0,1), strafe:Math.random()<0.5?1:-1, strafeT:0,
      healT:0, vy:0, onGround:true, lastDmgFrom:null,
    });
    const b=bots[bots.length-1]; b.wdef=WEAPONS[b.weapon.key];
  }
}
spawnBots(11);

// ---------- Input ----------
const keys={};
window.addEventListener('keydown',e=>{ keys[e.code]=true;
  if(G.state==='playing'){
    if(e.code==='KeyR') startReload();
    if(e.code==='KeyE') tryPickup();
    if(e.code==='KeyQ') useMedkit();
    if(e.code==='Digit1') switchW(0);
    if(e.code==='Digit2') switchW(1);
    if(e.code==='Digit3') switchW(2);
    if(e.code==='KeyC') player.crouch=!player.crouch;
  }
  if(e.code==='KeyP'||e.code==='Escape'){ if(G.state==='playing') pauseGame(); }
});
window.addEventListener('keyup',e=>keys[e.code]=false);

// mouse look (pointer lock, desktop)
let locked=false;
canvas.addEventListener('click',()=>{ if(G.state==='playing'&&!IS_TOUCH&&!locked){ canvas.requestPointerLock?.(); }});
document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===canvas; });
document.addEventListener('mousemove',e=>{
  if(!locked||G.state!=='playing') return;
  const s=0.0022*(parseFloat($('set-sens').value)||1.3)*(player.aiming?0.5:1);
  player.yaw-=e.movementX*s; player.pitch=clamp(player.pitch-e.movementY*s,-1.2,0.6);
});
canvas.addEventListener('mousedown',e=>{ if(G.state==='playing'&&!IS_TOUCH&&(locked||e.button===0)) player.firing=true; });
window.addEventListener('mouseup',()=>{ if(!IS_TOUCH) player.firing=false; });
canvas.addEventListener('wheel',()=>{ if(G.state!=='playing')return; player.cur=(player.cur+1)%player.weapons.length; updateHUD(); SFX.click(); });

// touch joystick + look
const joy={x:0,y:0,id:null}; const stickEl=$('stick'), joyEl=$('joystick');
let lookId=null, lookLX=0, lookLY=0;
function setupTouch(){
  if(!IS_TOUCH) return;
  $('touch-ui').classList.remove('hidden');
  joyEl.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; joy.id=t.identifier; moveStick(t); },{passive:false});
  window.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===joy.id) moveStick(t);
      if(t.identifier===lookId){
        const s=0.005*(parseFloat($('set-sens').value)||1.3)*(player.aiming?0.5:1);
        player.yaw-=(t.clientX-lookLX)*s; player.pitch=clamp(player.pitch-(t.clientY-lookLY)*s,-1.2,0.6);
        lookLX=t.clientX; lookLY=t.clientY;
      }
    }
  },{passive:true});
  window.addEventListener('touchend',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===joy.id){ joy.id=null; joy.x=joy.y=0; stickEl.style.transform='translate(0px,0px)'; }
      if(t.identifier===lookId) lookId=null;
    }
  });
  $('look-area').addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; lookId=t.identifier; lookLX=t.clientX; lookLY=t.clientY; },{passive:false});
  const hold=(id,down,up)=>{ const el=$(id); el.addEventListener('touchstart',e=>{e.preventDefault();down();},{passive:false}); el.addEventListener('touchend',e=>{e.preventDefault();up&&up();},{passive:false}); };
  hold('btn-fire',()=>player.firing=true,()=>player.firing=false);
  hold('btn-aim',()=>{player.aiming=!player.aiming;SFX.click();});
  hold('btn-jump',()=>doJump());
  hold('btn-crouch',()=>{player.crouch=!player.crouch;SFX.click();});
  hold('btn-reload',()=>startReload());
}
function moveStick(t){
  const r=joyEl.getBoundingClientRect();
  let dx=t.clientX-(r.left+r.width/2), dy=t.clientY-(r.top+r.height/2);
  const m=Math.hypot(dx,dy), max=r.width/2-10;
  if(m>max){ dx*=max/m; dy*=max/m; }
  stickEl.style.transform=`translate(${dx}px,${dy}px)`;
  joy.x=dx/max; joy.y=dy/max;
}
$('btn-jump')?.addEventListener('click',()=>{ if(!IS_TOUCH) doJump(); });
$('btn-crouch')?.addEventListener('click',()=>{ if(!IS_TOUCH){player.crouch=!player.crouch;} });
$('btn-reload')?.addEventListener('click',()=>{ if(!IS_TOUCH) startReload(); });
$('btn-aim')?.addEventListener('click',()=>{ if(!IS_TOUCH){player.aiming=!player.aiming;} });
$('btn-med')?.addEventListener('click',()=>useMedkit());
$('btn-pickup')?.addEventListener('click',()=>tryPickup());
for(let i=0;i<3;i++) $('slot-'+i)?.addEventListener('click',()=>switchW(i));

// ---------- Actions ----------
function doJump(){ if(player.onGround&&player.alive&&G.state==='playing'){ player.vy=7.2; player.onGround=false; } }
function switchW(i){ if(i<player.weapons.length){ player.cur=i; updateHUD(); SFX.click(); } }
function startReload(){
  const w=curW(), d=curDef();
  if(!w||w.mag>=d.mag||w.res<=0||G.time<player.reloadingUntil) return;
  player.reloadingUntil=G.time+d.reload; SFX.reload();
  centerMsg(`RELOADING…`,900);
}
function useMedkit(){
  if(player.meds<=0||player.hp>=player.maxHp||G.time<player.healUntil||!player.alive) return;
  player.meds--; player.healUntil=G.time+3;
  SFX.med(); $('heal-flash').style.opacity=1; setTimeout(()=>$('heal-flash').style.opacity=0,800);
  centerMsg('HEALING…',1200);
}
let nearestLoot=null;
function tryPickup(){
  if(!nearestLoot||nearestLoot.taken) return;
  const L=nearestLoot; L.taken=true; scene.remove(L.mesh);
  SFX.pickup();
  if(L.kind==='weapon'){ const r=giveWeapon(L.wkey); feed(`YOU picked <b>${WEAPONS[L.wkey].name}</b>`); }
  else if(L.kind==='med'){ player.meds=Math.min(9,player.meds+1); feed('YOU picked <b>MEDKIT +1</b>'); }
  else if(L.kind==='ammo'){ const w=curW(); w.res=Math.min(999,w.res+30); feed('YOU picked <b>AMMO +30</b>'); }
  else if(L.kind==='armor'){ player.armor=Math.min(100,player.armor+50); feed('YOU picked <b>VEST +50</b>'); }
  updateHUD();
}

// ---------- Shooting ----------
const rayc=new THREE.Raycaster();
function shoot(from, yaw, pitch, def, owner){
  // muzzle world pos
  const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch)+0.03, -Math.cos(yaw)*Math.cos(pitch)).normalize();
  // spread
  dir.x+=rand(-def.spread,def.spread); dir.y+=rand(-def.spread,def.spread); dir.z+=rand(-def.spread,def.spread); dir.normalize();
  const origin=from.clone(); origin.y+=1.5;
  // obstacle range limit
  let maxD=def.range;
  // tracer end default
  let end=origin.clone().addScaledVector(dir,maxD);
  let hitBot=null, hitDist=maxD, head=false;
  const targets = owner==='player' ? bots.filter(b=>b.alive) : null;
  if(owner==='player'){
    for(const b of targets){
      const to=new THREE.Vector3(b.pos.x-origin.x,1.3-origin.y+1.5,b.pos.z-origin.z);
      // project
      const dist=to.length(); if(dist>maxD) continue;
      const nd=to.clone().normalize();
      if(nd.dot(dir)>0.9985 - (1/Math.max(8,dist))*0.08){
        if(losBlocked(origin.x,origin.z,b.pos.x,b.pos.z)) continue;
        if(dist<hitDist){ hitDist=dist; hitBot=b; head=Math.random()<0.22; }
      }
    }
    if(hitBot){
      end=origin.clone().addScaledVector(dir,hitDist);
      let dmg=def.dmg*(head?2:1)*rand(0.9,1.1);
      damageBot(hitBot,dmg,head,'YOU');
    }
  } else {
    // bot shooting player
    const p=player;
    if(p.alive){
      const dist=Math.hypot(p.pos.x-origin.x,p.pos.z-origin.z);
      if(dist<def.range && !losBlocked(origin.x,origin.z,p.pos.x,p.pos.z)){
        // accuracy depends on dist + player crouch/move
        const acc=clamp(0.55 - dist/220 - (p.crouch?0.08:0),0.06,0.55);
        if(Math.random()<acc){
          end=p.pos.clone(); end.y=1.3;
          let dmg=def.dmg*rand(0.55,0.95);
          damagePlayer(dmg, owner);
          hitBot='player';
        } else {
          end=p.pos.clone().add(new THREE.Vector3(rand(-3,3),rand(0,2.5),rand(-3,3))); end.y=Math.max(0.3,end.y);
        }
      }
    }
  }
  spawnTracer(origin,end,owner==='player'?0xffe27a:0xff6b6b);
  // muzzle light flash (cheap: sprite scale)
  return {hit:!!hitBot, dist:hitDist};
}
function spawnTracer(a,b,color){
  const g=new THREE.BufferGeometry().setFromPoints([a,b]);
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:0.95}));
  scene.add(l); G.tracers.push({m:l,life:0.09});
  if(G.tracers.length>40){ const t=G.tracers.shift(); scene.remove(t.m); t.m.geometry.dispose(); }
}
function damageBot(b,dmg,head,from){
  if(!b.alive) return;
  b.hp-=dmg; b.lastDmgFrom=from;
  spawnDamageNum(b.pos,dmg,head);
  if(from==='YOU'){ $('hitmarker').classList.remove('show'); void $('hitmarker').offsetWidth; $('hitmarker').classList.add('show'); SFX.hit(); }
  if(b.hp<=0){
    b.hp=0; b.alive=false; b.mesh.visible=false;
    // drop loot
    spawnLoot(b.pos.x+rand(-1,1),b.pos.z+rand(-1,1), Math.random()<0.5?'ammo':'med');
    if(Math.random()<0.35) spawnLoot(b.pos.x,b.pos.z,'weapon', b.weapon.key);
    if(from==='YOU'){ player.kills++; G.kills=player.kills; SFX.kill(); feed(`YOU killed <b>${b.name}</b>${head?' 🎯':''}`); }
    else { feed(`<b>${from}</b> killed <b>${b.name}</b>`); maybeBotKillCredit(from); }
    updateAlive(); checkWin();
  } else {
    // aggro
    if(from==='YOU'){ b.state='engage'; b.target='player'; }
    else { const o=bots.find(x=>x.alive&&x.name===from); if(o){ b.state='engage'; b.target=o; } }
  }
}
function maybeBotKillCredit(name){
  const k=bots.find(x=>x.name===name&&x.alive); if(k) k.kills=(k.kills||0)+1;
}
function damagePlayer(dmg, fromName){
  if(!player.alive||G.state!=='playing') return;
  if(player.armor>0){ const ab=Math.min(player.armor,dmg*0.5); player.armor-=ab; dmg-=ab; }
  player.hp-=dmg;
  SFX.hurt();
  const dv=$('damage-vignette'); dv.style.opacity=0.9; setTimeout(()=>dv.style.opacity=0,220);
  // direction indicator
  const f=bots.find(b=>b.name===fromName);
  if(f){ const ang=Math.atan2(f.pos.x-player.pos.x,f.pos.z-player.pos.z); let rel=ang-player.yaw+Math.PI; $('hit-dir').style.transform=`rotate(${rel}rad)`; $('hit-dir').style.opacity=1; setTimeout(()=>$('hit-dir').style.opacity=0,600); }
  updateHUD();
  if(player.hp<=0){ player.hp=0; player.alive=false; gameOver(false, fromName); }
}
function spawnDamageNum(pos,dmg,head){
  // cheap floating sprite via DOM? use 3D→2D projected div pool — simplified: hitmarker only + feed big hits
  G.hits.push({pos:pos.clone(),dmg:Math.round(dmg),head,life:0.8});
}

// damage numbers overlay (2D canvas overlay via divs)
const dmgDivs=[];
function renderDamageNumbers(){
  // project up to 8 recent hits
  while(G.hits.length>10) G.hits.shift();
  // reuse divs
  while(dmgDivs.length<G.hits.length){ const d=document.createElement('div'); d.className='dmgnum'; document.getElementById('game-root').appendChild(d); dmgDivs.push(d); }
  dmgDivs.forEach((d,i)=>{
    if(i<G.hits.length){
      const h=G.hits[i]; h.life-=0.016;
      const v=new THREE.Vector3(h.pos.x,2.4+(0.8-h.life),h.pos.z).project(camera);
      if(v.z<1){ d.style.display='block'; d.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; d.style.top=((-v.y*0.5+0.5)*innerHeight)+'px'; d.textContent=h.dmg; d.style.color=h.head?'#ffd23e':'#fff'; }
      else d.style.display='none';
    } else d.style.display='none';
  });
  G.hits=G.hits.filter(h=>h.life>0);
}
// inject dmg style
{ const st=document.createElement('style'); st.textContent='.dmgnum{position:absolute;transform:translate(-50%,-50%);font-weight:900;font-size:18px;text-shadow:0 2px 0 #000;z-index:17;pointer-events:none}'; document.head.appendChild(st); }

// ---------- Bots AI ----------
function botThink(b){
  b.nextThink=G.time+rand(0.4,0.9);
  if(!b.alive) return;
  // zone pressure
  const zd=Math.hypot(b.pos.x-G.zone.x,b.pos.z-G.zone.z);
  if(zd>G.zone.r*0.95){ b.state='rotate'; b.tx=G.zone.x+rand(-20,20); b.tz=G.zone.z+rand(-20,20); return; }
  if(b.hp<70&&Math.random()<0.5){ b.state='heal'; b.healT=G.time+2.5; return; }
  // find enemy: player or bots within 70 with LOS
  let best=null,bestD=70;
  if(player.alive){
    const d=Math.hypot(player.pos.x-b.pos.x,player.pos.z-b.pos.z);
    if(d<bestD&&!losBlocked(b.pos.x,b.pos.z,player.pos.x,player.pos.z)){ best='player'; bestD=d; }
  }
  for(const o of bots){ if(o===b||!o.alive) continue;
    const d=Math.hypot(o.pos.x-b.pos.x,o.pos.z-b.pos.z);
    if(d<bestD*0.7&&!losBlocked(b.pos.x,b.pos.z,o.pos.x,o.pos.z)){ best=o; bestD=d; }
  }
  if(best){ b.state='engage'; b.target=best; }
  else if(b.state==='engage'&&Math.random()<0.4){ b.state='loot'; b.tx=rand(-180,180); b.tz=rand(-180,180); }
  else if(b.state!=='engage'){ if(Math.hypot(b.tx-b.pos.x,b.tz-b.pos.z)<6||Math.random()<0.3){ // pick loot-ish point
      // drift toward zone center
      b.tx=G.zone.x+rand(-G.zone.r,G.zone.r)*0.8; b.tz=G.zone.z+rand(-G.zone.r,G.zone.r)*0.8;
    } b.state='loot'; }
}
function botUpdate(b,dt){
  if(!b.alive) return;
  if(G.time>=b.nextThink) botThink(b);
  let mvx=0,mvz=0,moving=false;
  if(b.state==='heal'){
    if(G.time>b.healT){ b.hp=Math.min(200,b.hp+60); b.state='loot'; }
  } else if(b.state==='rotate'){
    const dx=b.tx-b.pos.x,dz=b.tz-b.pos.z,d=Math.hypot(dx,dz);
    if(d>3){ mvx=dx/d; mvz=dz/d; moving=true; }
    else b.state='loot';
  } else if(b.state==='engage'){
    let ex,ez;
    if(b.target==='player'){ if(!player.alive){b.state='loot';return;} ex=player.pos.x; ez=player.pos.z; }
    else { const t=b.target; if(!t||!t.alive){b.state='loot';return;} ex=t.pos.x; ez=t.pos.z; }
    const dx=ex-b.pos.x,dz=ez-b.pos.z,d=Math.hypot(dx,dz);
    b.yaw=Math.atan2(-dx,-dz);
    b.strafeT-=dt; if(b.strafeT<=0){ b.strafeT=rand(0.8,2); b.strafe=Math.random()<0.5?-1:1; if(Math.random()<0.3)b.strafe=0; }
    if(d>34){ mvx=dx/d; mvz=dz/d; moving=true; }
    else if(d<12){ mvx=-dx/d; mvz=-dz/d; moving=true; }
    else { mvx=-dz/d*b.strafe; mvz=dx/d*b.strafe; moving=true; }
    // shoot
    if(d<b.wdef.range&&G.time>=b.nextShot){
      const interval=60/(b.wdef.key==='mp5'?300:200);
      b.nextShot=G.time+interval*rand(0.9,1.8);
      shoot(b.pos,b.yaw,0.02,b.wdef,b.name);
      SFX.shoot(b.weapon.key);
    }
  } else {
    const dx=b.tx-b.pos.x,dz=b.tz-b.pos.z,d=Math.hypot(dx,dz);
    if(d>4){ mvx=dx/d; mvz=dz/d; moving=true; b.yaw=Math.atan2(-mvx,-mvz); }
  }
  if(moving){
    let nx=b.pos.x+mvx*b.speed*dt, nz=b.pos.z+mvz*b.speed*dt;
    [nx,nz]=collideCircle(nx,nz,0.6);
    b.pos.x=nx; b.pos.z=nz;
    if(b.state!=='engage') b.yaw=Math.atan2(-mvx,-mvz);
  }
  // gravity stub (flat)
  b.mesh.position.set(b.pos.x,0,b.pos.z);
  b.mesh.rotation.y=b.yaw;
  animateSoldier(b.mesh,moving,dt,false);
  // zone damage
  const zd=Math.hypot(b.pos.x-G.zone.x,b.pos.z-G.zone.z);
  if(zd>G.zone.r){ b.hp-=zoneDmg()*dt; if(b.hp<=0){ b.hp=0;b.alive=false;b.mesh.visible=false; feed(`ZONE killed <b>${b.name}</b>`); updateAlive(); checkWin(); } }
}
function zoneDmg(){ return G.zone.phases[Math.min(G.zone.phase,G.zone.phases.length-1)].dmg*0.6; }

// ---------- Zone ----------
function zoneUpdate(dt){
  const z=G.zone;
  const ph=z.phases[Math.min(z.phase,z.phases.length-1)];
  if(z.mode==='wait'){
    z.t+=dt;
    if(z.t>=ph.wait){
      // pick next target
      z.tr=ph.r;
      const maxOff=Math.max(0,(z.r-z.tr)*0.5);
      z.tx=clamp(z.x+rand(-maxOff,maxOff),-190,190);
      z.tz=clamp(z.z+rand(-maxOff,maxOff),-190,190);
      z.mode='shrink'; z.t=0; SFX.zone(); showZoneWarn('ZONE SHRINKING!');
      // preview ring
      nextZoneMesh.position.set(z.tx,0.16,z.tz); nextZoneMesh.scale.set(z.tr,z.tr,1);
    }
  } else if(z.mode==='shrink'){
    z.t+=dt;
    const k=clamp(z.t/ph.shrink,0,1);
    // lerp from stored start — store on transition
    if(z.sx===undefined){ z.sx=z.x; z.sz=z.z; z.sr=z.r; }
    z.x=z.sx+(z.tx-z.sx)*k; z.z=z.sz+(z.tz-z.sz)*k; z.r=z.sr+(z.tr-z.sr)*k;
    if(k>=1){ z.phase++; z.mode='wait'; z.t=0; z.sx=undefined; if(z.phase>=z.phases.length){ z.mode='done'; } }
  }
  zoneMesh.position.set(z.x,0.15,z.z); zoneMesh.scale.set(z.r,z.r,1);
  if(z.mode==='wait'){ nextZoneMesh.position.set(z.x,0.16,z.z); nextZoneMesh.scale.set(Math.max(0.1,ph.r),Math.max(0.1,ph.r),1); }
  // label
  const ph2=z.phases[Math.min(z.phase,z.phases.length-1)];
  const left=Math.max(0,Math.ceil((z.mode==='wait'?ph2.wait-z.t:ph2.shrink-z.t)));
  $('zone-label').textContent=`ZONE ${Math.min(z.phase+1,6)} • ${z.mode==='wait'?'⏳':'⚠'} ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  $('zone-fill').style.width=`${z.mode==='wait'?100*(1-z.t/ph2.wait):100*(1-z.t/ph2.shrink)}%`;
  // player zone damage
  const pd=Math.hypot(player.pos.x-z.x,player.pos.z-z.z);
  if(pd>z.r&&player.alive){
    player.hp-=ph2.dmg*dt;
    $('zone-warning').classList.remove('hidden');
    if(Math.floor(G.time*2)%2===0) SFX.zone;
    if(player.hp<=0){ player.hp=0; player.alive=false; gameOver(false,'ZONE'); }
  } else $('zone-warning').classList.add('hidden');
  updateHUD();
}

// ---------- HUD / feed ----------
function feed(html){
  const kf=$('killfeed'); const d=document.createElement('div'); d.className='feed'; d.innerHTML=html;
  kf.prepend(d); while(kf.children.length>4) kf.lastChild.remove();
  setTimeout(()=>{ d.style.opacity='0'; d.style.transition='opacity .5s'; setTimeout(()=>d.remove(),500); },4200);
}
function updateAlive(){
  const a=(player.alive?1:0)+bots.filter(b=>b.alive).length;
  G.alive=a; $('alive-count').textContent=a;
}
function updateHUD(){
  $('hp-fill').style.width=`${100*player.hp/player.maxHp}%`;
  $('hp-fill').style.background=player.hp>120?'linear-gradient(90deg,#2eff7a,#b6ff4d)':player.hp>60?'linear-gradient(90deg,#ffd23e,#ff9a2a)':'linear-gradient(90deg,#ff3b3b,#ff7a5e)';
  $('hp-text').textContent=Math.ceil(player.hp);
  $('armor-fill').style.width=`${player.armor}%`;
  const w=curW(), d=curDef();
  $('weapon-name').textContent=d.name;
  $('ammo-text').textContent = w.mag===Infinity?'∞':`${w.mag} / ${w.res}`;
  $('kill-count').textContent=player.kills;
  $('med-count').textContent=`${player.meds} MED`;
  document.querySelectorAll('.slot').forEach((s,i)=>{
    if(i<player.weapons.length){ s.style.display='block'; const wd=WEAPONS[player.weapons[i].key]; s.innerHTML=`${i+1}<br><small>${wd.slot}</small>`; s.classList.toggle('active',i===player.cur); }
    else if(i===2){} else s.style.display='none';
  });
  // reload indicator
  if(G.time<player.reloadingUntil) $('ammo-text').textContent='RELOADING…';
  else if(G.time<player.healUntil) $('ammo-text').textContent='HEALING…';
}
let msgTimer=null;
function centerMsg(t,ms=1500){ const el=$('center-msg'); el.textContent=t; el.classList.remove('hidden'); clearTimeout(msgTimer); msgTimer=setTimeout(()=>el.classList.add('hidden'),ms); }
function showZoneWarn(t){ centerMsg(t,2000); }

// ---------- Minimap ----------
const mm=$('minimap').getContext('2d');
function drawMinimap(){
  const S=180, half=WORLD/2;
  mm.clearRect(0,0,S,S);
  mm.fillStyle='#0d2240'; mm.fillRect(0,0,S,S);
  mm.fillStyle='#2c5a2e'; mm.fillRect(4,4,S-8,S-8);
  const px=x=>(x+half)/WORLD*S, pz=z=>(z+half)/WORLD*S;
  // zone
  mm.strokeStyle='#37e0ff'; mm.lineWidth=2;
  mm.beginPath(); mm.arc(px(G.zone.x),pz(G.zone.z),G.zone.r/WORLD*S,0,7); mm.stroke();
  mm.strokeStyle='#ffffff88'; mm.setLineDash([4,3]);
  const ph=G.zone.phases[Math.min(G.zone.phase,G.zone.phases.length-1)];
  mm.beginPath(); mm.arc(px(G.zone.x),pz(G.zone.z),ph.r/WORLD*S,0,7); mm.stroke(); mm.setLineDash([]);
  // houses
  mm.fillStyle='#d9c9a8';
  for(const h of houseSpots) mm.fillRect(px(h.x)-2,pz(h.z)-2,4,4);
  // loot
  mm.fillStyle='#ffcf5e';
  for(const l of loots){ if(l.taken) continue; if(Math.hypot(l.x-player.pos.x,l.z-player.pos.z)>60) continue; mm.fillRect(px(l.x)-1,pz(l.z)-1,2,2); }
  // bots (only recent shooters / close)
  for(const b of bots){ if(!b.alive) continue; const d=Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z); if(d>80) continue;
    mm.fillStyle='#ff3b3b'; mm.beginPath(); mm.arc(px(b.pos.x),pz(b.pos.z),2.5,0,7); mm.fill(); }
  // player arrow
  mm.save(); mm.translate(px(player.pos.x),pz(player.pos.z)); mm.rotate(Math.atan2(Math.sin(player.yaw),Math.cos(player.yaw))+Math.PI);
  mm.fillStyle='#3dff7a'; mm.beginPath(); mm.moveTo(0,-6); mm.lineTo(4,4); mm.lineTo(-4,4); mm.closePath(); mm.fill(); mm.restore();
}

// ---------- Player update ----------
function playerUpdate(dt){
  if(!player.alive) return;
  // reload finish
  const w=curW(), d=curDef();
  if(player.reloadingUntil&&G.time>=player.reloadingUntil){
    const need=d.mag-w.mag, take=Math.min(need,w.res);
    w.mag+=take; w.res-=take; player.reloadingUntil=0; updateHUD();
  }
  if(player.healUntil&&G.time>=player.healUntil){ player.hp=Math.min(player.maxHp,player.hp+75); player.healUntil=0; updateHUD(); }
  // move input
  let ix=0,iz=0;
  if(keys['KeyW']||keys['ArrowUp']) iz-=1;
  if(keys['KeyS']||keys['ArrowDown']) iz+=1;
  if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
  if(keys['KeyD']||keys['ArrowRight']) ix+=1;
  ix+=joy.x; iz+=joy.y;
  const sprint=(keys['ShiftLeft']||keys['ShiftRight'])||(Math.hypot(joy.x,joy.y)>0.92);
  const m=Math.hypot(ix,iz);
  let moving=false;
  if(m>0.15){
    const cl=m>1?1/m:1; ix*=cl; iz*=cl;
    const sp=(player.crouch?3.2:player.aiming?4.2:sprint?8.2:6.2);
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    const wx=(ix*cos - iz*sin)*sp*dt, wz=(-ix*sin - iz*cos)*-1*sp*dt;
    // camera-relative: forward = -sin,-cos
    const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
    const rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
    let nx=player.pos.x + (fx*-iz + rx*ix)*sp*dt;
    let nz=player.pos.z + (fz*-iz + rz*ix)*sp*dt;
    [nx,nz]=collideCircle(nx,nz,0.6);
    player.pos.x=nx; player.pos.z=nz; moving=true;
    player.bob+=dt*(sprint?12:9);
  }
  // gravity/jump
  if(!player.onGround){ player.vy-=22*dt; player.pos.y+=player.vy*dt; if(player.pos.y<=0){player.pos.y=0;player.vy=0;player.onGround=true;} }
  // firing
  if(player.firing&&G.time>=player.lastShot){
    const interval=60/d.rpm;
    if(w.mag<=0&&w.mag!==Infinity){ startReload(); }
    else if(G.time>=player.reloadingUntil&&G.time>=player.healUntil){
      player.lastShot=G.time+interval;
      if(w.mag!==Infinity) w.mag--;
      SFX.shoot(w.key);
      const from=player.pos.clone();
      shoot(player.pos,player.yaw,player.pitch+(player.aiming?0:0.01),d,'player');
      // recoil
      player.pitch=clamp(player.pitch+ (d.name==='AWM'?0.06:0.012),-1.2,0.6);
      updateHUD();
      if(w.mag===0) startReload();
    }
  }
  // mesh
  player.mesh.position.set(player.pos.x,player.pos.y,player.pos.z);
  player.mesh.rotation.y=player.yaw;
  animateSoldier(player.mesh,moving,dt,player.crouch);
  // gun visibility
  player.mesh.userData.gun.visible = w.key!=='fist';
  // camera (third person) — keep out of walls/rocks
  const camDist=player.aiming?3.2:5.2, camH=player.crouch?1.6:2.4;
  let cx=player.pos.x+Math.sin(player.yaw)*camDist*Math.cos(player.pitch);
  let cz=player.pos.z+Math.cos(player.yaw)*camDist*Math.cos(player.pitch);
  [cx,cz]=collideCircle(cx,cz,0.9);
  const cy=player.pos.y+camH-Math.sin(player.pitch)*camDist;
  camera.position.lerp(new THREE.Vector3(cx,Math.max(0.8,cy),cz), 1-Math.pow(0.0001,dt));
  const look=new THREE.Vector3(player.pos.x-Math.sin(player.yaw)*8*Math.cos(player.pitch), player.pos.y+1.5+Math.sin(player.pitch)*8, player.pos.z-Math.cos(player.yaw)*8*Math.cos(player.pitch));
  camera.lookAt(look);
  camera.fov+= ((player.aiming?55:72)-camera.fov)*Math.min(1,dt*8); camera.updateProjectionMatrix();
  // loot proximity
  nearestLoot=null; let nd=3.2;
  for(const l of loots){ if(l.taken) continue; const dd=Math.hypot(l.x-player.pos.x,l.z-player.pos.z); if(dd<nd){nd=dd;nearestLoot=l;} l.mesh.rotation.y+=dt*1.2; l.mesh.position.y=0.8+Math.sin(G.time*2+l.phase)*0.12; }
  if(nearestLoot){
    $('interact-prompt').classList.remove('hidden');
    const L=nearestLoot;
    $('interact-text').textContent = L.kind==='weapon'?`Take ${WEAPONS[L.wkey].name}`:L.kind==='med'?'Take MEDKIT':L.kind==='ammo'?'Take AMMO':'Take VEST';
  } else $('interact-prompt').classList.add('hidden');
}

// ---------- Bot-vs-bot background battle ----------
let bgT=0;
function backgroundBattle(dt){
  bgT+=dt;
  if(bgT<6) return; bgT=0;
  const alive=bots.filter(b=>b.alive);
  if(alive.length<=2||G.state!=='playing') return;
  // only fight far bots to thin herd naturally
  if(Math.random()<0.7&&alive.length>3){
    const far=alive.filter(b=>Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)>60);
    if(far.length>=2){
      const a=far[Math.floor(Math.random()*far.length)];
      let b=far[Math.floor(Math.random()*far.length)];
      if(a!==b){ damageBot(b,rand(60,200),false,a.name); // tracer far away
        spawnTracer(new THREE.Vector3(a.pos.x,1.5,a.pos.z),new THREE.Vector3(b.pos.x,1.3,b.pos.z),0xff6b6b); }
    }
  }
}

// ---------- Flow ----------
function resetMatch(){
  // reset player — resample spawn until clear of obstacles
  for(let tries=0;tries<12;tries++){
    player.pos.set(rand(-40,40),0,rand(100,160));
    const [cx,cz]=collideCircle(player.pos.x,player.pos.z,2.5);
    if(Math.hypot(cx-player.pos.x,cz-player.pos.z)<0.01) break;
    player.pos.x=cx; player.pos.z=cz; break;
  }
  {
    const [cx,cz]=collideCircle(player.pos.x,player.pos.z,1.0);
    player.pos.x=cx; player.pos.z=cz;
  }
  player.yaw=Math.PI; player.pitch=-0.1;
  player.hp=200; player.armor=0; player.meds=2; player.alive=true; player.kills=0; player.cur=0;
  player.weapons=[{key:'ak',mag:30,res:90}]; player.firing=false; player.reloadingUntil=0; player.healUntil=0; player.crouch=false;
  player.mesh.visible=true;
  // reset bots
  for(const b of bots){ scene.remove(b.mesh); }
  bots.length=0; spawnBots(11);
  // reset loot
  for(const l of loots) scene.remove(l.mesh);
  loots.length=0; scatterLoot();
  // reset zone
  G.zone={ x:0,z:0,r:205, tx:0,tz:0,tr:205, phase:0, t:0, mode:'wait', sx:undefined,
    phases:[{r:150,wait:25,shrink:30,dmg:3},{r:100,wait:20,shrink:25,dmg:5},{r:60,wait:15,shrink:20,dmg:8},{r:30,wait:12,shrink:18,dmg:12},{r:8,wait:10,shrink:15,dmg:16},{r:0.5,wait:8,shrink:12,dmg:22}] };
  G.time=0; G.matchTime=0; G.kills=0; G.tracers.forEach(t=>scene.remove(t.m)); G.tracers=[]; G.hits=[];
  $('killfeed').innerHTML=''; updateAlive(); updateHUD();
}
function startGame(){
  audio(); SFX.click();
  HIGH_DETAIL=$('set-quality').checked;
  renderer.shadowMap.enabled=$('set-shadow').checked;
  soundOn=$('set-sound').checked;
  resetMatch();
  $('menu').classList.add('hidden'); $('gameover').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud-top').classList.remove('hidden'); $('hud-bottom').classList.remove('hidden');
  $('crosshair').classList.remove('hidden');
  if(IS_TOUCH) $('touch-ui').classList.remove('hidden');
  $('minimap').style.display='block';
  G.state='playing';
  centerMsg('DROP! LOOT & SURVIVE!',2200);
  feed('📦 <b>12</b> players dropped on Bermuda!');
}
function pauseGame(){ if(G.state!=='playing')return; G.state='paused'; $('pause').classList.remove('hidden'); document.exitPointerLock?.(); }
function resumeGame(){ $('pause').classList.add('hidden'); G.state='playing'; }
function quitToMenu(){ G.state='menu'; $('pause').classList.add('hidden'); $('gameover').classList.add('hidden'); $('menu').classList.remove('hidden'); $('hud-top').classList.add('hidden'); $('hud-bottom').classList.add('hidden'); $('touch-ui').classList.add('hidden'); $('crosshair').classList.add('hidden'); document.exitPointerLock?.(); }
function gameOver(win, by){
  if(G.state!=='playing') return;
  G.state='over'; player.firing=false; document.exitPointerLock?.();
  const aliveLeft=bots.filter(b=>b.alive).length;
  const t=Math.floor(G.matchTime), mm2=Math.floor(t/60), ss=String(t%60).padStart(2,'0');
  if(win){ $('over-title').textContent='🏆 BOOYAH! #1'; $('over-rank').textContent='LAST ONE STANDING — CHICKEN DINNER OF BERMUDA'; SFX.win(); }
  else { $('over-title').textContent=`#${aliveLeft+1} — ELIMINATED by ${by||'enemy'}`; $('over-rank').textContent='Better luck next drop, survivor!'; beep(200,0.6,'sawtooth',0.12,-100); }
  $('over-stats').textContent=`Kills: ${player.kills} • Survived ${mm2}:${ss} • ${G.alive} left`;
  $('gameover').classList.remove('hidden');
  $('touch-ui').classList.add('hidden');
}
function checkWin(){
  updateAlive();
  const aliveBots=bots.filter(b=>b.alive).length;
  if(player.alive&&aliveBots===0) gameOver(true);
  else if(!player.alive){ /* already over */ }
}

// ---------- Main loop ----------
const clock=new THREE.Clock();
let lastMenuRender=0;
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,clock.getDelta());
  if(G.state==='playing'){
    G.time+=dt; G.matchTime+=dt;
    playerUpdate(dt);
    for(const b of bots) botUpdate(b,dt);
    backgroundBattle(dt);
    zoneUpdate(dt);
    // tracers fade
    for(let i=G.tracers.length-1;i>=0;i--){ const t=G.tracers[i]; t.life-=dt; t.m.material.opacity=Math.max(0,t.life/0.09); if(t.life<=0){ scene.remove(t.m); t.m.geometry.dispose(); G.tracers.splice(i,1);} }
    drawMinimap();
    renderDamageNumbers();
    renderer.render(scene,camera);
  } else if(G.state==='menu'){
    // Throttled menu render (5fps): keeps auto-start clicks responsive under SwiftShader.
    const now=performance.now();
    if(now-lastMenuRender>200){
      lastMenuRender=now;
      const t=now*0.0001;
      camera.position.set(Math.sin(t)*90,38,Math.cos(t)*90);
      camera.lookAt(0,0,0);
      G.time+=0.2;
      for(const l of loots){ if(!l.taken){ l.mesh.rotation.y+=0.2; } }
      renderer.render(scene,camera);
    }
  } else {
    renderer.render(scene,camera);
  }
}
loop();
setupTouch();
drawMinimap(); updateHUD();

// ---------- UI wiring ----------
$('btn-play').addEventListener('click',startGame);
$('btn-again').addEventListener('click',()=>{ $('gameover').classList.add('hidden'); startGame(); });
$('btn-menu').addEventListener('click',quitToMenu);
$('btn-resume').addEventListener('click',resumeGame);
$('btn-quit').addEventListener('click',quitToMenu);
$('btn-pause').addEventListener('click',pauseGame);
$('set-sound').addEventListener('change',e=>soundOn=e.target.checked);
window.__game={G,player,bots,startGame}; // for automated checks
// If the user (or automated capture) clicked Play while the module was parsing, start now.
if(window.__playQueued && G.state==='menu'){ startGame(); }
