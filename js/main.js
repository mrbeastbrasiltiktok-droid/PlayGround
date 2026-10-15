// RIVALS ARENA — boot, renderer, scenes, camera, game loop.
import * as THREE from 'three';
import { HEROES, HERO_MAP, SETTINGS_DEFAULTS } from './config.js';
import { UI } from './ui.js';
import { World } from './world.js';
import { VFX } from './vfx.js';
import { Combat } from './combat.js';
import { Match } from './match.js';
import { Character } from './character.js';
import { BotAI } from './bots.js';
import { buildHeroMesh } from './models.js';
import { Animator } from './anim.js';
import { Input, initInput, pollMoveFromKeys, consumeLook, applySettings } from './input.js';
import { initAudio, resumeAudio, setVolumes, sfx, startMusic } from './audio.js';

const settings={...SETTINGS_DEFAULTS};
try{ Object.assign(settings,JSON.parse(localStorage.getItem('rivals-settings')||'{}')); }catch(e){}
function saveSettings(){ try{localStorage.setItem('rivals-settings',JSON.stringify(settings));}catch(e){} }

const ui=new UI(settings);
const canvas=document.getElementById('game-canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:settings.quality==='med'?1.5:2));
renderer.shadowMap.enabled=settings.quality!=='low';
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3;
function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight;
  camera.fov=camera.aspect<0.8?76:camera.aspect<1.2?68:62; camera.updateProjectionMatrix(); }
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,300);
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,300));

// ---------- persistent menu scene ----------
const menuScene=new THREE.Scene(); menuScene.background=new THREE.Color(0x070b18);
menuScene.fog=new THREE.Fog(0x070b18,30,90);
menuScene.add(new THREE.HemisphereLight(0x9fc0ff,0x30204a,2.2));
const mSun=new THREE.DirectionalLight(0xffe2b0,3.2); mSun.position.set(6,12,8); menuScene.add(mSun);
const mFill=new THREE.DirectionalLight(0x27e0ff,1.2); mFill.position.set(-6,4,10); menuScene.add(mFill);
const mSpot=new THREE.SpotLight(0xffffff,400,30,0.5,0.4); mSpot.position.set(0,9,4);
mSpot.target.position.set(0,1,0); menuScene.add(mSpot); menuScene.add(mSpot.target);
const mRim=new THREE.DirectionalLight(0x27e0ff,0.8); mRim.position.set(-12,8,-10); menuScene.add(mRim);
{ const plat=new THREE.Mesh(new THREE.CylinderGeometry(4,4.6,0.5,32),new THREE.MeshStandardMaterial({color:0x1a2440,roughness:0.5,metalness:0.5}));
  plat.position.y=-0.25; menuScene.add(plat);
  const ring=new THREE.Mesh(new THREE.RingGeometry(3.4,4,48),new THREE.MeshBasicMaterial({color:0xffb300,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.02; menuScene.add(ring); menuScene.userData.ring=ring;
  const grid=new THREE.GridHelper(80,40,0xffb300,0x22315e); grid.position.y=-0.3; grid.material.transparent=true; grid.material.opacity=0.25; menuScene.add(grid); }
let menuHero=null,menuAnim=null,menuIdx=0,menuT=0;
function setMenuHero(i){ menuIdx=(i+HEROES.length)%HEROES.length;
  if(menuHero) menuScene.remove(menuHero.group);
  const b=buildHeroMesh(HEROES[menuIdx]); menuHero=b; menuAnim=new Animator(b.joints);
  menuScene.add(b.group); }
setMenuHero(0);

// ---------- select / gallery preview renderers ----------
function makePreview(canvasId){
  const c=document.getElementById(canvasId);
  const r=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});
  const s=new THREE.Scene(); s.background=new THREE.Color(0x0a0f1e);
  s.add(new THREE.HemisphereLight(0x9fc0ff,0x201030,1.1));
  const k=new THREE.DirectionalLight(0xffffff,1.6); k.position.set(4,8,6); s.add(k);
  const rl=new THREE.DirectionalLight(0x27e0ff,0.7); rl.position.set(-6,4,-4); s.add(rl);
  const cam=new THREE.PerspectiveCamera(40,1,0.1,50); cam.position.set(0,1.6,4.2); cam.lookAt(0,1.0,0);
  const plat=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.3,0.18,28),new THREE.MeshStandardMaterial({color:0x1a2440,metalness:0.5,roughness:0.4}));
  plat.position.y=-0.1; s.add(plat);
  return {renderer:r,scene:s,cam,hero:null,anim:null,
    set(id){ if(this.hero) this.scene.remove(this.hero.group);
      const b=buildHeroMesh(HERO_MAP[id]); this.hero=b; this.anim=new Animator(b.joints); this.scene.add(b.group); },
    draw(t,run){ const box=c.getBoundingClientRect(); if(box.width<2) return;
      const w=Math.max(2,box.width),h=Math.max(2,box.height);
      if(r.domElement.width!==Math.floor(w*devicePixelRatio)){ r.setSize(w,h,false); this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); }
      if(this.hero){ this.hero.group.rotation.y=Math.sin(t*0.4)*0.4; this.anim.update(0.016,run?4:0.4,false); }
      r.render(this.scene,this.cam); } };
}
const selPrev=makePreview('select-canvas'); const galPrev=makePreview('gallery-canvas');
selPrev.set(HEROES[0].id); galPrev.set(HEROES[0].id);

