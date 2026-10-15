// NOVA STRIKE input: floating joystick (lower-left), right-thumb look pad,
// press/hold/release/charge buttons, multitouch with per-pointer tracking.
// Touch input is never interpreted as camera movement when pressing a button.
import { Config } from './config.js';

export class Input {
  constructor(settings) {
    this.settings = settings;
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.ascend = false;      // held
    this.descend = false;     // held
    this.aimHeld = false;
    this.shootHeld = false;
    this.charge = 0; this.chargeReady = false;
    this.shotRequest = 0;     // 1 = tap shot, 2 = charged shot
    this.jumpPressed = false; // edge
    this.jumpHeld = false;
    this.dashPressed = false; // edge
    this.qPressed = false;    // edge
    this.ultPressed = false;  // edge
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this._keys = {};
    this._joy = { x: 0, y: 0 };
    this._joyId = null; this._joyBaseX = 0; this._joyBaseY = 0;
    this._lookId = null; this._lastLookX = 0; this._lastLookY = 0;
    this._stickEl = null; this._knobEl = null;
  }

  attach(canvas, ui) {
    this.ui = ui;
    this._stickEl = ui.stick; this._knobEl = ui.knob;

    // ---------- keyboard + mouse (desktop) ----------
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this._keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashPressed = true;
      if (e.code === 'KeyQ') this.qPressed = true;
      if (e.code === 'KeyR' || e.code === 'KeyF') this.ultPressed = true;
    });
    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
      if (e.code === 'Space') this.jumpHeld = false;
    });
    window.addEventListener('blur', () => { this._keys = {}; this.shootHeld = false; this.ascend = this.descend = false; });

    const lock = () => {
      if (!this.isTouch && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) {}
      }
    };
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') lock(); });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.shootHeld = true; }
      if (e.button === 2) this.aimHeld = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { if (this.shootHeld) this.shotRequest = this.chargeReady ? 2 : 1; this.shootHeld = false; }
      if (e.button === 2) this.aimHeld = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    this.bindTouch();
  }

  isUI(el) { return el && el.closest && el.closest('.tbtn, #stick, .settings-panel, .menu-card, #end'); }

  bindTouch() {
    const R = 56;
    const setStick = (x, y, scale) => {
      const s = this._stickEl.style;
      if (scale !== undefined) s.width = s.height = (112 * scale) + 'px';
      s.left = x + 'px'; s.top = y + 'px'; s.transform = 'translate(-50%,-50%)';
      s.opacity = '1';
      const k = this._knobEl.style;
      k.width = k.height = (48 * scale) + 'px'; k.margin = (-24 * scale) + 'px 0 0 ' + (-24 * scale) + 'px';
    };
    const setKnob = (dx, dy, scale) => {
      this._knobEl.style.transform = `translate(${dx}px,${dy}px) scale(${1 + scale * 0.35})`;
    };
    const homeStick = () => {
      const s = this._stickEl.style;
      s.width = s.height = (112 * this.settings.get('buttonScale')) + 'px';
      s.left = 'calc(env(safe-area-inset-left) + 96px)'; s.top = ''; s.bottom = 'calc(env(safe-area-inset-bottom) + 96px)';
      s.transform = ''; s.opacity = '0.55';
      const k = this._knobEl.style;
      k.width = k.height = (48 * this.settings.get('buttonScale')) + 'px';
      k.margin = (-24 * this.settings.get('buttonScale')) + 'px 0 0 ' + (-24 * this.settings.get('buttonScale')) + 'px';
      k.transform = 'translate(0,0) scale(1)';
    };
    homeStick();
    this._homeStick = homeStick;

    const onStart = e => {
      audioUnlock();
      const joyScale = this.settings.get('buttonScale');
      for (const t of e.changedTouches) {
        const inJoyZone = t.clientX < innerWidth * 0.44 && t.clientY > innerHeight * 0.45 && !this.isUI(t.target);
        if (this._joyId === null && inJoyZone) {
          this._joyId = t.identifier;
          this._joyBaseX = t.clientX; this._joyBaseY = t.clientY;
          setStick(t.clientX, t.clientY, joyScale);
        }
      }
    };
    const onMove = e => {
      const joyScale = this.settings.get('buttonScale');
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          let dx = t.clientX - this._joyBaseX, dy = t.clientY - this._joyBaseY;
          const m = Math.hypot(dx, dy);
          const rad = R * joyScale;
          if (m > rad) { dx *= rad / m; dy *= rad / m; }
          setKnob(dx / joyScale, dy / joyScale, joyScale);
          this._joy.x = dx / rad; this._joy.y = -dy / rad; // screen y down = backward
        } else if (t.identifier === this._lookId) {
          const s = this.settings.get('sensitivity');
          this.look.dx += (t.clientX - this._lastLookX) * 2.6 * s;
          let dy = t.clientY - this._lastLookY;
          this.look.dy += dy * 2.6 * s * (this.settings.get('invertY') ? -1 : 1);
          this._lastLookX = t.clientX; this._lastLookY = t.clientY;
        }
      }
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._joyId = null; this._joy.x = this._joy.y = 0;
          homeStick();
        }
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };

    // joystick zone (separate element for reliable capture, also catches edges)
    const joyZone = this.ui.joyZone;
    joyZone.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
    joyZone.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', e => {
      // look drag: any touch not on a UI button and not the joystick
      const s = this.settings.get('sensitivity');
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) {
          this.look.dx += (t.clientX - this._lastLookX) * 2.6 * s;
          this.look.dy += (t.clientY - this._lastLookY) * 2.6 * s * (this.settings.get('invertY') ? -1 : 1);
          this._lastLookX = t.clientX; this._lastLookY = t.clientY;
        } else if (this._lookId === null && !this.isUI(t.target) && t.identifier !== this._joyId && t.clientX >= innerWidth * 0.34) {
          this._lookId = t.identifier; this._lastLookX = t.clientX; this._lastLookY = t.clientY;
        }
      }
      onMove(e);
    }, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    // ---------- action buttons: press / hold / release ----------
    const B = (el, onPress, onRelease) => {
      if (!el) return;
      const down = e => { e.preventDefault(); e.stopPropagation(); audioUnlock(); onPress(el); };
      const up = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(el); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); audioUnlock(); onPress(el); });
      el.addEventListener('mouseup', e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(el); });
      el.addEventListener('mouseleave', e => { if (el.dataset.held === '1') up(e); });
    };

    B(this.ui.btnFire,
      () => { this.shootHeld = true; this.ui.btnFire.dataset.held = '1'; },
      () => {
        if (this.ui.btnFire.dataset.held !== '1') return;
        this.ui.btnFire.dataset.held = '0';
        if (this.shootHeld) this.shotRequest = this.chargeReady ? 2 : 1;
        this.shootHeld = false;
      });
    B(this.ui.btnAscend,
      () => { this.ascend = true; this.jumpHeld = true; this.ui.btnAscend.dataset.held = '1'; },
      () => { this.ascend = false; this.jumpHeld = false; this.ui.btnAscend.dataset.held = '0'; });
    B(this.ui.btnDescend,
      () => { this.descend = true; this.ui.btnDescend.dataset.held = '1'; },
      () => { this.descend = false; this.ui.btnDescend.dataset.held = '0'; });
    B(this.ui.btnJump,
      () => { this.jumpPressed = true; this.jumpHeld = true; this.ui.btnJump.dataset.held = '1'; },
      () => { this.jumpHeld = false; this.ui.btnJump.dataset.held = '0'; });
    B(this.ui.btnDash, () => this.dashPressed = true);
    B(this.ui.btnAbility, () => this.qPressed = true);
    B(this.ui.btnUlt, () => this.ultPressed = true);
    B(this.ui.btnAim,
      () => { this.aimHeld = !this.aimHeld; this.ui.btnAim.dataset.held = this.aimHeld ? '1' : '0'; });
  }

  // keyboard-driven flags polled each frame
  poll(dt) {
    let x = 0, y = 0;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) y += 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) y -= 1;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) x += 1;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    this.move.x = Math.max(-1, Math.min(1, x + this._joy.x));
    this.move.y = Math.max(-1, Math.min(1, y + this._joy.y));

    // keyboard flight modifiers
    if (this._keys['Space']) { this.jumpHeld = true; this.ascend = true; }
    else if (this.ascend && this.ui && this.ui.btnAscend && this.ui.btnAscend.dataset.held !== '1') { this.ascend = false; this.jumpHeld = false; }
    if (this._keys['KeyC'] || this._keys['ControlLeft']) this.descend = true;
    else if (this.descend && this.ui && this.ui.btnDescend && this.ui.btnDescend.dataset.held !== '1') this.descend = false;

    // charge accumulation for primary
    if (this.shootHeld) {
      this.charge += dt;
      if (this.charge >= Config.chargeTime) { this.chargeReady = true; this.charge = Config.chargeTime; }
    } else {
      this.charge = 0; this.chargeReady = false;
    }
  }

  consumeLook() { const d = { dx: this.look.dx, dy: this.look.dy }; this.look.dx = this.look.dy = 0; return d; }
  consumeShot() { const s = this.shotRequest; this.shotRequest = 0; return s; }
  endFrame() { this.jumpPressed = false; this.dashPressed = false; this.qPressed = false; this.ultPressed = false; }
}

function audioUnlock() { window.dispatchEvent(new Event('nova-audio')); }
