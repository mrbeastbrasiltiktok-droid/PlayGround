// Detailed combat arena: verticality, cover, 3 routes, neon trim, skyline.
import * as THREE from 'three';
import { gridTexture } from '../core/utils.js';
import { Config } from '../core/config.js';

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {min,max} AABBs for walls/pillars
    this.platforms = []; // {x,z,r,y} discs you can stand on
    this.groundY = 0;
  }

  build() {
    const S = this.scene;
    // Lighting rig: hemi + key dir w/ shadows + rim + point accents
    S.fog = new THREE.Fog(0x0b1020, 60, 190);
    S.background = new THREE.Color(0x0b1020);
    const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x3a2a55, 1.25); S.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    sun.position.set(28, 46, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    sun.shadow.camera.far = 140; sun.shadow.bias = -0.0004;
    S.add(sun); this.sun = sun;
    const rim = new THREE.DirectionalLight(0x5fd4ff, 0.9); rim.position.set(-30, 20, -30); S.add(rim);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.55); fill.position.set(-20, 12, 30); S.add(fill);
    const warm = new THREE.PointLight(0xff9a4c, 60, 70, 1.8); warm.position.set(0, 9, 0); S.add(warm);

    // Sky dome gradient + skyline silhouette + stars
    this.buildSky(S);

    // Ground
    const gTex = gridTexture();
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(Config.arenaRadius + 14, 48),
      new THREE.MeshStandardMaterial({ map: gTex, color: 0x9fb4dd, roughness: 0.55, metalness: 0.35 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);

    // Glowing center ring + edge wall
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x39d5ff });
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.4, 7.0, 64), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; S.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(Config.arenaRadius - 0.6, Config.arenaRadius, 72),
      new THREE.MeshBasicMaterial({ color: 0xff5f3c, transparent: true, opacity: 0.85 }));
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.03; S.add(ring2);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c2440, roughness: 0.4, metalness: 0.7, emissive: 0x0a1a33, emissiveIntensity: 0.5 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(Config.arenaRadius + 2, Config.arenaRadius + 2, 6, 48, 1, true), wallMat);
    wall.position.y = 3; wall.material.side = THREE.DoubleSide; S.add(wall);

    // Materials
    this.matDeck = new THREE.MeshStandardMaterial({ color: 0x2a3352, roughness: 0.5, metalness: 0.6 });
    this.matTrim = new THREE.MeshBasicMaterial({ color: 0x1e9ecf });
    this.matTrimWarm = new THREE.MeshBasicMaterial({ color: 0xd86a28 });
    this.matCover = new THREE.MeshStandardMaterial({ color: 0x39415e, roughness: 0.45, metalness: 0.55 });
    this.matDark = new THREE.MeshStandardMaterial({ color: 0x161c33, roughness: 0.6, metalness: 0.4 });

    // Central tower platform (verticality) + bridges (3 routes)
    this.addPlatform(0, 0, 9, 3.2);            // mid disc
    this.addPillar(0, 0, 2.2, 7.5);            // center pillar w/ beacon
    this.addBeacon(0, 8.4, 0);

    this.addPlatform(-20, 0, 7, 2.0);
    this.addPlatform(20, 0, 7, 2.0);
    this.addPlatform(0, -20, 7, 2.0);
    this.addPlatform(0, 20, 7, 2.0);
    // corner high pads
    this.addPlatform(-14, -14, 5, 4.2);
    this.addPlatform(14, -14, 5, 4.2);
    this.addPlatform(-14, 14, 5, 4.2);
    this.addPlatform(14, 14, 5, 4.2);

    // Cover blocks scattered (also colliders)
    const covers = [
      [-8, -6, 0.4], [8, 6, -0.3], [-8, 6, -0.4], [8, -6, 0.3],
      [0, -12, 0], [0, 12, 0], [-12, 0, Math.PI / 2], [12, 0, Math.PI / 2],
      [-24, -10, 0.2], [24, 10, -0.2], [-24, 10, -0.2], [24, -10, 0.2],
    ];
    covers.forEach(([x, z, r]) => this.addCover(x, z, r));

    // Pillars with neon bands
    [[-28, -28], [28, -28], [-28, 28], [28, 28], [-32, 0], [32, 0], [0, -32], [0, 32]].forEach(([x, z]) => this.addPylon(x, z));

    // Floating shards (animated)
    this.shards = [];
    const shardMat = new THREE.MeshStandardMaterial({ color: 0x27304f, roughness: 0.3, metalness: 0.8, emissive: 0x1a5f8a, emissiveIntensity: 0.7 });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + Math.random() * 0.7), shardMat);
      const a = (i / 10) * Math.PI * 2;
      m.position.set(Math.cos(a) * 26, 8 + Math.random() * 6, Math.sin(a) * 26);
      m.userData = { a, sp: 0.3 + Math.random() * 0.5, y: m.position.y };
      S.add(m); this.shards.push(m);
    }
  }

  buildSky(scene) {
    // gradient dome
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#04060f'); gr.addColorStop(0.55, '#101a3a'); gr.addColorStop(0.78, '#3a1c4d'); gr.addColorStop(0.9, '#a13c2e'); gr.addColorStop(1, '#0b1020');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
    scene.add(dome);
    // skyline silhouette ring
    const cityMat = new THREE.MeshBasicMaterial({ color: 0x0a0f24 });
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + (Math.random() * 0.1);
      const w = 6 + Math.random() * 10, h = 14 + Math.random() * 30;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), cityMat);
      b.position.set(Math.cos(a) * 150, h / 2 - 4, Math.sin(a) * 150);
      scene.add(b);
      // lit windows strip
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, h * 0.7, w * 0.9),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.55 + Math.random() * 0.12, 0.8, 0.25) }));
      win.position.copy(b.position); scene.add(win);
    }
    // stars
    const n = 400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.08, r = 200;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 1.4, sizeAttenuation: false, fog: false })));
    // moon
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }));
    moon.position.set(-90, 95, -150); moon.lookAt(0, 10, 0); scene.add(moon);
  }

  addCollider(x, z, hx, hz, h) {
    this.colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, h });
  }

  addPlatform(x, z, r, y) {
    const S = this.scene;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 0.7, 24), this.matDeck);
    deck.position.set(x, y - 0.35, z); deck.castShadow = deck.receiveShadow = true; S.add(deck);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.15, 0.09, 8, 40),
      (x + z) % 2 === 0 ? this.matTrim : this.matTrimWarm);
    trim.rotation.x = Math.PI / 2; trim.position.set(x, y + 0.02, z); S.add(trim);
    // support column
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.42, y, 12), this.matDark);
    col.position.set(x, y / 2 - 0.3, z); col.castShadow = true; S.add(col);
    this.platforms.push({ x, z, r: r + 0.3, y });
  }

  addCover(x, z, rot) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 1.1), this.matCover);
    m.position.set(x, 0.95, z); m.rotation.y = rot; m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.12, 1.15), this.matTrim);
    strip.position.set(x, 1.75, z); strip.rotation.y = rot; this.scene.add(strip);
    const hx = Math.abs(Math.cos(rot)) * 2.1 + Math.abs(Math.sin(rot)) * 0.55;
    const hz = Math.abs(Math.sin(rot)) * 2.1 + Math.abs(Math.cos(rot)) * 0.55;
    this.addCollider(x, z, hx, hz, 1.9);
  }

  addPillar(x, z, r, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h, 10), this.matDark);
    m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; this.scene.add(m);
    this.addCollider(x, z, r, r, h);
  }

  addPylon(x, z) {
    const h = 11;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), this.matCover);
    m.position.set(x, h / 2, z); m.castShadow = true; this.scene.add(m);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 1.7), this.matTrimWarm);
    band.position.set(x, h * 0.7, z); this.scene.add(band);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.8),
      new THREE.MeshStandardMaterial({ color: 0x39d5ff, emissive: 0x39d5ff, emissiveIntensity: 2 }));
    tip.position.set(x, h + 0.9, z); this.scene.add(tip);
    this.addCollider(x, z, 0.9, 0.9, h);
  }

  addBeacon(x, y, z) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(x, y + 5, z); this.scene.add(beam); this.beacon = beam;
  }

  groundHeight(x, z) {
    let y = 0;
    for (const p of this.platforms) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r && p.y > y) y = p.y;
    }
    return y;
  }

  collide(pos, radius = 0.6) {
    // push out of AABB colliders; clamp to arena
    for (const c of this.colliders) {
      if (pos.y > c.h) continue;
      const cx = Math.max(c.minX, Math.min(c.maxX, pos.x));
      const cz = Math.max(c.minZ, Math.min(c.maxZ, pos.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d < 1e-4) { pos.x = c.maxX + radius; continue; }
        pos.x = cx + (dx / d) * radius; pos.z = cz + (dz / d) * radius;
      }
    }
    const d = Math.hypot(pos.x, pos.z);
    const max = Config.arenaRadius + 1;
    if (d > max) { pos.x *= max / d; pos.z *= max / d; }
  }

  update(t) {
    for (const s of this.shards) {
      s.rotation.y += 0.01; s.rotation.x += 0.004;
      s.position.y = s.userData.y + Math.sin(t * s.userData.sp + s.userData.a) * 1.2;
    }
    if (this.beacon) this.beacon.rotation.y = t * 0.6;
  }

  setShadows(on) { if (this.sun) this.sun.castShadow = on; }
}
