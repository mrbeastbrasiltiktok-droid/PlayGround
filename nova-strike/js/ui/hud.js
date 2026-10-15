// HUD bindings: hero cards, scores, killfeed, banners, cooldown sweeps,
// charge ring, settings panel, fullscreen + portrait guard.
import { HEROES } from '../core/config.js';

export function heroColor(h) { return '#' + h.colors.primary.toString(16).padStart(6, '0'); }
export function heroGlow(h) { return '#' + h.colors.glow.toString(16).padStart(6, '0'); }

export class HUD {
  constructor() {
    const $ = id => document.getElementById(id);
    this.el = {
      hud: $('hud'), menu: $('menu'), end: $('end'), death: $('death'), settings: $('settings'),
      scoreBlue: $('score-blue'), scoreRed: $('score-red'), timer: $('timer'),
      killfeed: $('killfeed'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
      banner: $('ult-banner'), chargeBanner: $('charge-banner'),
      hpbar: $('hpbar'), hptext: $('hptext'), energybar: $('energybar'),
      ultbar: $('ultbar'), ulttext: $('ulttext'), ultwrap: $('ultwrap'),
      heroName: $('hero-name'), stateNote: $('state-note'), cards: $('hero-cards'),
      play: $('play-btn'), quality: $('quality'), difficulty: $('difficulty'),
      mute: $('mute-btn'), controls: $('controls-btn'), fs: $('fs-btn'), fs2: $('fs-btn-2'),
      gear: $('gear'), again: $('again-btn'), change: $('change-btn'),
      endTitle: $('end-title'), endSub: $('end-sub'), endStats: $('end-stats'),
      deathN: $('respawn-n'), deathTitle: $('death-title'), deathSub: $('death-sub'),
      dmg: $('dmgflash'), loading: $('loading'),
      stick: $('stick'), knob: $('knob'), lookPad: $('lookPad'), joyZone: $('joyZone'),
      btnFire: $('btnFire'), btnAim: $('btnAim'), btnJump: $('btnJump'),
      btnDash: $('btnDash'), btnAbility: $('btnAbility'), btnAb1: $('btnAbility'),
      btnUlt: $('btnUlt'), btnAb2: $('btnJump'),
      btnAscend: $('btnAscend'), btnDescend: $('btnDescend'),
      sSens: $('s-sens'), sSize: $('s-size'), sOpac: $('s-opac'),
      sAssist: $('s-assist'), sInvert: $('s-invert'), sQuality: $('s-quality'), sClose: $('s-close'),
      vSens: $('v-sens'), vSize: $('v-size'), vOpac: $('v-opac'),
      lifeL: $('life-l'), lifeR: $('life-r'),
    };
    this.selected = 'vanguard';
    this.buildCards();
  }

  buildCards() {
    this.el.cards.innerHTML = '';
    for (const [id, h] of Object.entries(HEROES)) {
      const d = document.createElement('div');
      d.className = 'hero-card' + (id === this.selected ? ' sel' : '');
      d.innerHTML = `<div class="swatch" style="background:linear-gradient(135deg,${heroColor(h)},${heroGlow(h)})"></div>
        <h3>${h.name}</h3><div class="t">${h.title}</div><p>${h.desc}</p>
        <div class="ult">ULT: ${h.ult.name}</div>`;
      d.onclick = () => {
        this.selected = id;
        this.el.cards.querySelectorAll('.hero-card').forEach(e => e.classList.remove('sel'));
        d.classList.add('sel');
      };
      this.el.cards.appendChild(d);
    }
  }

  showGame() { this.el.menu.classList.add('hidden'); this.el.end.classList.add('hidden'); this.el.hud.classList.remove('hidden'); }
  showMenu() { this.el.menu.classList.remove('hidden'); this.el.end.classList.add('hidden'); this.el.hud.classList.add('hidden'); }
  showEnd() { this.el.end.classList.remove('hidden'); }

  setScores(b, r) { this.el.scoreBlue.textContent = b; this.el.scoreRed.textContent = r; }
  setTimer(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    this.el.timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }
  feed(html) {
    const d = document.createElement('div');
    d.className = 'kf'; d.innerHTML = html;
    this.el.killfeed.prepend(d);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 4500);
  }
  banner(text) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
  }
  chargeBanner() {
    this.el.chargeBanner.classList.remove('show');
    void this.el.chargeBanner.offsetWidth;
    this.el.chargeBanner.classList.add('show');
  }
  hitmark() {
    this.el.hitmarker.classList.remove('pop');
    void this.el.hitmarker.offsetWidth;
    this.el.hitmarker.classList.add('pop');
  }
  damageFlash() {
    this.el.dmg.style.opacity = 1;
    clearTimeout(this._df);
    this._df = setTimeout(() => this.el.dmg.style.opacity = 0, 130);
  }
  setPlayer(hp, max, energy, ult, heroName, note) {
    const k = Math.max(0, hp / max);
    this.el.hpbar.style.width = (k * 100) + '%';
    this.el.hpbar.style.background = k > 0.5 ? 'linear-gradient(90deg,#29e07c,#a8ff5e)' : k > 0.25 ? 'linear-gradient(90deg,#ffb03c,#ffd94d)' : 'linear-gradient(90deg,#ff4a3c,#ff8a7a)';
    this.el.hptext.textContent = `${Math.ceil(Math.max(0, hp))} / ${max}`;
    this.el.lifeL.textContent = Math.ceil(hp);
    this.el.lifeR.textContent = Math.ceil(max - hp);
    this.el.energybar.style.width = (energy * 100) + '%';
    this.el.ultbar.style.width = Math.min(100, ult) + '%';
    this.el.ulttext.textContent = ult >= 100 ? 'ULT READY' : `ULT ${Math.floor(ult)}%`;
    this.el.ultwrap.classList.toggle('ready', ult >= 100);
    this.el.btnUlt.classList.toggle('ready', ult >= 100);
    this.el.heroName.textContent = heroName;
    this.el.stateNote.textContent = note || '';
  }

  // circular cooldown sweep (0..1 progress -> dark sweep)
  setCd(el, cd, cdMax) {
    if (!el) return;
    const k = cdMax > 0 ? Math.max(0, Math.min(1, cd / cdMax)) : 0;
    el.style.setProperty('--sweep', ((1 - k) * 100).toFixed(1) + '%');
    el.style.opacity = k > 0 ? '1' : '0';
  }
  setCharge(el, charge01) {
    if (!el) return;
    el.style.setProperty('--sweep', (Math.min(1, charge01) * 100).toFixed(1) + '%');
    el.parentElement?.classList.toggle('charging', charge01 > 0.02 && charge01 < 1);
  }

  setDeath(show, n) {
    this.el.death.classList.toggle('hidden', !show);
    if (show) this.el.deathN.textContent = n;
  }
}
