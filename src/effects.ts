import * as T from 'three';
import { gridWorld } from './map';
import type { Tile } from './game';

type Particle={mesh:T.Mesh;vx:number;vy:number;vz:number;age:number;life:number;steam:boolean;size:number};
export class Effects {
  readonly group=new T.Group();
  private particles:Particle[]=[];
  private fades:{mesh:T.Mesh;age:number;stone:boolean}[]=[];
  private sands:{mesh:T.Mesh;age:number}[]=[];
  private waves:{meshes:T.Mesh[];age:number}[]=[];
  private readonly sandMaterial=new T.MeshBasicMaterial({color:'#e4cc98',transparent:true,opacity:.95,depthWrite:false});
  private readonly tileGeometry=new T.PlaneGeometry(1.96,1.96);
  private ripples:{mesh:T.Mesh;age:number}[]=[];
  private readonly ring=new T.RingGeometry(.36,.39,24);
  private readonly geometry=new T.BoxGeometry(1,1,1);
  private readonly materials={
    water:new T.MeshBasicMaterial({color:'#b1efed'}),
    lava:new T.MeshBasicMaterial({color:'#ffbd5b'}),
    stone:new T.MeshBasicMaterial({color:'#e3e4c9'}),
  };
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
  dissolve(cell:number,tile:Tile) {
    const material=new T.MeshBasicMaterial({color:tile==='water'?'#72c9cf':tile==='lava'?'#ffb957':'#d4d1b6',transparent:true,opacity:.6,depthWrite:false});
    const mesh=new T.Mesh(this.tileGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(gridWorld(cell%8),.10,gridWorld(Math.floor(cell/8)));this.group.add(mesh);this.fades.push({mesh,age:0,stone:tile==='stone'});
    if(tile==='stone')this.burst(cell,'stone');
  }
  burst(cell:number,tile:Tile){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    if(tile!=='stone'){
      const ring=new T.Mesh(this.ring,new T.MeshBasicMaterial({color:tile==='water'?'#a3ded7':'#ffb957',transparent:true,opacity:.65,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.09,z);this.group.add(ring);this.ripples.push({mesh:ring,age:0});
    }
    for(let i=0;i<(tile==='stone'?6:5);i++){
      const angle=i*2.399+cell, speed=.7+(i%3)*.35;
      const mesh=new T.Mesh(this.geometry,this.materials[tile]);
      mesh.scale.setScalar(tile==='stone'?.14:.0625+(i%2)*.03125);mesh.position.set(x+Math.cos(angle)*.25,.15,z+Math.sin(angle)*.25);this.group.add(mesh);
      this.particles.push({mesh,vx:Math.cos(angle)*speed,vy:tile==='stone'?.8+(i%3)*.2:1.4+(i%4)*.3,vz:Math.sin(angle)*speed,age:0,life:tile==='stone'?.9:.65,steam:tile==='stone',size:mesh.scale.x});
    }
  }
  update(dt:number){
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
      return true;
    });
  }
  clear(){this.sands.forEach(s=>(s.mesh.material as T.Material).dispose());this.waves.forEach(w=>w.meshes.forEach(m=>(m.material as T.Material).dispose()));this.ripples.forEach(r=>(r.mesh.material as T.Material).dispose());this.sands=[];this.waves=[];this.fades.forEach(f=>(f.mesh.material as T.Material).dispose());this.fades=[];this.particles=[];this.ripples=[];this.group.clear();}
  dispose(){this.clear();this.sandMaterial.dispose();this.tileGeometry.dispose();this.ring.dispose();this.ripples=[];this.geometry.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.particles=[];this.group.clear();}
}
