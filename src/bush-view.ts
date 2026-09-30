import * as T from 'three';
import type {Game} from './game';
import {gridWorld} from './map';
// Batched foliage, fruit and fire keep a full board bounded to a few draw calls.
export class BushField {
 readonly group=new T.Group();
 private dummy=new T.Object3D();private color=new T.Color();
 private leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial(),320);
 private fruit=new T.InstancedMesh(new T.IcosahedronGeometry(.13,1),new T.MeshBasicMaterial({color:'#ec6381'}),256);
 private shine=new T.InstancedMesh(new T.BoxGeometry(.07,.06,.05),new T.MeshBasicMaterial({color:'#ffe6ba'}),256);
 private fire=new T.InstancedMesh(new T.ConeGeometry(.16,.65,5),new T.MeshBasicMaterial(),256);
 private smoke=new T.InstancedMesh(new T.BoxGeometry(.16,.16,.16),new T.MeshBasicMaterial({color:'#b7ac8e',transparent:true,opacity:.5,depthWrite:false}),192);
 private foliageTexture:T.CanvasTexture;
 private born=new Map<number,number>();
 private labels=new Map<number,T.Mesh>();private textures:T.CanvasTexture[]=[];private materials:T.MeshBasicMaterial[]=[];
 constructor(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d5ddc9';ctx.fillRect(0,0,32,32);
  // Painted, pixel-aligned leaf facets: no scene lighting or glossy highlights.
  for(let i=0;i<28;i++){const x=(i*13)%30,y=(i*7+3)%29;ctx.fillStyle=i%3===0?'#ffffff':i%3===1?'#eef2df':'#b9c6ac';ctx.fillRect(x,y,3+(i%3),2);ctx.fillRect(x+1,y-1,2,4);}
  this.foliageTexture=new T.CanvasTexture(canvas);this.foliageTexture.magFilter=this.foliageTexture.minFilter=T.NearestFilter;this.foliageTexture.colorSpace=T.SRGBColorSpace;(this.leaves.material as T.MeshBasicMaterial).map=this.foliageTexture;

  for(const m of [this.leaves,this.fruit,this.shine,this.fire,this.smoke]){m.frustumCulled=false;m.count=0;this.group.add(m);}
  for(let n=0;n<=4;n++){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d')!;x.fillStyle='#183e32';x.beginPath();x.roundRect(2,2,28,28,7);x.fill();x.strokeStyle='#b8d998';x.lineWidth=2;x.stroke();x.fillStyle='#fff0cf';x.font='bold 23px monospace';x.textAlign='center';x.textBaseline='middle';x.fillText(String(n),16,17);const tex=new T.CanvasTexture(c);tex.magFilter=tex.minFilter=T.NearestFilter;tex.colorSpace=T.SRGBColorSpace;this.textures.push(tex);this.materials.push(new T.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}));}
 }
 update(g:Game,time:number,camera:T.Camera,reduced:boolean){
  let leaf=0,fruit=0,fire=0,smoke=0;
  let entrance=1;
  const put=(m:T.InstancedMesh,i:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,color?:string)=>{this.dummy.position.set(x,y,z);this.dummy.scale.set(sx*entrance,sy*entrance,sz*entrance);this.dummy.rotation.set(0,i*2.399,0);this.dummy.updateMatrix();m.setMatrixAt(i,this.dummy.matrix);if(color)m.setColorAt(i,this.color.set(color));};
  for(const [c,b] of g.bushes){
   if(!this.born.has(c))this.born.set(c,time);const age=Math.min(1,(time-this.born.get(c)!)/.24);entrance=reduced?1:1-Math.pow(1-age,3);
   const x=gridWorld(c%8),z=gridWorld(Math.floor(c/8)),burn=b.phase==='ablaze',warm=b.phase==='smoldering';
   for(let i=0;i<5;i++){const a=i*2.399,r=i===0?0:.43,wave=reduced?0:Math.sin(time*2+c+i)*.018;put(this.leaves,leaf++,x+Math.cos(a)*r,.32+(i===0?.16:0)+wave,z+Math.sin(a)*r,.53,.35,.52,burn?(i%2?'#684d35':'#443c31'):warm?(i%2?'#7c793e':'#a39a49'):['#387b48','#559e58','#75b565','#306d43','#8ac478'][i]);}
   if(b.phase==='healthy')for(let i=0;i<b.berries;i++){const a=i*Math.PI/2+.5,fx=x+Math.cos(a)*.46,fz=z+Math.sin(a)*.46;put(this.fruit,fruit,fx,.7,fz,1,1,1);put(this.shine,fruit++,fx-.035,.77,fz-.055,1,1,1);}
   if(burn||warm){for(let i=0;i<(burn?4:2);i++){const a=i*2.399+c,pulse=reduced?1:1+Math.sin(time*12+i+c)*.18;put(this.fire,fire++,x+Math.cos(a)*.45,warm?.67:.85,z+Math.sin(a)*.4,warm?.58:.8,(warm?.4:1.1)*pulse,warm?.42:.8,i%2?'#ffcf68':'#ef7534');}
    for(let i=0;i<3;i++){const t=reduced?.3:(time*.65+i/3+c*.17)%1;put(this.smoke,smoke++,x+Math.sin(c+i)*.25+t*.2,.65+t*.7,z+Math.cos(i)*.2,.6+t,.6+t,.6+t);}}
   let label=this.labels.get(c);if(!label){label=new T.Mesh(new T.PlaneGeometry(.48,.48),this.materials[0]);label.renderOrder=14;this.group.add(label);this.labels.set(c,label);}
   if(label.userData.count!==b.berries){label.userData.count=b.berries;label.userData.changed=time;}label.scale.setScalar(reduced?1:1+Math.sin(Math.min(1,(time-label.userData.changed)/.25)*Math.PI)*.18);
   label.visible=b.phase==='healthy';label.material=this.materials[Math.max(0,Math.min(4,b.berries))];label.position.set(x+.53,.82,z+.36);label.quaternion.copy(camera.quaternion);
  }
  for(const [c,label] of this.labels)if(!g.bushes.has(c)){label.removeFromParent();label.geometry.dispose();this.labels.delete(c);this.born.delete(c);}
  for(const [m,n] of [[this.leaves,leaf],[this.fruit,fruit],[this.shine,fruit],[this.fire,fire],[this.smoke,smoke]] as [T.InstancedMesh,number][]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
 }
 dispose(){this.foliageTexture.dispose();for(const m of [this.leaves,this.fruit,this.shine,this.fire,this.smoke]){m.geometry.dispose();(m.material as T.Material).dispose();}this.labels.forEach(m=>m.geometry.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.group.removeFromParent();}
}