// ---------- game state ----------
let world=null,vfx=null,combat=null,match=null,player=null;
let gameScene=null;
let mode='menus'; // menus | select | countdown | play | over
let shake=0, camYaw=0, camPitch=-0.12;
let trainingDummies=[];
const clock=new THREE.Clock();

initInput(settings,{
  onJump:()=>{ if(match&&match.state==='play'&&player&&player.alive) player.jump(); },
  onAbility:(s)=>{ if(match&&match.state==='play'&&player) player.useAbility(s==='E'?'E':'SHIFT',match.ctxWithInput()); },
  onUlt:()=>{ if(match&&match.state==='play'&&player){ if(!player.useUlt(match.ctxWithInput())) ui.toast('ULT not ready — '+Math.floor(player.ultCharge)+'%'); } },
  onReload:()=>{ player&&player.startReload(); },
  onFireStart:()=>{ if(match&&match.state==='play'&&player&&player.alive) player.fireHeld=true; },
  onFireEnd:()=>{ if(player) player.fireHeld=false; },
  onPause:()=>{ document.getElementById('pause-screen').classList.toggle('visible'); },
});
window.addEventListener('settings',()=>{ applySettings(settings); saveSettings();
  setVolumes(settings.music,settings.sfx);
  Input.sens=settings.sens;
  if(world) world.setQuality(settings.quality);
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:settings.quality==='med'?1.5:2));
  renderer.shadowMap.enabled=settings.quality!=='low';
});
applySettings(settings);

function newGameScene(){
  gameScene=new THREE.Scene();
  world=new World(gameScene,settings.quality);
  vfx=new VFX(gameScene);
  combat=new Combat(gameScene,world,vfx);
}
Match.prototype.ctxWithInput=function(){ const c=this.ctx(); c.input=Input; return c; };

