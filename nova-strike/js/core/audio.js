// Synthesized WebAudio SFX + ambient hum. No external assets.
export class GameAudio {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false; this.humOsc = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startHum();
    } catch (e) { /* audio unavailable */ }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  startHum() {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 48;
    g.gain.value = 0.018;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
  }
  env(node, t0, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  blip(freq, dur = 0.12, type = 'square', vol = 0.2, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur = 0.3, vol = 0.4, lp = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = this.ctx.createGain(); this.env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  shoot(hero) {
    if (hero === 'vanguard') this.blip(880 + Math.random() * 120, 0.1, 'sawtooth', 0.12, -500);
    else if (hero === 'phoenix') this.blip(520 + Math.random() * 80, 0.16, 'triangle', 0.2, 300);
    else this.blip(300 + Math.random() * 60, 0.18, 'sawtooth', 0.2, -120);
  }
  hit() { this.blip(220, 0.08, 'square', 0.18, -100); }
  hurt() { this.blip(140, 0.2, 'sawtooth', 0.25, -60); this.noise(0.15, 0.2, 800); }
  explosion(big = false) { this.noise(big ? 0.9 : 0.45, big ? 0.6 : 0.4, big ? 900 : 1400); this.blip(big ? 60 : 90, 0.5, 'sine', 0.4, -30); }
  beam() { this.blip(1200, 0.6, 'sawtooth', 0.14, -700); this.noise(0.5, 0.2, 3000); }
  dash() { this.noise(0.2, 0.25, 2500); }
  ult() { this.blip(200, 0.8, 'sawtooth', 0.3, 600); this.noise(0.7, 0.35, 2000); }
  ui() { this.blip(660, 0.06, 'sine', 0.15); }
  respawn() { this.blip(440, 0.25, 'sine', 0.2, 440); }
  kill() { this.blip(520, 0.12, 'square', 0.2, 260); setTimeout(() => this.blip(780, 0.14, 'square', 0.2, 260), 90); }
}
