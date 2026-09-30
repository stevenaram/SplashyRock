import * as T from 'three';
import { gridWorld } from './map';
import type { Tile } from './game';

type Particle={mesh:T.Mesh;vx:number;vy:number;vz:number;age:number;life:number;steam:boolean;size:number;leaf?:boolean};
export class Effects {
  readonly group=new T.Group();
  private particles:Particle[]=[];
  private readonly vaporGeometry=new T.IcosahedronGeometry(1,0);
  private readonly vaporMaterial=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.62,depthWrite:false});
  private readonly vapor=new T.InstancedMesh(this.vaporGeometry,this.vaporMaterial,96);
  private readonly vaporSlots=Array.from({length:96},()=>({age:2,life:0,x:0,z:0,size:0,phase:0}));
  private readonly transform=new T.Object3D();
  private readonly vaporColor=new T.Color();
  private evaporations:{mesh:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>;age:number;cell:number}[]=[];
  constructor(){this.transform.scale.setScalar(0);this.transform.updateMatrix();for(let i=0;i<96;i++)this.vapor.setMatrixAt(i,this.transform.matrix);this.vapor.frustumCulled=false;this.vapor.instanceMatrix.setUsage(T.DynamicDrawUsage);}
  evaporate(cell:number,tile:'water'|'lava'){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    // One shared instanced draw for all plumes, with a hard 96-puff ceiling.
    for(let i=0;i<5;i++){
      const slot=this.vaporSlots.find(s=>s.age>=s.life);if(!slot)break;
      const angle=i*2.399+cell;
      Object.assign(slot,{age:.018-i*.012,life:.38+(i%3)*.035,x:x+Math.cos(angle)*.48,z:z+Math.sin(angle)*.48,size:.18+(i%3)*.045,phase:angle});
    }
    if(!this.vapor.parent)this.group.add(this.vapor);
    // The last skin of liquid breaks into pixel-sized holes as steam rises.
    // Bound ground overlays too, even for unusually large cascade fixtures.
    if(this.evaporations.length>=16)return;
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{progress:{value:0},tint:{value:new T.Color(tile==='water'?'#4aaec8':'#e5632c')}},
      vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 v;uniform float progress;uniform vec3 tint;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 p=floor(v*64.);float edge=min(min(v.x,v.y),min(1.-v.x,1.-v.y));float dissolve=hash(floor(p/3.))*.55+edge*.9;if(dissolve<progress)discard;vec3 c=mix(tint,vec3(.75,.78,.64),progress*.65);gl_FragColor=vec4(c,(1.-progress)*.85);\n#include <colorspace_fragment>\n}'});
    const mesh=new T.Mesh(this.tileGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.11,z);this.group.add(mesh);this.evaporations.push({mesh,age:0,cell});
  }
  private fades:{mesh:T.Mesh;age:number;stone:boolean}[]=[];
  private sands:{mesh:T.Mesh;age:number}[]=[];
  private waves:{meshes:T.Mesh[];age:number}[]=[];
  private readonly sandMaterial=new T.MeshBasicMaterial({color:'#e4cc98',transparent:true,opacity:.95,depthWrite:false});
  private readonly tileGeometry=new T.PlaneGeometry(1.96,1.96);
  private ripples:{mesh:T.Mesh;age:number}[]=[];
  private readonly ring=new T.RingGeometry(.36,.39,24);
  private readonly geometry=new T.BoxGeometry(1,1,1);
  private readonly materials={
    obsidian:new T.MeshBasicMaterial({color:'#9c83bb'}),
    ash:new T.MeshBasicMaterial({color:'#555c60'}),
    bush:new T.MeshBasicMaterial({color:'#8ac478'}),
    water:new T.MeshBasicMaterial({color:'#b1efed'}),
    lava:new T.MeshBasicMaterial({color:'#ffbd5b'}),
    stone:new T.MeshBasicMaterial({color:'#e3e4c9'}),
  };
  cancelEvaporation(cell:number){
    this.evaporations=this.evaporations.filter(e=>{if(e.cell!==cell)return true;e.mesh.removeFromParent();e.mesh.material.dispose();return false;});
  }
  sand(cell:number){
    const mesh=new T.Mesh(this.tileGeometry,this.sandMaterial.clone());mesh.rotation.x=-Math.PI/2;mesh.position.set(gridWorld(cell%8),.105,gridWorld(Math.floor(cell/8)));this.group.add(mesh);this.sands.push({mesh,age:0});
    for(let i=0;i<6;i++){
      const angle=i*2.399+cell,m=new T.Mesh(this.geometry,this.sandMaterial);m.scale.setScalar(.0625+(i%2)*.03125);m.position.copy(mesh.position);this.group.add(m);
      this.particles.push({mesh:m,vx:Math.cos(angle)*.65,vy:.6+i*.08,vz:Math.sin(angle)*.65,age:0,life:.4,steam:false,size:m.scale.x});
    }
  }
  sandWave(cell:number){
    const meshes:T.Mesh[]=[];
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const col=cell%8+dx,row=Math.floor(cell/8)+dz;if(col<0||col>7||row<0||row>7)continue;
      const m=new T.Mesh(this.tileGeometry,this.sandMaterial.clone());m.rotation.x=-Math.PI/2;m.userData={dx,dz,x:gridWorld(cell%8),z:gridWorld(Math.floor(cell/8))};m.scale.set(dx===0?.85:.06,dx===0?.06:.85,1);this.group.add(m);meshes.push(m);
    }
    this.waves.push({meshes,age:0});
  }
  ashPuff(cell:number){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    for(let i=0;i<16;i++){const a=i*2.399,m=new T.Mesh(this.geometry,this.materials.ash);m.position.set(x+Math.cos(a)*.35,.35+(i%3)*.1,z+Math.sin(a)*.35);this.group.add(m);this.particles.push({mesh:m,vx:Math.cos(a)*3,vy:.7+i%4*.2,vz:Math.sin(a)*3,age:0,life:.5+i%3*.06,steam:true,size:.16+i%3*.035});}
  }
  fireCross(cell:number){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    for(let i=0;i<20;i++){const a=(i%4)*Math.PI/2,m=new T.Mesh(this.geometry,this.materials.lava);m.position.set(x,.25,z);this.group.add(m);this.particles.push({mesh:m,vx:Math.cos(a)*(3+i%3*.4),vy:.6+i%3*.2,vz:Math.sin(a)*(3+i%3*.4),age:0,life:.45,steam:false,size:.12});}
  }
  leaves(cell:number,cross=false){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    for(let i=0;i<12;i++){const a=i*2.399,mesh=new T.Mesh(this.geometry,this.materials.bush);mesh.position.set(x,.45,z);mesh.rotation.set(a,a*.7,.4);this.group.add(mesh);this.particles.push({mesh,vx:Math.cos(cross?(i%4)*Math.PI/2:a)*(cross?3:1+i%3*.3),vy:1.4+i%3*.25,vz:Math.sin(cross?(i%4)*Math.PI/2:a)*(cross?3:1+i%3*.3),age:0,life:.8,steam:false,size:.18,leaf:true});}
  }
  dissolve(cell:number,tile:Tile) {
    const material=new T.MeshBasicMaterial({color:tile==='water'?'#72c9cf':tile==='lava'?'#ffb957':'#d4d1b6',transparent:true,opacity:.6,depthWrite:false});
    const mesh=new T.Mesh(this.tileGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(gridWorld(cell%8),.10,gridWorld(Math.floor(cell/8)));this.group.add(mesh);this.fades.push({mesh,age:0,stone:tile==='stone'});
    if(tile==='stone')this.burst(cell,'stone');
  }
  burst(cell:number,tile:Tile,petImpact=false){
    if(petImpact){
      const material=new T.MeshBasicMaterial({color:tile==='water'?'#b1efed':'#ffcf75',transparent:true,opacity:.6,depthWrite:false});
      const mesh=new T.Mesh(this.tileGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(gridWorld(cell%8),.115,gridWorld(Math.floor(cell/8)));this.group.add(mesh);this.fades.push({mesh,age:0,stone:false});
    }
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    if(tile!=='stone'){
      const ring=new T.Mesh(this.ring,new T.MeshBasicMaterial({color:tile==='water'?'#a3ded7':tile==='bush'?'#b8d998':'#ffb957',transparent:true,opacity:.65,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.09,z);this.group.add(ring);this.ripples.push({mesh:ring,age:0});
    }
    for(let i=0;i<(tile==='stone'?6:petImpact?9:5);i++){
      const angle=i*2.399+cell, speed=(.7+(i%3)*.35)*(petImpact?1.3:1);
      const mesh=new T.Mesh(this.geometry,this.materials[tile]);
      mesh.scale.setScalar(tile==='stone'?.14:(.0625+(i%2)*.03125)*(petImpact?1.4:1));mesh.position.set(x+Math.cos(angle)*.25,.15,z+Math.sin(angle)*.25);this.group.add(mesh);
      this.particles.push({mesh,vx:Math.cos(angle)*speed,vy:tile==='stone'?.8+(i%3)*.2:1.4+(i%4)*.3,vz:Math.sin(angle)*speed,age:0,life:tile==='stone'?.55:.48,steam:tile==='stone',size:mesh.scale.x});
    }
  }
  update(dt:number){
    let active=0;
    if(this.vapor.parent)this.vaporSlots.forEach((s,i)=>{
      s.age+=dt;
      if(s.age>=0&&s.age<s.life){
        active++;const t=s.age/s.life,fade=Math.min(1,t*16)*Math.min(1,(1-t)*2.4);
        const rise=1-Math.pow(1-t,2);
        const size=s.size*(.9+rise)*fade;
        this.transform.position.set(s.x+Math.sin(t*3+s.phase)*t*.14,.14+rise*.95,s.z+Math.cos(t*2+s.phase)*t*.12);
        this.transform.scale.set(size,size*(1.1+t*.4),size);this.transform.rotation.set(t*.3,s.phase,0);
        this.vaporColor.set(i%3===0?'#d4eee0':i%3===1?'#d4d1b6':'#f0dfb1');this.vapor.setColorAt(i,this.vaporColor);
      }else{if(s.age<0)active++;this.transform.scale.setScalar(0);}
      this.transform.updateMatrix();this.vapor.setMatrixAt(i,this.transform.matrix);
    });
    if(this.vapor.parent){this.vapor.instanceMatrix.needsUpdate=true;if(this.vapor.instanceColor)this.vapor.instanceColor.needsUpdate=true;if(!active)this.vapor.removeFromParent();}
    this.evaporations=this.evaporations.filter(e=>{e.age+=dt;const t=Math.min(1,e.age/.22);e.mesh.material.uniforms.progress.value=1-(1-t)*(1-t);if(t===1){e.mesh.removeFromParent();e.mesh.material.dispose();return false;}return true;});
    this.sands=this.sands.filter(s=>{s.age+=dt;const t=Math.min(1,s.age/.38);if(t===1){s.mesh.removeFromParent();(s.mesh.material as T.Material).dispose();return false;}const ease=1-Math.pow(1-t,3);s.mesh.scale.setScalar(.65+.35*ease);(s.mesh.material as T.MeshBasicMaterial).opacity=.7*Math.sin(Math.PI*t);return true;});
    this.waves=this.waves.filter(w=>{w.age+=dt;const t=Math.min(1,w.age/.28);if(t===1){w.meshes.forEach(m=>{m.removeFromParent();(m.material as T.Material).dispose();});return false;}for(const m of w.meshes){const {dx,dz,x,z}=m.userData;const distance=.3+Math.sin(t*Math.PI/2)*1.7;m.position.set(x+dx*distance,.12,z+dz*distance);(m.material as T.MeshBasicMaterial).opacity=.55*Math.sin(Math.PI*t);}return true;});
    this.fades=this.fades.filter(f=>{f.age+=dt;const t=Math.min(1,f.age/.32);if(t===1){f.mesh.removeFromParent();(f.mesh.material as T.Material).dispose();return false;}f.mesh.scale.setScalar(1-.12*t);(f.mesh.material as T.MeshBasicMaterial).opacity=.6*(1-t)*(1-t);return true;});
    this.ripples=this.ripples.filter(r=>{r.age+=dt;const t=Math.min(1,r.age/.48);if(t===1){r.mesh.removeFromParent();(r.mesh.material as T.Material).dispose();return false;}r.mesh.scale.setScalar(.45+1.8*(1-Math.pow(1-t,3)));(r.mesh.material as T.MeshBasicMaterial).opacity=.65*(1-t)*(1-t);return true;});
    this.particles=this.particles.filter(p=>{
      p.age+=dt;if(p.age>=p.life){p.mesh.removeFromParent();return false;}
      p.mesh.position.x+=p.vx*dt*(p.steam?.15:1);p.mesh.position.z+=p.vz*dt*(p.steam?.15:1);p.mesh.position.y+=p.vy*dt;
      if(!p.steam)p.vy-=5*dt;
      p.mesh.visible=p.mesh.position.y>.08;
      const t=p.age/p.life;p.mesh.scale.setScalar(p.size*(p.steam?1+t*.6:1)*Math.min(1,(1-t)*3));
      if(p.leaf){p.mesh.scale.y*=.15;p.mesh.scale.z*=.55;p.mesh.rotation.x+=dt*5;p.mesh.rotation.z+=dt*3;p.vy+=dt*2;}
      return true;
    });
  }
  clear(){this.transform.scale.setScalar(0);this.transform.updateMatrix();for(let i=0;i<96;i++)this.vapor.setMatrixAt(i,this.transform.matrix);this.vapor.instanceMatrix.needsUpdate=true;this.vaporSlots.forEach(s=>{s.age=2;s.life=0;});this.evaporations.forEach(e=>e.mesh.material.dispose());this.evaporations=[];this.sands.forEach(s=>(s.mesh.material as T.Material).dispose());this.waves.forEach(w=>w.meshes.forEach(m=>(m.material as T.Material).dispose()));this.ripples.forEach(r=>(r.mesh.material as T.Material).dispose());this.sands=[];this.waves=[];this.fades.forEach(f=>(f.mesh.material as T.Material).dispose());this.fades=[];this.particles=[];this.ripples=[];this.group.clear();}
  dispose(){this.clear();this.vapor.dispose();this.vaporGeometry.dispose();this.vaporMaterial.dispose();this.sandMaterial.dispose();this.tileGeometry.dispose();this.ring.dispose();this.ripples=[];this.geometry.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.particles=[];this.group.clear();}
}
