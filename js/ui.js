// UI: screens, hero select/gallery 3D previews, HUD, killfeed, scoreboard, results.
import * as THREE from 'three';
import { HEROES, MODES } from './config.js';
import { buildHeroMesh } from './models.js';
import { Animator } from './anim.js';
import { sfx } from './audio.js';
export class UI {
  constructor(settings){
    this.s=settings;
    this.screens=['loading-screen','intro-screen','menu-screen','mode-screen','select-screen','gallery-screen','how-screen','settings-screen','result-screen'];
    this.history=[];
    this.selHero=HEROES[0].id; this.previewHero=HEROES[0].id; this.mode='control';
    this.preview=null; this.bindNav();
    this.buildHeroGrids();
    this.buildMenuStrip();
  }
  show(id){ for(const s of this.screens) document.getElementById(s).classList.toggle('visible',s===id);
    document.getElementById('pause-screen').classList.remove('visible');
    document.getElementById('board-screen').classList.remove('visible');
    if(id) { this.history.push(id); if(this.history.length>12) this.history.shift(); }
    if(id==='menu-screen') sfx('click'); }
  back(){ this.history.pop(); const prev=this.history[this.history.length-2]||'menu-screen';
    for(const s of this.screens) document.getElementById(s).classList.remove('visible');
    document.getElementById(prev).classList.add('visible'); sfx('click'); }
  bindNav(){
    document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{sfx('click');this.back();}));
    document.querySelector('[data-close-board]').addEventListener('click',()=>{document.getElementById('board-screen').classList.remove('visible');});
    const on=(id,fn)=>document.getElementById(id).addEventListener('click',()=>{sfx('click');fn();});
    on('btn-intro-skip',()=>this.show('menu-screen'));
    on('btn-intro-start',()=>this.show('menu-screen'));
    on('btn-play',()=>this.show('mode-screen'));
    on('btn-gallery',()=>{this.show('gallery-screen');this.gallerySelect(this.selHero);});
    on('btn-training',()=>{this.mode='training';this.openSelect();});
    on('btn-settings',()=>this.show('settings-screen'));
    on('btn-how',()=>this.show('how-screen'));
    document.querySelectorAll('.mode-card').forEach(c=>c.addEventListener('click',()=>{sfx('select');this.mode=c.dataset.mode;
      if(this.mode==='training'){ window.dispatchEvent(new CustomEvent('starttraining')); } else this.openSelect(); }));
    on('btn-lock',()=>{sfx('lock');window.dispatchEvent(new CustomEvent('lockin'));});
    on('btn-resume',()=>document.getElementById('pause-screen').classList.remove('visible'));
    on('btn-quit',()=>window.dispatchEvent(new CustomEvent('quitmatch')));
    on('btn-again',()=>window.dispatchEvent(new CustomEvent('playagain')));
    on('btn-tomenu',()=>window.dispatchEvent(new CustomEvent('tomenu')));
    on('btn-pause-settings',()=>this.show('settings-screen'));
    on('btn-pause',()=>document.getElementById('pause-screen').classList.add('visible'));
    on('btn-board',()=>this.openBoard());
    // settings bindings
    const sv=(id,fn)=>document.getElementById(id).addEventListener('input',e=>fn(e));
    sv('set-sens',e=>{this.s.sens=parseFloat(e.target.value);document.getElementById('set-sens-v').textContent=this.s.sens.toFixed(1);window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-aim',e=>{this.s.aim=e.target.checked;window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-btnsize',e=>{this.s.btnsize=parseFloat(e.target.value);document.getElementById('set-btnsize-v').textContent=this.s.btnsize.toFixed(2);window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-opacity',e=>{this.s.opacity=parseFloat(e.target.value);document.getElementById('set-opacity-v').textContent=this.s.opacity.toFixed(2);window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-quality',e=>{this.s.quality=e.target.value;window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-music',e=>{this.s.music=parseFloat(e.target.value);window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-sfx',e=>{this.s.sfx=parseFloat(e.target.value);window.dispatchEvent(new CustomEvent('settings'));});
    sv('set-shake',e=>{this.s.shake=e.target.checked;});
  }
  buildMenuStrip(){ const el=document.getElementById('menu-hero-strip'); el.innerHTML='';
    for(const h of HEROES){ const d=document.createElement('div'); d.className='mstrip'; d.innerHTML=`<i>${h.icon}</i>${h.name}`; el.appendChild(d); } }
  buildHeroGrids(){
    const mk=(host,cb,small)=>{ const el=document.getElementById(host); el.innerHTML='';
      for(const h of HEROES){ const b=document.createElement('div'); b.className='hero-card'; b.dataset.hero=h.id;
        b.innerHTML=`<i>${h.icon}</i><b>${h.name}</b><small>${h.role}</small>`;
        b.addEventListener('click',()=>{sfx('select');cb(h.id);}); el.appendChild(b); } };
    mk('hero-grid',id=>this.selectHero(id));
    mk('gal-grid',id=>this.gallerySelect(id),true);
  }
  // ---- select ----
  openSelect(){ this.show('select-screen'); this.selectHero(this.selHero);
    this.teamMates=this.pickMates(); this.renderTeamPreview(); this.startSelectTimer(); }
  pickMates(){ const pool=HEROES.map(h=>h.id).filter(id=>id!==this.selHero);
    return [pool[Math.floor(Math.random()*pool.length)],pool[Math.floor(Math.random()*pool.length)]]; }
  renderTeamPreview(){ const el=document.getElementById('team-preview'); const H=id=>HEROES.find(h=>h.id===id);
    el.innerHTML=`<div class="tmate" title="YOU">${H(this.selHero).icon}</div>`+this.teamMates.map(id=>`<div class="tmate">${H(id).icon}</div>`).join('')+`<div class="tmate">?</div><div class="tmate">?</div><div class="tmate">?</div>`; }
  selectHero(id){ this.selHero=id;
    document.querySelectorAll('#hero-grid .hero-card').forEach(c=>c.classList.toggle('sel',c.dataset.hero===id));
    const h=HEROES.find(x=>x.id===id);
    document.getElementById('select-name').textContent=h.name;
    document.getElementById('select-role').textContent=h.role+' • '+h.weapon.name;
    document.getElementById('select-desc').textContent=h.desc;
    document.getElementById('select-diff').textContent=h.diff+'  •  HP '+h.hp;
    document.getElementById('select-abilities').innerHTML=
      `<div class="ab"><b>◉ ${h.weapon.name} — ${h.weapon.type.toUpperCase()}</b><span>DMG ${h.weapon.dmg} • ${h.weapon.rpm} RPM${h.weapon.splash?' • AoE '+h.weapon.splash+'m':''}</span></div>`+
      h.abilities.map(a=>`<div class="ab"><b>${a.slot} — ${a.name} (${a.cd}s)</b><span>${a.desc}</span></div>`).join('')+
      `<div class="ab"><b>★ ${h.ult.name} — ULTIMATE</b><span>${h.ult.desc}</span></div>`;
    this.teamMates=this.pickMates(); this.renderTeamPreview();
    this.loadSelectPreview(id); }
  startSelectTimer(){ let n=25; const el=document.getElementById('select-timer'); el.textContent=n;
    if(this._selT) clearInterval(this._selT);
    this._selT=setInterval(()=>{ n--; el.textContent=n;
      if(n<=0){ clearInterval(this._selT); window.dispatchEvent(new CustomEvent('lockin')); } },1000); }
  stopSelectTimer(){ if(this._selT) clearInterval(this._selT); }
  loadSelectPreview(id){ this.previewHero=id; }
  // gallery shares preview renderer via main loop
  gallerySelect(id){ document.querySelectorAll('#gal-grid .hero-card').forEach(c=>c.classList.toggle('sel',c.dataset.hero===id));
    const h=HEROES.find(x=>x.id===id); this.previewHero=id;
    document.getElementById('gal-name').textContent=`${h.icon} ${h.name} — ${h.role}`;
    document.getElementById('gal-story').textContent=h.story+' '+h.desc;
    document.getElementById('gal-stats').innerHTML=`<div class="stat">HP<b>${h.hp}</b></div><div class="stat">SPEED<b>${h.speed}</b></div><div class="stat">MOBILITY<b>${'●'.repeat(h.stats.mob)}${'○'.repeat(5-h.stats.mob)}</b></div><div class="stat">DAMAGE<b>${'●'.repeat(h.stats.dmg)}${'○'.repeat(5-h.stats.dmg)}</b></div><div class="stat">SURVIVAL<b>${'●'.repeat(h.stats.surv)}${'○'.repeat(5-h.stats.surv)}</b></div><div class="stat">PRIMARY<b>${h.weapon.name}</b></div><div class="stat">ULT<b>${h.ult.name}</b></div>`; }
  // ---- HUD ----
  hudOn(on){ document.getElementById('hud').classList.toggle('visible',on); }
  setLoading(pct,msg){ document.getElementById('load-bar').style.width=(pct*100).toFixed(0)+'%';
    if(msg) document.getElementById('load-status').textContent=msg; }
  toast(msg,ms=2200){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
    clearTimeout(this._toastT); this._toastT=setTimeout(()=>t.classList.remove('show'),ms); }
  killfeed(a,b,ta,tb,hl){ const kf=document.getElementById('killfeed'); const d=document.createElement('div');
    d.className='kf'; d.innerHTML=`<b class="${ta==='A'?'a':'b'}">${a}</b> ⚔ <b class="${tb==='A'?'a':'b'}">${b}</b>`;
    if(hl){d.style.borderColor='#ffb300';} kf.prepend(d); while(kf.children.length>5) kf.lastChild.remove();
    setTimeout(()=>d.remove(),5000); }
  hitmarker(kill){ const h=document.getElementById('hitmarker'); h.classList.remove('pop'); void h.offsetWidth;
    h.classList.toggle('kill',!!kill); h.classList.add('pop'); sfx('hitmark',{vol:0.4}); }
  damageFlash(){ const v=document.getElementById('dmg-vignette'); v.style.opacity=0.9; clearTimeout(this._dv); this._dv=setTimeout(()=>v.style.opacity=0,180); }
  healFlash(){ const v=document.getElementById('heal-vignette'); v.style.opacity=0.9; clearTimeout(this._hv); this._hv=setTimeout(()=>v.style.opacity=0,300); }
  ultBanner(txt){ const b=document.getElementById('ult-banner'); b.textContent='★ '+txt+' ★'; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); sfx('announce'); }
  showRespawn(by,secs){ document.getElementById('respawn-overlay').classList.add('visible');
    document.getElementById('respawn-by').textContent=by?('by '+by):''; document.getElementById('respawn-in').textContent=secs; }
  updateRespawn(s){ document.getElementById('respawn-in').textContent=s; }
  hideRespawn(){ document.getElementById('respawn-overlay').classList.remove('visible'); }
  announceScore(a,b,target){ if(a===target-5||b===target-5) this.toast('MATCH POINT — 5 eliminations left!'); }
  countdown(n,sub){ const c=document.getElementById('count-screen'); c.classList.add('visible');
    document.getElementById('count-num').textContent=n; document.getElementById('count-sub').textContent=sub||'';
    if(n==='GO'){ setTimeout(()=>c.classList.remove('visible'),700); } }
  hideCountdown(){ document.getElementById('count-screen').classList.remove('visible'); }
  fmtTime(s){ if(s===Infinity) return '∞'; s=Math.max(0,Math.ceil(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  updateHUD(m){
    document.getElementById('hud-timer').textContent=this.fmtTime(m.timeLeft)+(m.overtime?' OT':'');
    if(m.mode==='control'){ document.getElementById('hud-score-a').textContent=Math.floor(m.capA)+'%';
      document.getElementById('hud-score-b').textContent=Math.floor(m.capB)+'%';
      document.getElementById('hud-obj').textContent=m.contested()?'⚠ CONTESTED':(m.holder?`◉ ${m.holder==='A'?'ALLY':'ENEMY'} HOLDING`:'◉ CAPTURE');
    } else if(m.mode==='tdm'){ document.getElementById('hud-score-a').textContent=m.scoreA;
      document.getElementById('hud-score-b').textContent=m.scoreB;
      document.getElementById('hud-obj').textContent=`FIRST TO 30`; }
    else { document.getElementById('hud-score-a').textContent='◎'; document.getElementById('hud-score-b').textContent='◎';
      document.getElementById('hud-obj').textContent='TRAINING'; document.getElementById('hud-timer').textContent='∞'; }
    const p=m.player;
    document.getElementById('hp-num').textContent=Math.ceil(p.hp);
    document.getElementById('hp-max').textContent='/ '+p.maxHp+(p.ammo!==Infinity&&p.def.weapon.mag?` • AMMO ${p.reloading?'…':p.ammo}`:'');
    document.getElementById('hp-fill').style.width=(100*p.hp/p.maxHp)+'%';
    document.getElementById('ult-fill').style.width=p.ultCharge+'%';
    document.getElementById('ult-pct').textContent=(p.ultCharge>=100?'ULT READY ★':Math.floor(p.ultCharge)+'%');
    document.getElementById('cd-u').classList.toggle('ready',p.ultCharge>=100);
    const cd=(id,v,total)=>{ const el=document.getElementById(id); const bar=el.querySelector('i');
      const frac=v>0?Math.max(0,v/total):0; bar.style.transform=`scaleY(${frac})`; el.style.opacity=v>0?0.75:1; };
    cd('cd-e',Math.max(0,p.cdE),p.def.abilities[0].cd); cd('cd-s',Math.max(0,p.cdS),p.def.abilities[1].cd);
    cd('cd-u',p.ultCharge>=100?0:1,1);
    // objective marker: project point to screen
    // (position updated in main via camera; simple distance here)
    document.getElementById('obj-dist').textContent=Math.round(p.pos.distanceTo(m.pointPos()))+'m';
  }
  openBoard(){ const b=document.getElementById('board-screen'); b.classList.add('visible'); }
  renderBoard(m){ const rows=document.getElementById('board-rows'); rows.innerHTML='';
    document.getElementById('board-title').textContent=`${MODES[m.mode].name} — ${this.fmtTime(m.timeLeft)}`;
    for(const t of ['A','B']){ const h=document.createElement('div'); h.className='brow';
      h.innerHTML=`<b>TEAM ${t==='A'?'🔷 ALLIES':'🔶 RIVALS'}</b>`; rows.appendChild(h);
      for(const c of m.chars.filter(c=>c.team===t)){ const r=document.createElement('div'); r.className='brow';
        r.innerHTML=`<span>${c.def.icon}</span><span class="nm">${c.name} <small style="color:#9aa7c7">${c.def.name}</small></span><span class="st">${c.kills}/${c.deaths} • ${Math.round(c.dmgDealt)} dmg</span>`;
        rows.appendChild(r); } } }
  showResults(m){ this.hudOn(false); this.show('result-screen');
    const win=m.winner==='A';
    const banner=document.getElementById('result-banner');
    banner.textContent=win?'VICTORY':'DEFEAT'; banner.className='result-banner '+(win?'win':'lose');
    const mv=m.endInfo.mvp;
    document.getElementById('result-mvp').innerHTML=`⭐ MVP — ${mv.def.icon} ${mv.name} (${mv.def.name}) • ${mv.kills} ELIMS • ${Math.round(mv.dmgDealt)} DMG${mv.healDone>50?` • ${Math.round(mv.healDone)} HEAL`:''}`;
    const rows=document.getElementById('result-rows'); rows.innerHTML='';
    [...m.chars].sort((a,b)=>b.kills-a.kills).forEach(c=>{ const r=document.createElement('div');
      r.className='brow'+(c===mv?' mvp':'');
      r.innerHTML=`<span>${c.def.icon}</span><span class="nm">${c.name} — ${c.def.name}</span><span class="st">K ${c.kills} / D ${c.deaths} / ${Math.round(c.dmgDealt)} / OBJ ${Math.round(c.objTime)}s</span>`;
      rows.appendChild(r); });
    document.querySelectorAll('#board-screen').forEach(e=>e.classList.remove('visible'));
    document.getElementById('pause-screen').classList.remove('visible');
    this.hideRespawn(); }
}
