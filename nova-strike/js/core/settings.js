// Persistent player settings (localStorage) + live binding to CSS variables.
import { DefaultSettings } from './config.js';

export class Settings {
  constructor() {
    this.data = { ...DefaultSettings };
    try {
      const raw = localStorage.getItem('nova-settings');
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
  }
  get(k) { return this.data[k]; }
  set(k, v) {
    this.data[k] = v;
    try { localStorage.setItem('nova-settings', JSON.stringify(this.data)); } catch (e) {}
    this.apply();
  }
  apply() {
    const r = document.documentElement.style;
    r.setProperty('--btn-scale', String(this.data.buttonScale));
    r.setProperty('--btn-opacity', String(this.data.opacity));
  }
}
