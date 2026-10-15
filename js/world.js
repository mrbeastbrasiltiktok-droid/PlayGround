// Arena: SKYFALL PLAZA — routes, platforms, cover, spawns, capture point, collision.
import * as THREE from 'three';
export class World {
  constructor(scene, quality='med'){
    this.scene=scene; this.colliders=[]; // {min:Vector3,max:Vector3}
    this.spawnsA=[]; this.spawnsB=[]; this.point=new THREE.Vector3(0,0,0); this.pointR=5.2;
    this.flags=[]; this.quality=quality;
    this.build();
  }
  addBox(x,y,z,w,h,d,color,opts={}){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshStandardMaterial({color,roughness:opts.rough??0.8,metalness:opts.metal??0.15,emissive:opts.emissive||0x000000,emissiveIntensity:opts.ei||0}));
    m.position.set(x,y,z); m.receiveShadow=true; m.castShadow=!opts.noShadow; this.scene.add(m);
    if(!opts.noCollide) this.colliders.push({min:new THREE.Vector3(x-w/2,y-h/2,z-d/2),max:new THREE.Vector3(x+w/2,y+h/2,z+d/2)});
    return m;
  }
  build(){
    const S=this.scene;
    S.fog=new THREE.Fog(0x0a0f22,55,140);
    S.background=new THREE.Color(0x070b18);
    // lights
    this.hemi=new THREE.HemisphereLight(0x9fc0ff,0x2a2040,1.35); S.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffe0b3,2.3); this.sun.position.set(24,38,14);
    this.sun.castShadow=this.quality!=='low';
    this.sun.shadow.mapSize.set(1024,1024);
    this.sun.shadow.camera.left=-40;this.sun.shadow.camera.right=40;this.sun.shadow.camera.top=40;this.sun.shadow.camera.bottom=-40;
    S.add(this.sun);
    const rim=new THREE.DirectionalLight(0x27e0ff,0.5); rim.position.set(-20,12,-24); S.add(rim);
    // ground
    const gnd=new THREE.Mesh(new THREE.PlaneGeometry(120,120),
      new THREE.MeshStandardMaterial({color:0x2a3a5e,roughness:0.85,metalness:0.1}));
    gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; S.add(gnd);
    // glowing grid streets
    const grid=new THREE.GridHelper(110,44,0x27e0ff,0x22315e); grid.position.y=0.02; grid.material.transparent=true; grid.material.opacity=0.28; S.add(grid);
    // central platform + point ring
    this.addBox(0,-0.5,0,22,1,22,0x232f52);
    const ringMat=new THREE.MeshBasicMaterial({color:0x27e0ff,transparent:true,opacity:0.75,side:THREE.DoubleSide,depthWrite:false});
    this.capRing=new THREE.Mesh(new THREE.RingGeometry(this.pointR-0.5,this.pointR,48),ringMat);
    this.capRing.rotation.x=-Math.PI/2; this.capRing.position.y=0.06; S.add(this.capRing);
    this.capFill=new THREE.Mesh(new THREE.CircleGeometry(this.pointR-0.5,48),
      new THREE.MeshBasicMaterial({color:0x27e0ff,transparent:true,opacity:0.12,depthWrite:false}));
    this.capFill.rotation.x=-Math.PI/2; this.capFill.position.y=0.05; S.add(this.capFill);
    // obelisk center (cover, blocks sight partially)
    this.addBox(0,1.5,0,2.2,3,2.2,0x2c3a68,{emissive:0x27e0ff,ei:0.25});
    const tip=new THREE.Mesh(new THREE.OctahedronGeometry(0.9),new THREE.MeshStandardMaterial({color:0x111111,emissive:0xffb300,emissiveIntensity:1.4}));
    tip.position.set(0,4.2,0); S.add(tip); this.beacon=tip;
    // four mid covers
    for(const [x,z] of [[-9,-6],[9,-6],[-9,6],[9,6]]) this.addBox(x,0.75,z,2.4,1.5,2.4,0x2a3a66);
    // side lanes: elevated walkways with ramps
    for(const s of [-1,1]){
      this.addBox(s*16,1.5,0,6,0.6,24,0x243154); // platform
      // ramp up (visual stairs)
      for(let i=0;i<5;i++) this.addBox(s*16,0.15+i*0.28,13.5-i*1.1,6,0.3,1.2,0x2c3a68,{noCollide:i>0});
      // rail pillars
      for(let z=-10;z<=10;z+=5) this.addBox(s*13.4,2.6,z,0.3,2.2,0.3,0x27e0ff,{emissive:0x27e0ff,ei:0.8,noCollide:true,noShadow:true});
      // crates on platform
      this.addBox(s*16,2.1,-6,1.8,1.2,1.8,0x3a2c5e);
    }
    // back walls / boundaries (invisible + visual)
    for(const [x,z,w,d] of [[0,-26,60,2],[0,26,60,2],[-30,0,2,54],[30,0,2,54]])
      this.addBox(x,3,z,w,6,d,0x101730,{rough:0.6});
    // neon signs / towers (visual only)
    for(let i=0;i<10;i++){ const a=i/10*Math.PI*2; const x=Math.cos(a)*44,z=Math.sin(a)*44;
      const h=14+Math.random()*16;
      const t=new THREE.Mesh(new THREE.BoxGeometry(4,h,4),new THREE.MeshStandardMaterial({color:0x0d1428,roughness:0.7,emissive:i%2?0xff4d6d:0x27e0ff,emissiveIntensity:0.35}));
      t.position.set(x,h/2,z); S.add(t); }
    // spawn zones
    this.addBox(0,0.1,-22,10,0.2,4,0x1a4a8e,{emissive:0x27e0ff,ei:0.25,noCollide:true,noShadow:true});
    this.addBox(0,0.1,22,10,0.2,4,0x8e1a3e,{emissive:0xff4d6d,ei:0.25,noCollide:true,noShadow:true});
    this.spawnsA=[new THREE.Vector3(-3,0,-21),new THREE.Vector3(0,0,-22),new THREE.Vector3(3,0,-21)];
    this.spawnsB=[new THREE.Vector3(-3,0,21),new THREE.Vector3(0,0,22),new THREE.Vector3(3,0,21)];
    // floating particles ambience
    const n=160, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){pos[i*3]=(Math.random()-0.5)*90;pos[i*3+1]=Math.random()*16;pos[i*3+2]=(Math.random()-0.5)*90;}
    const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    this.dust=new THREE.Points(pg,new THREE.PointsMaterial({color:0x27e0ff,size:0.18,transparent:true,opacity:0.6}));
    S.add(this.dust);
    // destructible barrels (gameplay objects)
    this.barrels=[];
    for(const [x,z] of [[-6,-12],[6,-12],[-6,12],[6,12],[-14,0],[14,0]]){
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.2,12),
        new THREE.MeshStandardMaterial({color:0xff6a00,roughness:0.6,emissive:0xff4400,emissiveIntensity:0.3}));
      b.position.set(x,0.6,z); b.castShadow=true; S.add(b);
      this.barrels.push({m:b,hp:60,pos:b.position.clone(),alive:true});
      this.colliders.push({min:new THREE.Vector3(x-0.55,0,z-0.55),max:new THREE.Vector3(x+0.55,1.2,z+0.55),barrel:this.barrels[this.barrels.length-1]});
    }
  }
  // circle-vs-AABB resolve on XZ + step-up; returns ground height
  collide(pos,radius,height=1.7){
    let ground=0;
    for(const c of this.colliders){
      if(c.barrel&&!c.barrel.alive) continue;
      // vertical overlap?
      if(pos.y> c.max.y-0.05 || pos.y+height < c.min.y) continue;
      const cx=Math.max(c.min.x,Math.min(pos.x,c.max.x));
      const cz=Math.max(c.min.z,Math.min(pos.z,c.max.z));
      const dx=pos.x-cx, dz=pos.z-cz; const d2=dx*dx+dz*dz;
      if(d2<radius*radius){
        const top=c.max.y;
        // step onto low platforms
        if(top-pos.y<=0.65&&top>ground){ ground=top; continue; }
        if(d2>1e-6){ const d=Math.sqrt(d2); const push=(radius-d)/d; pos.x+=dx*push; pos.z+=dz*push; }
        else { pos.x+=radius; }
      }
      // standing on top
      if(Math.abs(pos.y-top)<0.4&&pos.x>c.min.x-0.3&&pos.x<c.max.x+0.3&&pos.z>c.min.z-0.3&&pos.z<c.max.z+0.3){
        if(top>ground&&top-pos.y<1.2) ground=top; }
    }
    // world bounds
    pos.x=Math.max(-28,Math.min(28,pos.x)); pos.z=Math.max(-24,Math.min(24,pos.z));
    return ground;
  }
  groundAt(x,z){
    let g=0;
    for(const c of this.colliders){
      if(x>c.min.x&&x<c.max.x&&z>c.min.z&&z<c.max.z){ if(c.min.y<=1.2&&c.max.y>g&&c.max.y<=3.2) g=c.max.y; }
    }
    return g;
  }
  losBlocked(a,b){
    // sample segments against tall colliders
    for(const c of this.colliders){
      if(c.barrel&&!c.barrel.alive) continue;
      if(c.max.y<1.0) continue;
      // segment-AABB slab test (coarse, XZ + Y)
      const d=new THREE.Vector3().subVectors(b,a); const len=d.length(); d.normalize();
      for(let t=0;t<len;t+=0.7){
        const px=a.x+d.x*t, py=a.y+d.y*t, pz=a.z+d.z*t;
        if(px>c.min.x&&px<c.max.x&&py>c.min.y&&py<c.max.y&&pz>c.min.z&&pz<c.max.z) return true;
      }
    }
    return false;
  }
  update(dt,t){
    this.beacon.rotation.y+=dt*1.2; this.beacon.position.y=4.2+Math.sin(t*2)*0.2;
    const pulse=0.6+Math.sin(t*3)*0.25;
    this.capRing.material.opacity=pulse; this.dust.rotation.y+=dt*0.02;
  }
  setQuality(q){
    this.sun.castShadow=q!=='low';
    this.dust.visible=q!=='low';
  }
}