function startMatch(heroId,modeName){
  ui.stopSelectTimer();
  newGameScene();
  match=new Match({scene:gameScene,world,combat,vfx,camera,ui,mode:modeName,heroId});
  match.ctxWithInput=Match.prototype.ctxWithInput.bind(match);
  player=match.player; player.isPlayer=true;
  camYaw=player.yaw; camPitch=-0.12;
  ui.hudOn(true); ui.hideRespawn();
  document.getElementById('killfeed').innerHTML='';
  mode='countdown'; match.state='countdown';
  Input.enabled=false;
  const label=modeName==='control'?'CAPTURE THE POINT':modeName==='tdm'?'MOST ELIMINATIONS WINS':'PRACTICE FREELY';
  let n=3; ui.countdown(n,label); sfx('count');
  const iv=setInterval(()=>{ n--;
    if(n>0){ ui.countdown(n,label); sfx('count'); }
    else { clearInterval(iv); ui.countdown('GO','FIGHT!'); sfx('go');
      setTimeout(()=>{ ui.hideCountdown(); match.state='play'; mode='play'; Input.enabled=true;
        ui.toast(label); },650); } },900);
  if(modeName==='training') setupTraining();
}
function setupTraining(){
  // spawn 3 dummy bots (ronin/volt) that strafe but don't capture
  const spots=[new THREE.Vector3(6,0,-4),new THREE.Vector3(-6,0,-4),new THREE.Vector3(0,0,-10)];
  trainingDummies=[];
  ['ronin','volt','inferno'].forEach((h,i)=>{
    const d=new Character(gameScene,HERO_MAP[h],'B',true,'DUMMY-'+(i+1));
    d.spawnAt(spots[i].clone()); match.chars.push(d); trainingDummies.push(d);
    const ai=new BotAI(d,match); match.bots.push(ai);
  });
  match.timeLeft=Infinity;
  ui.toast('◎ Training: dummies respawn. Practice abilities!');
}

// cross-screen events
window.addEventListener('starttraining',()=>{ startMatch(ui.selHero,'training'); for(const s of ui.screens) document.getElementById(s).classList.remove('visible'); });
window.addEventListener('lockin',()=>{ startMatch(ui.selHero,ui.mode); for(const s of ui.screens) document.getElementById(s).classList.remove('visible'); });
window.addEventListener('quitmatch',()=>{ cleanupToMenu(); });
window.addEventListener('tomenu',()=>{ cleanupToMenu(); });
window.addEventListener('playagain',()=>{ const h=ui.selHero,m=ui.mode; cleanupSoft(); startMatch(h,m); for(const s of ui.screens) document.getElementById(s).classList.remove('visible'); });
function cleanupSoft(){ if(match){ match.dispose(); match=null; } if(vfx){ try{vfx.dmgLayer.remove();}catch(e){} } document.getElementById('board-screen').classList.remove('visible'); document.getElementById('pause-screen').classList.remove('visible'); ui.hudOn(false); }
function cleanupToMenu(){ cleanupSoft(); mode='menus'; Input.enabled=false; ui.hudOn(false); ui.show('menu-screen'); }

