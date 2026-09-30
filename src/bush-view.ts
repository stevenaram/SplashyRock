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
 private fire=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial(),1536);
 private smoke=new T.InstancedMesh(new T.BoxGeometry(.16,.16,.16),new T.MeshBasicMaterial({color:'#b7ac8e',transparent:true,opacity:.5,depthWrite:false}),192);
 private foliageTexture:T.CanvasTexture;
 private states=new Map<number,{b:object;born:number;heat:number;phase:string;wet:number;berries:number;fruitBorn:number[]}>();
 private previous:number|null=null;
 private tint=new T.Color();private warm=new T.Color('#a17e43');private scorched=new T.Color('#48503a');private char=new T.Color('#17171b');
 constructor(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#d5ddc9';ctx.fillRect(0,0,32,32);
  // Painted, pixel-aligned leaf facets: no scene lighting or glossy highlights.
  for(let i=0;i<28;i++){const x=(i*13)%30,y=(i*7+3)%29;ctx.fillStyle=i%3===0?'#ffffff':i%3===1?'#eef2df':'#b9c6ac';ctx.fillRect(x,y,3+(i%3),2);ctx.fillRect(x+1,y-1,2,4);}
  this.foliageTexture=new T.CanvasTexture(canvas);this.foliageTexture.magFilter=this.foliageTexture.minFilter=T.NearestFilter;this.foliageTexture.colorSpace=T.SRGBColorSpace;(this.leaves.material as T.MeshBasicMaterial).map=this.foliageTexture;

  for(const m of [this.leaves,this.fruit,this.shine,this.fire,this.smoke]){m.frustumCulled=false;m.count=0;this.group.add(m);}
 }
 update(g:Game,time:number,reduced:boolean){
  const dt=this.previous===null?0:Math.min(.05,Math.max(0,time-this.previous));this.previous=time;
  let leaf=0,fruit=0,fire=0,smoke=0,entrance=1;
  const put=(m:T.InstancedMesh,i:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,color?:string|T.Color)=>{this.dummy.position.set(x,y,z);this.dummy.scale.set(sx*entrance,sy*entrance,sz*entrance);this.dummy.rotation.set(0,i*2.399,0);this.dummy.updateMatrix();m.setMatrixAt(i,this.dummy.matrix);if(color)m.setColorAt(i,this.color.set(color));};
  for(const [c,b] of g.bushes){
   let state=this.states.get(c);if(!state||state.b!==b){state={b,born:time,heat:0,phase:'healthy',wet:-100,berries:0,fruitBorn:[]};this.states.set(c,state);}
   const burn=b.phase==='ablaze';
   if(state.phase==='ablaze'&&!burn)state.wet=time;
   if(b.berries>state.berries)for(let i=state.berries;i<b.berries;i++)state.fruitBorn[i]=time+(i-state.berries)*.055;
   state.berries=b.berries;state.phase=b.phase;
   state.heat=reduced?(burn?1:0):Math.max(0,Math.min(1,state.heat+(burn?dt/.3:-dt/.22)));
   const age=Math.min(1,(time-state.born)/.24);entrance=reduced?1:1-Math.pow(1-age,3);
   const x=gridWorld(c%8),z=gridWorld(Math.floor(c/8)),burnout=g.bushBurnouts.get(c),fade=burnout?Math.min(1,burnout.age/.72):0;
   const black=Math.min(1,fade/.72),puff=reduced?0:Math.max(0,(fade-.8)/.2);
   for(let i=0;i<5;i++){
    const a=i*2.399,r=i===0?0:.43,wave=reduced?0:Math.sin(time*2+c+i)*.018;
    // Two levels of singed foliage: a dark olive center and muted green
    // surrounding clusters. Near-black is reserved for the final burnout.
    this.tint.set(['#387b48','#559e58','#75b565','#306d43','#8ac478'][i]).lerp(this.warm,state.heat*.08).lerp(this.scorched,state.heat*(i===0?.9:.24)).lerp(this.char,black);
    put(this.leaves,leaf++,x+Math.cos(a)*r*(1+puff*.1),.32+(i===0?.16:0)+wave+puff*.12,z+Math.sin(a)*r*(1+puff*.1),.53*(1+puff*.1),.35*(1+puff*.18),.52*(1+puff*.1),this.tint);
   }
   if(!burn)for(let i=0;i<b.berries;i++){
    const t=reduced?1:Math.max(0,Math.min(1,(time-state.fruitBorn[i])/.3)),pop=t<.7?Math.sin(t/.7*Math.PI/2)*1.18:1.18-(t-.7)/.3*.18;
    const a=i*Math.PI/2+.5,fx=x+Math.cos(a)*.46,fz=z+Math.sin(a)*.46,y=.7+Math.sin(t*Math.PI)*.13;
    put(this.fruit,fruit,fx,y,fz,pop,pop,pop);put(this.shine,fruit++,fx-.035*pop,y+.07*pop,fz-.055*pop,pop,pop,pop);
   }
   if(state.heat>.001){
    const strength=state.heat*(1-black*.92);
    // Overlapping, rising facets fill the bush rather than forming a ring of spikes.
    for(let i=0;i<18;i++){
     const cycle=reduced?.4:(time*(1.25+(i%4)*.13)+i*.618+c*.137)%1,a=i*2.399+c,r=.12+(i%5)*.085;
     const envelope=Math.sin(cycle*Math.PI),size=(.18+(i%3)*.035)*envelope*strength;
     put(this.fire,fire++,x+Math.cos(a)*r+Math.sin(cycle*5+i)*cycle*.12,.43+cycle*(.75+(i%3)*.12),z+Math.sin(a)*r,size*(1-cycle*.3),size*(1.2+cycle),size,i%3===0?'#ffe097':i%3===1?'#f88c36':'#e5632c');
    }
   }
   const wet=Math.max(0,1-(time-state.wet)/.55);
   if(burn||wet>0)for(let i=0;i<3;i++){
    const t=reduced?.3:(time*.8+i/3+c*.17)%1,size=(.6+t)*(wet>0?wet:1);
    put(this.smoke,smoke++,x+Math.sin(c+i)*.25+t*.2,.65+t*.7,z+Math.cos(i)*.2,size,size,size,wet>0?'#d4eee0':'#a6aaa0');
   }
  }
  for(const c of this.states.keys())if(!g.bushes.has(c))this.states.delete(c);
  for(const [m,n] of [[this.leaves,leaf],[this.fruit,fruit],[this.shine,fruit],[this.fire,fire],[this.smoke,smoke]] as [T.InstancedMesh,number][]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
 }
 dispose(){this.foliageTexture.dispose();for(const m of [this.leaves,this.fruit,this.shine,this.fire,this.smoke]){m.geometry.dispose();(m.material as T.Material).dispose();}this.group.removeFromParent();}
}
