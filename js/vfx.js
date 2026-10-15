// Pooled GPU-friendly VFX: particles, tracers, beams, shockwaves, damage numbers, muzzle flash.
import * as THREE from 'three';
export class VFX {
  constructor(scene){
    this.scene=scene; this.pool=[]; this.active=[];
    this.beams=[]; this.rings=[]; this.flashes=[];
    this.maxP=900;
    const g=new THREE.BufferGeometry();
    this.pos=new Float32Array(this.maxP*3); this.col=new Float32Array(this.maxP*3);
    this.vel=new Float32Array(this.maxP*3); this.life=new Float32Array(this.maxP); this.maxLife=new Float32Array(this.maxP);
    this.size=new Float32Array(this.maxP); this.grav=new Float32Array(this.maxP);
    g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));
    g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
    this.mat=new THREE.PointsMaterial({size:0.35,vertexColors:true,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
    this.points=new THREE.Points(g,this.mat); this.points.frustumCulled=false; scene.add(this.points);
    this.cursor=0; this.count=0;
    this.tmpC=new THREE.Color();
    // damage number container (HTML)
    this.dmgLayer=document.createElement('div'); this.dmgLayer.className='dmg-layer';
    this.dmgLayer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:11';
    document.getElementById('app').appendChild(this.dmgLayer);
  }
  spawn(x,y,z,vx,vy,vz,life,color,size=1,grav=-6){
    const i=this.cursor; this.cursor=(this.cursor+1)%this.maxP;
    this.pos[i*3]=x;this.pos[i*3+1]=y;this.pos[i*3+2]=z;
    this.vel[i*3]=vx;this.vel[i*3+1]=vy;this.vel[i*3+2]=vz;
    this.life[i]=life;this.maxLife[i]=life;this.size[i]=size;this.grav[i]=grav;
    this.tmpC.set(color); this.col[i*3]=this.tmpC.r;this.col[i*3+1]=this.tmpC.g;this.col[i*3+2]=this.tmpC.b;
  }
  burst(p,n,color,speed=6,life=0.6,size=1,up=3){
    for(let k=0;k<n;k++){ const a=Math.random()*Math.PI*2, e=(Math.random()-0.3)*Math.PI;
      this.spawn(p.x,p.y,p.z,Math.cos(a)*speed*Math.random(),Math.sin(e)*speed+up,Math.sin(a)*speed*Math.random(),life*(0.5+Math.random()*0.7),color,size,false?0:-6); }
  }
  impact(p,color=0xffcc55,n=14){ this.burst(p,n,color,7,0.5,1,4); this.flash(p,0.5,color); }
  blood(p){ this.burst(p,10,0xff3344,5,0.4,1,2); }
  healFx(p){ for(let k=0;k<10;k++) this.spawn(p.x+(Math.random()-0.5)*1.2,p.y,p.z+(Math.random()-0.5)*1.2,(Math.random()-0.5),3+Math.random()*2,(Math.random()-0.5),0.8,0x37e08b,1,-1); }
  muzzle(p,dir,color=0xffe27a){ for(let k=0;k<5;k++) this.spawn(p.x,p.y,p.z,dir.x*12+(Math.random()-0.5)*3,dir.y*12+(Math.random()-0.5)*3,dir.z*12+(Math.random()-0.5)*3,0.12,color,1,0); this.flash(p,0.25,color); }
  trail(p,color=0x27e0ff){ this.spawn(p.x,p.y,p.z,(Math.random()-0.5)*0.6,(Math.random()-0.5)*0.6,(Math.random()-0.5)*0.6,0.4,color,1,0); }
  explosion(p,r=5,color1=0xff9d00,color2=0xff4400){
    this.flash(p,1.2,0xfff2cc,3.2); this.shockwave(p,r*1.4,0xffcc66);
    this.burst(p,40,color1,11,0.7,1.4,5); this.burst(p,26,color2,7,1.0,1.2,4);
    for(let k=0;k<12;k++) this.spawn(p.x,p.y+0.3,p.z,(Math.random()-0.5)*2,2+Math.random()*3,(Math.random()-0.5)*2,1.4,0x555566,1,-0.5);
  }
  flash(p,intensity=0.6,color=0xffffff,scale=1){
    const m=new THREE.Mesh(VFX._flashGeo||(VFX._flashGeo=new THREE.SphereGeometry(0.5,10,8)),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}));
    m.position.copy(p); m.scale.setScalar(scale); this.scene.add(m);
    this.flashes.push({m,t:0,dur:0.18+intensity*0.12});
  }
  shockwave(p,r=6,color=0xffffff){
    const m=new THREE.Mesh(VFX._ringGeo||(VFX._ringGeo=new THREE.RingGeometry(0.8,1,40)),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    m.position.copy(p); m.position.y+=0.15; m.rotation.x=-Math.PI/2; this.scene.add(m);
    this.rings.push({m,t:0,dur:0.5,r});
  }
  beam(a,b,color=0x27e0ff,thick=0.16,life=0.12){
    const len=a.distanceTo(b); if(len<0.01) return;
    const core=new THREE.Mesh(new THREE.CylinderGeometry(thick*0.45,thick*0.45,len,8,1,true),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}));
    const glow=new THREE.Mesh(new THREE.CylinderGeometry(thick,thick,len,8,1,true),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.45,depthWrite:false,blending:THREE.AdditiveBlending}));
    const grp=new THREE.Group(); grp.add(core); grp.add(glow);
    grp.position.copy(a).lerp(b,0.5);
    grp.lookAt(b); grp.rotateX(Math.PI/2);
    this.scene.add(grp); this.beams.push({m:grp,t:0,dur:life});
    // traveling energy pulses
    for(let k=0;k<3;k++){ const t=k/3; const px=a.x+(b.x-a.x)*t, py=a.y+(b.y-a.y)*t, pz=a.z+(b.z-a.z)*t;
      this.spawn(px,py,pz,0,0.5,0,0.25,color,1.2,0); }
  }
  wallFx(p,w,h,color){ this.flash(p,0.5,color,2); for(let k=0;k<20;k++) this.spawn(p.x+(Math.random()-0.5)*w,p.y+Math.random()*h,p.z+(Math.random()-0.5)*0.5,0,1.5,0,0.6,color,1,0); }
  damageNumber(worldPos,amount,camera,isHeal=false,isCrit=false){
    const v=worldPos.clone().project(camera); if(v.z>1) return;
    const el=document.createElement('div');
    el.textContent=(isHeal?'+':'')+Math.round(amount);
    el.style.cssText=`position:absolute;left:${(v.x*0.5+0.5)*100}%;top:${(-v.y*0.5+0.5)*100}%;transform:translate(-50%,-50%);font-weight:900;font-size:${isCrit?22:15}px;color:${isHeal?'#37e08b':isCrit?'#ffb300':'#fff'};text-shadow:0 2px 6px #000;transition:all .7s;`;
    this.dmgLayer.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform=`translate(-50%,-160%) scale(1.15)`; el.style.opacity='0'; });
    setTimeout(()=>el.remove(),720);
  }
  update(dt){
    for(let i=0;i<this.maxP;i++){ if(this.life[i]<=0) continue;
      this.life[i]-=dt;
      if(this.life[i]<=0){ this.pos[i*3+1]=-999; continue; }
      this.vel[i*3+1]+=this.grav[i]*dt;
      this.pos[i*3]+=this.vel[i*3]*dt; this.pos[i*3+1]+=this.vel[i*3+1]*dt; this.pos[i*3+2]+=this.vel[i*3+2]*dt;
      if(this.pos[i*3+1]<0.03&&this.vel[i*3+1]<0){this.vel[i*3+1]*=-0.4; this.pos[i*3+1]=0.03;}
    }
    this.points.geometry.attributes.position.needsUpdate=true;
    this.points.geometry.attributes.color.needsUpdate=true;
    for(let i=this.beams.length-1;i>=0;i--){ const b=this.beams[i]; b.t+=dt;
      b.m.children.forEach(c=>c.material.opacity*= (1-dt*8));
      if(b.t>=b.dur){ this.scene.remove(b.m); b.m.children.forEach(c=>{c.geometry.dispose();c.material.dispose();}); this.beams.splice(i,1);} }
    for(let i=this.rings.length-1;i>=0;i--){ const r=this.rings[i]; r.t+=dt; const k=r.t/r.dur;
      r.m.scale.setScalar(0.5+k*r.r); r.m.material.opacity=0.9*(1-k);
      if(k>=1){ this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i,1);} }
    for(let i=this.flashes.length-1;i>=0;i--){ const f=this.flashes[i]; f.t+=dt; const k=f.t/f.dur;
      f.m.scale.multiplyScalar(1+dt*6); f.m.material.opacity=0.9*(1-k);
      if(k>=1){ this.scene.remove(f.m); f.m.material.dispose(); this.flashes.splice(i,1);} }
  }
  clear(){ for(let i=0;i<this.maxP;i++){this.life[i]=0;this.pos[i*3+1]=-999;}
    this.beams.forEach(b=>this.scene.remove(b.m)); this.beams.length=0;
    this.rings.forEach(r=>this.scene.remove(r.m)); this.rings.length=0;
    this.flashes.forEach(f=>this.scene.remove(f.m)); this.flashes.length=0;
    this.dmgLayer.innerHTML=''; }
}
