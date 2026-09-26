import * as T from 'three';
import { gridWorld } from './map';
import type { Tile } from './game';

type Particle={mesh:T.Mesh;vx:number;vy:number;vz:number;age:number;life:number;steam:boolean};
export class Effects {
  readonly group=new T.Group();
  private particles:Particle[]=[];
  private ripples:{mesh:T.Mesh;age:number}[]=[];
  private readonly ring=new T.RingGeometry(.36,.39,24);
  private readonly geometry=new T.BoxGeometry(1,1,1);
  private readonly materials={
    water:new T.MeshBasicMaterial({color:'#b1efed'}),
    lava:new T.MeshBasicMaterial({color:'#ffbd5b'}),
    stone:new T.MeshBasicMaterial({color:'#e3e4c9'}),
  };
  burst(cell:number,tile:Tile){
    const x=gridWorld(cell%8),z=gridWorld(Math.floor(cell/8));
    if(tile==='water'){
      const ring=new T.Mesh(this.ring,this.materials.water);ring.rotation.x=-Math.PI/2;ring.position.set(x,.09,z);this.group.add(ring);this.ripples.push({mesh:ring,age:0});
    }
    for(let i=0;i<(tile==='stone'?8:9);i++){
      const angle=i*2.399+cell, speed=.7+(i%3)*.35;
      const mesh=new T.Mesh(this.geometry,this.materials[tile]);
      mesh.scale.setScalar(tile==='stone'?.14:.0625+(i%2)*.03125);mesh.position.set(x+Math.cos(angle)*.25,.15,z+Math.sin(angle)*.25);this.group.add(mesh);
      this.particles.push({mesh,vx:Math.cos(angle)*speed,vy:tile==='stone'?.8+(i%3)*.2:1.4+(i%4)*.3,vz:Math.sin(angle)*speed,age:0,life:tile==='stone'?.9:.65,steam:tile==='stone'});
    }
  }
  update(dt:number){
    this.ripples=this.ripples.filter(r=>{r.age+=dt;if(r.age>.6){r.mesh.removeFromParent();return false;}r.mesh.scale.setScalar(.5+r.age*2.5);return true;});
    this.particles=this.particles.filter(p=>{
      p.age+=dt;if(p.age>=p.life){p.mesh.removeFromParent();return false;}
      p.mesh.position.x+=p.vx*dt*(p.steam?.15:1);p.mesh.position.z+=p.vz*dt*(p.steam?.15:1);p.mesh.position.y+=p.vy*dt;
      if(!p.steam)p.vy-=5*dt;
      p.mesh.visible=p.mesh.position.y>.08;
      if(p.steam)p.mesh.scale.setScalar(.14*(1+p.age)*Math.min(1,(p.life-p.age)*4));
      return true;
    });
  }
  dispose(){this.ring.dispose();this.ripples=[];this.geometry.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.particles=[];this.group.clear();}
}
