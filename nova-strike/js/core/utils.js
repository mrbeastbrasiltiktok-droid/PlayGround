// Small math / asset helpers shared across modules.
import * as THREE from 'three';

export function radialTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(0.35, mid); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#141824'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,180,255,0.16)'; g.lineWidth = 2;
  g.strokeRect(4, 4, 248, 248);
  g.strokeStyle = 'rgba(120,180,255,0.07)'; g.lineWidth = 1;
  for (let i = 32; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dampAngle(cur, target, lambda, dt) {
  let d = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return cur + d * (1 - Math.exp(-lambda * dt));
}

// Object pool for transient meshes/sprites.
export class Pool {
  constructor(factory, size = 32) {
    this.factory = factory; this.items = [];
    for (let i = 0; i < size; i++) { const o = factory(); o.visible = false; this.items.push(o); }
    this.idx = 0;
  }
  addTo(scene) { this.items.forEach(o => scene.add(o)); }
  next() { const o = this.items[this.idx]; this.idx = (this.idx + 1) % this.items.length; return o; }
}
