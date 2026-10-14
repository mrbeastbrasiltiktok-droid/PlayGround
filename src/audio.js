// Synthesized professional audio: per-character identity, no external assets.
let ctx = null, master = null, musicGain = null, sfxGain = null, muted = false, musicTimer = null;

export function audioInit() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  } catch { /* no audio */ }
}
export function audioResume() { audioInit(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.8;
  return muted;
}
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function noiseBuffer(dur) {
  const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function playNoise({ dur = 0.4, freq = 1000, q = 1, peak = 0.5, type = 'bandpass', sweepTo = null }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); env(g, t, 0.01, peak, dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.1);
}
function playTone({ freq = 440, freq2 = null, dur = 0.3, peak = 0.4, type = 'sine', delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  const g = ctx.createGain(); env(g, t, 0.012, peak, dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur + 0.15);
}
export const sfx = {
  ui() { playTone({ freq: 700, freq2: 950, dur: 0.09, peak: 0.25, type: 'triangle' }); },
  select() { playTone({ freq: 520, freq2: 1040, dur: 0.22, peak: 0.35 }); playTone({ freq: 1560, dur: 0.15, peak: 0.15, delay: 0.08 }); },
  swing() { playNoise({ dur: 0.16, freq: 2600, sweepTo: 700, peak: 0.28 }); },
  hit(f = 180) { playNoise({ dur: 0.22, freq: 900, sweepTo: 150, peak: 0.6, type: 'lowpass' }); playTone({ freq: f, freq2: 60, dur: 0.22, peak: 0.5, type: 'square' }); },
  block() { playTone({ freq: 320, freq2: 180, dur: 0.18, peak: 0.4, type: 'square' }); playNoise({ dur: 0.12, freq: 3200, peak: 0.2, type: 'highpass' }); },
  dash() { playNoise({ dur: 0.25, freq: 1200, sweepTo: 4200, peak: 0.3 }); },
  fire() { playNoise({ dur: 0.7, freq: 600, sweepTo: 220, q: 0.7, peak: 0.55, type: 'lowpass' }); playNoise({ dur: 0.4, freq: 3500, peak: 0.2, type: 'highpass' }); playTone({ freq: 110, freq2: 55, dur: 0.5, peak: 0.35, type: 'sawtooth' }); },
  burn() { playNoise({ dur: 0.5, freq: 2500, peak: 0.15, type: 'highpass' }); },
  shield() { playTone({ freq: 220, freq2: 660, dur: 0.5, peak: 0.35 }); playTone({ freq: 330, freq2: 990, dur: 0.5, peak: 0.2, delay: 0.06 }); },
  rebirth() { playTone({ freq: 130, freq2: 1040, dur: 1.1, peak: 0.5, type: 'sawtooth' }); playNoise({ dur: 1.0, freq: 500, sweepTo: 4000, peak: 0.4 }); },
  force() { playTone({ freq: 300, freq2: 620, dur: 0.45, peak: 0.4 }); playTone({ freq: 905, freq2: 450, dur: 0.5, peak: 0.22, type: 'triangle', delay: 0.04 }); },
  prison() { playTone({ freq: 660, freq2: 220, dur: 0.6, peak: 0.35, type: 'sine' }); playTone({ freq: 1320, freq2: 440, dur: 0.6, peak: 0.15, delay: 0.05 }); },
  invis() { playTone({ freq: 1200, freq2: 200, dur: 0.7, peak: 0.3 }); playNoise({ dur: 0.5, freq: 5000, sweepTo: 800, peak: 0.12, type: 'highpass' }); },
  chaos() { playTone({ freq: 90, freq2: 640, dur: 0.55, peak: 0.5, type: 'sawtooth' }); playTone({ freq: 97, freq2: 700, dur: 0.55, peak: 0.4, type: 'square', delay: 0.03 }); playNoise({ dur: 0.4, freq: 1800, sweepTo: 300, peak: 0.35 }); },
  lift() { playTone({ freq: 150, freq2: 900, dur: 0.8, peak: 0.4, type: 'sawtooth' }); },
  slam() { playNoise({ dur: 0.5, freq: 400, sweepTo: 60, peak: 0.7, type: 'lowpass' }); playTone({ freq: 70, freq2: 35, dur: 0.45, peak: 0.6 }); },
  collapse() { playTone({ freq: 60, freq2: 400, dur: 1.2, peak: 0.55, type: 'sawtooth' }); playNoise({ dur: 1.1, freq: 300, sweepTo: 80, peak: 0.65, type: 'lowpass' }); },
  ko() { playTone({ freq: 400, freq2: 50, dur: 1.0, peak: 0.6, type: 'sawtooth' }); playNoise({ dur: 0.9, freq: 700, sweepTo: 90, peak: 0.6, type: 'lowpass' }); },
  heal() { playTone({ freq: 500, freq2: 1000, dur: 0.4, peak: 0.3, type: 'sine' }); },
  coin() { playTone({ freq: 1320, dur: 0.1, peak: 0.28 }); playTone({ freq: 1760, dur: 0.18, peak: 0.28, delay: 0.08 }); },
};
// Adaptive combat music: dark bass pulse + airy pad, generated loop.
const bassLine = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
let step = 0;
export function startMusic() {
  audioInit();
  if (!ctx || musicTimer) return;
  const tick = () => {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    const root = bassLine[step % bassLine.length];
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = root;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(f); f.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.5);
    if (step % 4 === 0) {
      const p = ctx.createOscillator(); p.type = 'triangle'; p.frequency.value = root * 4;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.exponentialRampToValueAtTime(0.12, t + 0.2);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      p.connect(pg); pg.connect(musicGain); p.start(t); p.stop(t + 1.7);
    }
    step++;
  };
  musicTimer = setInterval(tick, 300);
}
