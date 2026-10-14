import * as THREE from 'three';

const pylons = [];

export function buildArena(scene) {
  // Lights
  scene.fog = new THREE.Fog(0x07080f, 30, 90);
  const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x1a0f2e, 0.75);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(8, 16, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left=-16; key.shadow.camera.right=16; key.shadow.camera.top=16; key.shadow.camera.bottom=-16;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c5cff, 0.8); rim.position.set(-10, 8, -10); scene.add(rim);
  const under = new THREE.PointLight(0x27e0ff, 20, 30, 1.8); under.position.set(0, 1, 0); scene.add(under);

  // Ground disc — modern training platform
  const platMat = new THREE.MeshStandardMaterial({ color: 0x141826, roughness: 0.35, metalness: 0.7 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(13, 14.2, 1.2, 48), platMat);
  plat.position.y = -0.6; plat.receiveShadow = true; scene.add(plat);
  const topMat = new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.5, metalness: 0.4 });
  const top = new THREE.Mesh(new THREE.CircleGeometry(13, 48), topMat);
  top.rotation.x = -Math.PI/2; top.position.y = 0.005; top.receiveShadow = true; scene.add(top);

  // Glowing concentric rings
  const ringCols = [0x7c5cff, 0x27e0ff, 0x2a3358];
  [11.5, 8, 4.5].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r-0.09, r+0.09, 72),
      new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: i===2?0.85:0.5, blending: THREE.AdditiveBlending, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.02; scene.add(ring);
  });
  // Radial seams
  for (let i=0;i<12;i++){
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(12.6,0.06),
      new THREE.MeshBasicMaterial({ color:0x2a3358, transparent:true, opacity:0.6 }));
    seam.rotation.x=-Math.PI/2; seam.rotation.z=i/12*Math.PI*2;
    seam.position.y=0.015; scene.add(seam);
  }
  // Center emblem
  const emblem = new THREE.Mesh(new THREE.RingGeometry(1.1,1.35,48),
    new THREE.MeshBasicMaterial({ color:0x27e0ff, transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }));
  emblem.rotation.x=-Math.PI/2; emblem.position.y=0.02; scene.add(emblem);

  // Surrounding modern pylons (no medieval!)
  const pylonGeo = new THREE.BoxGeometry(1.1, 9, 1.1);
  const stripGeo = new THREE.BoxGeometry(0.16, 8.2, 0.16);
  for (let i=0;i<8;i++){
    const a = i/8*Math.PI*2 + 0.2;
    const x = Math.cos(a)*18, z = Math.sin(a)*18;
    const dark = new THREE.MeshStandardMaterial({ color:0x10142a, roughness:0.4, metalness:0.8 });
    const p = new THREE.Mesh(pylonGeo, dark); p.position.set(x,4.5,z); p.lookAt(0,4.5,0); scene.add(p);
    const strip = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: i%2?0x27e0ff:0x7c5cff }));
    strip.position.set(x*0.94,4.4,z*0.94); scene.add(strip);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({ color:0x0d1020, emissive:i%2?0x27e0ff:0x7c5cff, emissiveIntensity:2 }));
    tip.position.set(x,9.6,z); tip.userData.spin=true; scene.add(tip); pylons.push(tip);
  }
  // Hologram billboards
  for (let i=0;i<4;i++){
    const a=i/4*Math.PI*2+0.78;
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(6,3),
      new THREE.MeshBasicMaterial({ color:0x27e0ff, transparent:true, opacity:0.1, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false }));
    holo.position.set(Math.cos(a)*24,7,Math.sin(a)*24); holo.lookAt(0,7,0); scene.add(holo);
  }
  // Sky: big gradient dome + stars
  const skyGeo = new THREE.SphereGeometry(120, 24, 16);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite:false,
    uniforms: { top:{value:new THREE.Color(0x0b1030)}, mid:{value:new THREE.Color(0x1c1445)}, bot:{value:new THREE.Color(0x07080f)} },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot; void main(){ float h=normalize(vP).y*0.5+0.5; vec3 c=mix(bot,mid,smoothstep(0.35,0.62,h)); c=mix(c,top,smoothstep(0.62,0.95,h)); gl_FragColor=vec4(c,1.0); }' });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i=0;i<400;i++){ const a=Math.random()*Math.PI*2, e=Math.random()*Math.PI*0.45+0.08, r=110; sp.push(Math.cos(a)*Math.cos(e)*r, Math.sin(e)*r, Math.sin(a)*Math.cos(e)*r); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color:0xaaccff, size:0.5, transparent:true, opacity:0.8 })));
  // Pedestals for select screen
  const peds = [];
  [-4.2,0,4.2].forEach((x,i)=>{
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.35,0.5,24),
      new THREE.MeshStandardMaterial({ color:0x1a2040, roughness:0.4, metalness:0.7 }));
    ped.position.set(x,0.25,2.5); scene.add(ped);
    const glow = new THREE.Mesh(new THREE.RingGeometry(1.15,1.4,32),
      new THREE.MeshBasicMaterial({ color:[0xff6a1f,0x4fc3ff,0xff2b5e][i], transparent:true, opacity:0.8, blending:THREE.AdditiveBlending, depthWrite:false }));
    glow.rotation.x=-Math.PI/2; glow.position.set(x,0.51,2.5); scene.add(glow);
    peds.push(ped,glow);
  });
  return { peds, emblem, key };
}
export function animateArena(t) {
  for (const p of pylons){ p.rotation.y = t*0.8; p.position.y = 9.6+Math.sin(t*1.3+p.rotation.y)*0.25; }
}