// ---------- third-person camera ----------
const camTarget=new THREE.Vector3(), camPos=new THREE.Vector3(), camLook=new THREE.Vector3();
function updateCamera(dt){
  const lk=consumeLook();
  camYaw-=lk.dx*60*0.016; camPitch-=lk.dy*60*0.016;
  camPitch=Math.max(-0.9,Math.min(0.55,camPitch));
  if(player&&player.alive){ player.yaw=camYaw; player.pitch+=(camPitch-player.pitch)*Math.min(1,dt*12); }
  if(!player) return;
  // aim assist: gentle magnet toward nearest enemy in cone
  if(settings.aim&&player.fireHeld&&player.alive){
    let best=null,ba=0.12;
    for(const c of match.chars){ if(!c.alive||c.team===player.team||c.untargetable>0) continue;
      _a.copy(c.center()).sub(player.center()); const dist=_a.length(); if(dist>42) continue;
      _a.normalize(); const dot=_a.dot(player.aimDir());
      const ang=Math.acos(Math.max(-1,Math.min(1,dot)));
      if(ang<ba&&!world.losBlocked(player.center(),c.center())){ ba=ang; best=c; } }
    if(best){ const want=Math.atan2(best.pos.x-player.pos.x,best.pos.z-player.pos.z);
      let rel=want-camYaw; while(rel>Math.PI)rel-=Math.PI*2; while(rel<-Math.PI)rel+=Math.PI*2;
      camYaw+=rel*Math.min(1,dt*5); } }
  const baseDist=player.aiming?2.7:4.4;
  const dist=baseDist*(camera.aspect<1?Math.min(2.1,1.3/Math.max(0.4,camera.aspect)):1);
  camTarget.set(player.pos.x,player.pos.y+1.6,player.pos.z);
  const cp=Math.cos(camPitch),sp=Math.sin(camPitch);
  camPos.set(camTarget.x-Math.sin(camYaw)*cp*dist, camTarget.y-sp*dist+0.3, camTarget.z-Math.cos(camYaw)*cp*dist);
  // camera collision: pull in if blocked
  if(world.losBlocked(camTarget,camPos)){ camPos.lerp(camTarget,0.55); }
  if(camPos.y<0.4) camPos.y=0.4;
  // shake
  if(settings.shake&&shake>0.001){ camPos.x+=(Math.random()-0.5)*shake; camPos.y+=(Math.random()-0.5)*shake; shake*=Math.pow(0.02,dt); }
  camera.position.lerp(camPos,Math.min(1,dt*14));
  if(camera.position.distanceToSquared(camPos)>100) camera.position.copy(camPos);
  camLook.set(camTarget.x+Math.sin(camYaw)*6, camTarget.y+sp*6, camTarget.z+Math.cos(camYaw)*6);
  camera.lookAt(camLook);
  // jolt from firing
  if(player._jolt){ shake=Math.min(0.5,shake+player._jolt*0.12); player._jolt=0; }
  // reveal: outline enemies (spectre pulse) — simple emissive pulse via scale? use HUD marker instead
  updateObjMarker();
}
const _a=new THREE.Vector3();
function updateObjMarker(){
  const el=document.getElementById('obj-marker');
  if(!match||match.state!=='play'||match.mode!=='control'){ el.style.display='none'; return; }
  el.style.display='block';
  _a.set(0,1,0).applyMatrix4(camera.matrixWorldInverse);
  // project point
  const p=new THREE.Vector3(0,1.5,0).project(camera);
  const behind=p.z>1;
  el.style.left=((p.x*0.5+0.5)*100)+'%'; el.style.top=((-p.y*0.5+0.5)*100)+'%';
  el.style.opacity=behind?'0':'1';
}

// ---------- adaptive perf ----------
let fpsAcc=0,fpsN=0,fpsT=0;
function adapt(dt){
  fpsAcc+=dt; fpsN++; fpsT+=dt;
  if(fpsT>3){ const avg=fpsN/fpsAcc;
    if(avg<42&&renderer.getPixelRatio()>1){ renderer.setPixelRatio(Math.max(1,renderer.getPixelRatio()-0.25)); }
    fpsAcc=0;fpsN=0;fpsT=0; } }

// ---------- boot ----------
let booted=false;
async function boot(){
  const steps=[['Loading renderer…',0.15],['Building Skyfall Plaza…',0.4],['Forging heroes…',0.65],['Tuning combat…',0.85],['Ready',1]];
  for(const [msg,p] of steps){ ui.setLoading(p,msg); await new Promise(r=>setTimeout(r,180)); }
  resize();
  document.getElementById('loading-screen').classList.remove('visible');
  document.getElementById('intro-screen').classList.add('visible');
  ui.history.push('intro-screen');
  booted=true;
  // intro auto-advance after 6s cinematic
  setTimeout(()=>{ if(document.getElementById('intro-screen').classList.contains('visible')){ /* stay until tap */ } },6000);
  requestAnimationFrame(loop);
}
document.getElementById('btn-intro-start').addEventListener('click',()=>{ resumeAudio(); startMusic(); setVolumes(settings.music,settings.sfx); });
document.getElementById('btn-intro-skip').addEventListener('click',()=>{ resumeAudio(); startMusic(); setVolumes(settings.music,settings.sfx); });
window.addEventListener('pointerdown',()=>resumeAudio(),{once:false});
initAudio();

