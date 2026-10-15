// Unified touch + keyboard/mouse input. Prevents scroll/zoom gestures.
export const Input = {
  move:{x:0,y:0}, look:{dx:0,dy:0}, firing:false, aiming:false,
  jump:false, e:false, shift:false, ult:false, reload:false, interact:false,
  keys:{}, sens:1.2, enabled:false,
  _lookQueue:[], _stickId:null, _camId:null,
  _stickCX:0,_stickCY:0,
};
export function initInput(settings, callbacks){
  Input.sens = settings.sens ?? 1.2;
  const canvas = document.getElementById('game-canvas');
  // ---- keyboard ----
  window.addEventListener('keydown',e=>{
    if(e.repeat) return;
    Input.keys[e.code]=true;
    if(!Input.enabled) return;
    if(e.code==='Space'){ Input.jump=true; callbacks.onJump&&callbacks.onJump(); e.preventDefault(); }
    if(e.code==='KeyE') callbacks.onAbility&&callbacks.onAbility('E');
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') callbacks.onAbility&&callbacks.onAbility('SHIFT');
    if(e.code==='KeyF'||e.code==='KeyQ') callbacks.onUlt&&callbacks.onUlt();
    if(e.code==='KeyR') callbacks.onReload&&callbacks.onReload();
    if(e.code==='Escape') callbacks.onPause&&callbacks.onPause();
  });
  window.addEventListener('keyup',e=>{ Input.keys[e.code]=false; });
  // mouse look + fire (pointer lock optional, drag fallback)
  let mDown=false, lastMX=0,lastMY=0;
  canvas.addEventListener('mousedown',e=>{ if(!Input.enabled)return; mDown=true; lastMX=e.clientX; lastMY=e.clientY;
    if(e.button===0){ Input.firing=true; callbacks.onFireStart&&callbacks.onFireStart(); } });
  window.addEventListener('mouseup',()=>{ if(mDown){mDown=false; Input.firing=false; callbacks.onFireEnd&&callbacks.onFireEnd();} });
  window.addEventListener('mousemove',e=>{ if(mDown&&Input.enabled){ Input._lookQueue.push({dx:(e.clientX-lastMX)*2.4, dy:(e.clientY-lastMY)*2.4}); lastMX=e.clientX; lastMY=e.clientY; } });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('gesturestart',e=>e.preventDefault());
  document.addEventListener('dblclick',e=>e.preventDefault());
  // ---- touch: left stick ----
  const stick=document.getElementById('stick'), knob=document.getElementById('stick-knob');
  const camZone=document.getElementById('cam-zone');
  const setKnob=(dx,dy)=>{ knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  stick.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0];
    Input._stickId=t.identifier; const r=stick.getBoundingClientRect(); Input._stickCX=r.left+r.width/2; Input._stickCY=r.top+r.height/2;
  },{passive:false});
  const stickMove=e=>{ for(const t of e.changedTouches){ if(t.identifier===Input._stickId){
    let dx=t.clientX-Input._stickCX, dy=t.clientY-Input._stickCY;
    const max=48; const len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max; dy=dy/len*max;}
    setKnob(dx,dy); Input.move.x=dx/max; Input.move.y=-dy/max; } } };
  stick.addEventListener('touchmove',e=>{e.preventDefault(); stickMove(e);},{passive:false});
  const stickEnd=e=>{ for(const t of e.changedTouches){ if(t.identifier===Input._stickId){ Input._stickId=null; Input.move.x=0; Input.move.y=0; setKnob(0,0);} } };
  stick.addEventListener('touchend',stickEnd); stick.addEventListener('touchcancel',stickEnd);
  // ---- touch: camera drag ----
  let lastCX=0,lastCY=0;
  camZone.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; Input._camId=t.identifier; lastCX=t.clientX; lastCY=t.clientY; },{passive:false});
  camZone.addEventListener('touchmove',e=>{ e.preventDefault();
    for(const t of e.changedTouches){ if(t.identifier===Input._camId){
      Input._lookQueue.push({dx:(t.clientX-lastCX)*3.2, dy:(t.clientY-lastCY)*3.2}); lastCX=t.clientX; lastCY=t.clientY; } }
  },{passive:false});
  const camEnd=e=>{ for(const t of e.changedTouches){ if(t.identifier===Input._camId) Input._camId=null; } };
  camZone.addEventListener('touchend',camEnd); camZone.addEventListener('touchcancel',camEnd);
  // ---- touch buttons ----
  const bind=(id,down,up)=>{ const el=document.getElementById(id);
    el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();down();},{passive:false});
    el.addEventListener('touchend',e=>{e.preventDefault();up&&up();},{passive:false});
    el.addEventListener('mousedown',e=>{e.preventDefault();down();}); el.addEventListener('mouseup',()=>up&&up()); };
  bind('tb-fire',()=>{Input.firing=true;callbacks.onFireStart&&callbacks.onFireStart();},()=>{Input.firing=false;callbacks.onFireEnd&&callbacks.onFireEnd();});
  bind('tb-jump',()=>{callbacks.onJump&&callbacks.onJump();});
  bind('tb-e',()=>callbacks.onAbility&&callbacks.onAbility('E'));
  bind('tb-s',()=>callbacks.onAbility&&callbacks.onAbility('SHIFT'));
  bind('tb-ult',()=>callbacks.onUlt&&callbacks.onUlt());
  bind('tb-aim',()=>{Input.aiming=true;},{});
  // cooldown buttons also clickable via mouse for desktop testing
  const cdb=(id,fn)=>{const el=document.getElementById(id); el.addEventListener('click',()=>fn());};
  cdb('cd-e',()=>callbacks.onAbility&&callbacks.onAbility('E'));
  cdb('cd-s',()=>callbacks.onAbility&&callbacks.onAbility('SHIFT'));
  cdb('cd-u',()=>callbacks.onUlt&&callbacks.onUlt());
  document.getElementById('tb-aim').addEventListener('touchend',()=>{Input.aiming=false;});
  // prevent page scroll/zoom globally on game surfaces
  ['game-canvas','touch-ui','hud'].forEach(id=>{ const el=document.getElementById(id);
    el&&el.addEventListener('touchmove',e=>e.preventDefault(),{passive:false}); });
}
export function pollMoveFromKeys(){
  let x=0,y=0; const k=Input.keys;
  if(k['KeyW']||k['ArrowUp'])y+=1; if(k['KeyS']||k['ArrowDown'])y-=1;
  if(k['KeyA']||k['ArrowLeft'])x-=1; if(k['KeyD']||k['ArrowRight'])x+=1;
  if(x||y){ const l=Math.hypot(x,y); Input.move.x=x/l; Input.move.y=y/l; }
  else if(Input._stickId===null){ Input.move.x=0; Input.move.y=0; }
}
export function consumeLook(){
  let dx=0,dy=0; const q=Input._lookQueue;
  for(let i=0;i<q.length;i++){dx+=q[i].dx;dy+=q[i].dy;} q.length=0;
  return {dx:dx*0.0022*Input.sens, dy:dy*0.0022*Input.sens};
}
export function applySettings(s){ Input.sens=s.sens;
  const scale=s.btnsize||1, op=s.opacity??0.9;
  document.querySelectorAll('.tb,.cd,.stick').forEach(el=>{ el.style.opacity=op; });
  document.querySelector('.touch-btns').style.transform=`scale(${scale})`;
  document.querySelector('.touch-btns').style.transformOrigin='bottom right';
}
