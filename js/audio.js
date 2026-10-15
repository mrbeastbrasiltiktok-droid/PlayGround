// Procedural WebAudio SFX + music. No external assets.
let ctx=null, master=null, musicGain=null, sfxGain=null;
let music={sens:0.5, sfx:0.8}, noiseBuf=null, musicTimer=null, musicStep=0;
export function initAudio(){ if(ctx) return;
  try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
  master=ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
  musicGain=ctx.createGain(); musicGain.gain.value=music.sens; musicGain.connect(master);
  sfxGain=ctx.createGain(); sfxGain.gain.value=music.sfx; sfxGain.connect(master);
  noiseBuf=ctx.createBuffer(1, ctx.sampleRate*1, ctx.sampleRate);
  const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
}
export function resumeAudio(){ initAudio(); if(ctx&&ctx.state==='suspended') ctx.resume(); }
export function setVolumes(m,s){ music.sens=m; music.sfx=s;
  if(musicGain) musicGain.gain.value=m; if(sfxGain) sfxGain.gain.value=s; }
function env(g,t0,a,peak,dur){ g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(peak,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur); }
export function sfx(name,opts={}){
  if(!ctx) return; const t=ctx.currentTime; const vol=opts.vol??1;
  const pan=opts.pan??0; const out=ctx.createGain(); out.gain.value=vol;
  let panner=null;
  try{ panner=ctx.createStereoPanner(); panner.pan.value=Math.max(-1,Math.min(1,pan)); panner.connect(sfxGain); out.connect(panner);}catch(e){ out.connect(sfxGain); }
  const osc=(type,f0,f1,dur,peak=0.5)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); env(g,t,0.005,peak,dur); o.connect(g); g.connect(out); o.start(t); o.stop(t+dur+0.05); };
  const noise=(dur,peak=0.4,fc=1200,q=0.7,type='bandpass')=>{ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=fc; f.Q.value=q; const g=ctx.createGain(); env(g,t,0.004,peak,dur); s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t+dur+0.05); };
  switch(name){
    case 'shoot': osc('square',880+Math.random()*120,180,0.09,0.25); noise(0.06,0.18,3200); break;
    case 'shoot_heavy': osc('sawtooth',220,60,0.22,0.5); noise(0.18,0.4,700,0.5,'lowpass'); break;
    case 'rail': osc('sawtooth',1400,120,0.3,0.4); noise(0.25,0.3,5000); break;
    case 'melee': noise(0.12,0.4,2400); osc('triangle',300,90,0.12,0.35); break;
    case 'orb': osc('sine',520,980,0.18,0.3); break;
    case 'hit': osc('square',300,140,0.06,0.3); break;
    case 'hitmark': osc('sine',1400,1400,0.05,0.25); break;
    case 'kill': osc('square',500,1200,0.16,0.35); osc('sine',200,600,0.2,0.3); break;
    case 'hurt': osc('sawtooth',180,70,0.18,0.4); noise(0.12,0.25,500,0.6,'lowpass'); break;
    case 'heal': osc('sine',440,880,0.25,0.22); osc('sine',660,1320,0.3,0.15); break;
    case 'dash': noise(0.25,0.3,900,2,'highpass'); osc('sine',200,800,0.2,0.2); break;
    case 'jump': osc('sine',250,520,0.12,0.18); break;
    case 'land': noise(0.1,0.3,300,0.6,'lowpass'); break;
    case 'step': noise(0.05,0.1,600,0.5,'lowpass'); break;
    case 'reload': osc('square',400,800,0.06,0.2); setTimeout(()=>sfx('hitmark',{vol:0.4}),90); break;
    case 'ability': osc('sine',300,900,0.3,0.35); noise(0.2,0.15,2000); break;
    case 'wall': osc('sawtooth',120,300,0.4,0.3); noise(0.3,0.2,800); break;
    case 'explosion': noise(0.8,0.7,180,0.4,'lowpass'); osc('sine',90,30,0.7,0.6); break;
    case 'ult_ready': osc('sine',660,660,0.12,0.3); setTimeout(()=>osc('sine',880,880,0.15,0.3),130); break;
    case 'ult': osc('sawtooth',80,800,0.8,0.4); noise(0.7,0.35,1500); break;
    case 'beam': osc('sawtooth',180,240,0.3,0.3); break;
    case 'click': osc('sine',700,700,0.05,0.22); break;
    case 'select': osc('sine',520,780,0.12,0.3); break;
    case 'lock': osc('square',440,880,0.2,0.3); noise(0.15,0.2,3000); break;
    case 'count': osc('sine',440,440,0.15,0.35); break;
    case 'go': osc('sine',880,880,0.4,0.4); break;
    case 'cap': osc('sine',600,1200,0.4,0.3); break;
    case 'win': [523,659,784,1046].forEach((f,i)=>setTimeout(()=>{if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();const tt=ctx.currentTime;o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.3,tt);g.gain.exponentialRampToValueAtTime(0.001,tt+0.4);o.connect(g);g.connect(sfxGain);o.start(tt);o.stop(tt+0.45);},i*140)); break;
    case 'lose': [400,340,280,200].forEach((f,i)=>setTimeout(()=>{if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();const tt=ctx.currentTime;o.type='sawtooth';o.frequency.value=f;g.gain.setValueAtTime(0.25,tt);g.gain.exponentialRampToValueAtTime(0.001,tt+0.4);o.connect(g);g.connect(sfxGain);o.start(tt);o.stop(tt+0.45);},i*160)); break;
    case 'announce': osc('square',330,330,0.12,0.3); break;
    default: osc('sine',440,440,0.08,0.2);
  }
}
const SCALE=[0,3,5,7,10,12,15];
export function startMusic(){ if(!ctx||musicTimer) return;
  musicTimer=setInterval(()=>{ if(!ctx||ctx.state!=='running') return;
    const root=110; const deg=SCALE[musicStep%SCALE.length]+(musicStep%16>=8?12:0);
    const f=root*Math.pow(2,deg/12);
    try{ const o=ctx.createOscillator(),g=ctx.createGain(),fl=ctx.createBiquadFilter();
      o.type='sawtooth'; o.frequency.value=f; fl.type='lowpass'; fl.frequency.value=600;
      const t=ctx.currentTime; g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.06,t+0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
      o.connect(fl); fl.connect(g); g.connect(musicGain); o.start(t); o.stop(t+0.55);
      if(musicStep%4===0){ const k=ctx.createOscillator(),kg=ctx.createGain(); k.type='sine'; k.frequency.value=root/2;
        kg.gain.setValueAtTime(0.12,t); kg.gain.exponentialRampToValueAtTime(0.0001,t+0.6); k.connect(kg); kg.connect(musicGain); k.start(t); k.stop(t+0.65); }
    }catch(e){} musicStep++;
  },240);
}
export function stopMusic(){ if(musicTimer){clearInterval(musicTimer); musicTimer=null;} }