// ---------- main loop ----------
let lastSel=ui.selHero, lastGal=ui.selHero, lastMenuSwap=0;
// debug/testing hook (also used by automated validation)
window.__RA={get match(){return match},get player(){return player},get mode(){return mode},settings,
 get menuDiag(){ const out={lights:[],heroPos:null,heroCount:0,cam:null};
  try{ menuScene.traverse(o=>{ if(o.isDirectionalLight||o.isHemisphereLight||o.isSpotLight) out.lights.push({t:o.type,i:o.intensity}); });
   if(menuHero){ out.heroPos=menuHero.group.position.toArray(); menuHero.group.traverse(o=>{if(o.isMesh)out.heroCount++;}); }
   out.cam=camera.position.toArray(); }catch(e){ out.err=String(e); } return out; }};
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,clock.getDelta());
  const t=clock.elapsedTime;
  pollMoveFromKeys();
  const introVisible=document.getElementById('intro-screen').classList.contains('visible');
  const inMenus=!match&&(mode==='menus'||mode==='select');
  // menu cinematic
  if(!match){
    menuT+=dt;
    if(menuT-lastMenuSwap>5){ lastMenuSwap=menuT; setMenuHero(menuIdx+1); }
    menuAnim.update(dt,0.6,false);
    menuScene.userData.ring.material.opacity=0.5+Math.sin(t*2)*0.2;
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    camera.position.set(Math.sin(menuT*0.25)*9,3.2+Math.sin(menuT*0.4)*0.5,Math.cos(menuT*0.25)*9);
    camera.lookAt(0,1.2,0);
    renderer.render(menuScene,camera);
    // previews
    if(document.getElementById('select-screen').classList.contains('visible')){
      if(lastSel!==ui.previewHero&&ui.previewHero){ selPrev.set(ui.previewHero); lastSel=ui.previewHero; }
      selPrev.draw(t,false);
    }
    if(document.getElementById('gallery-screen').classList.contains('visible')){
      if(lastGal!==ui.previewHero&&ui.previewHero){ galPrev.set(ui.previewHero); lastGal=ui.previewHero; }
      galPrev.draw(t,true);
    }
    return;
  }
  // in match
  const ctx=match.ctxWithInput();
  if(match.state==='play'){
    // player movement already in char update; camera first for yaw
    updateCamera(dt);
    for(const c of match.chars){ if(c===player) c.update(dt,{...ctx,input:Input});
      else c.update(dt,ctx); c.postMove&&c.postMove(dt,ctx); }
    combat.update(dt);
    vfx.update(dt);
    world.update(dt,t);
    match.update(dt,Input);
    if(match.mode==='training'){ for(const d of trainingDummies){ if(!d.alive&&d.respawnT<=0){ d.spawnAt(new THREE.Vector3((Math.random()-0.5)*16,0,-4-Math.random()*8)); } } }
    // HUD board live
    if(document.getElementById('board-screen').classList.contains('visible')) ui.renderBoard(match);
  } else if(match.state==='countdown'){
    // orbit spawn cinematic
    camera.position.set(Math.sin(t*0.8)*14,7,Math.cos(t*0.8)*14);
    camera.lookAt(0,1,0);
    for(const c of match.chars) c.anim.update(dt,0,false);
    vfx.update(dt); world.update(dt,t);
  } else if(match.state==='over'){
    // slow orbit victory
    const cx=match.player.pos;
    camera.position.lerp(new THREE.Vector3(cx.x+6*Math.cos(t*0.4),4,cx.z+6*Math.sin(t*0.4)),Math.min(1,dt*2));
    camera.lookAt(cx.x,1.2,cx.z);
    for(const c of match.chars){ if(c.alive) c.anim.update(dt,0,false); }
    vfx.update(dt); world.update(dt,t); combat.update(dt);
  }
  adapt(dt);
  renderer.render(gameScene,camera);
}
// pause rendering board
setInterval(()=>{ if(match&&match.state==='play'&&document.getElementById('board-screen').classList.contains('visible')) ui.renderBoard(match); },500);
// periodic menu->select preview sync
setInterval(()=>{ if(ui.previewHero&&ui.previewHero!==selPrev.hero?.__id){} },2000);
boot();
