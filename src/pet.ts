import * as T from 'three';
import {gridWorld} from './map';

function skinTexture(stone=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const ctx=canvas.getContext('2d')!;let seed=stone?81:31;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 ctx.fillStyle=stone?'#543e46':'#e5632c';ctx.fillRect(0,0,32,32);
 for(let i=0;i<130;i++){ctx.fillStyle=stone?(i%2?'#65535a':'#40333c'):(i%3?'#f88c36':'#bb482d');ctx.fillRect(Math.floor(random()*32),Math.floor(random()*32),2,2);}
 if(stone){ctx.strokeStyle='#ffb957';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,27);ctx.lineTo(8,24);ctx.lineTo(12,29);ctx.lineTo(22,25);ctx.lineTo(32,28);ctx.stroke();}
 else{ctx.fillStyle='#ffb957';ctx.fillRect(0,24,32,8);ctx.fillStyle='#ffe097';ctx.fillRect(0,29,32,3);}
 const texture=new T.CanvasTexture(canvas);texture.magFilter=texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;return texture;
}
export function createPetModel(){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const skins=[skinTexture(),skinTexture(true)];
 const orange=new T.MeshStandardMaterial({map:skins[0],roughness:1,flatShading:true});
 const charcoal=new T.MeshStandardMaterial({map:skins[1],roughness:1,flatShading:true});
 const gold=new T.MeshBasicMaterial({color:'#ffb957'}),black=new T.MeshBasicMaterial({color:'#261f27'}),cream=new T.MeshBasicMaterial({color:'#fff0c5'});
 const mesh=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1,parent:T.Group=body)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
 mesh(new T.SphereGeometry(1,12,8),orange,0,.38,.08,.45,.31,.52);
 const head=new T.Group();head.position.set(0,.34,-.40);body.add(head);
 mesh(new T.SphereGeometry(1,10,7),orange,0,0,0,.39,.30,.34,head);
 mesh(new T.SphereGeometry(1,10,6),orange,0,-.095,-.23,.33,.17,.18,head);
 const eyes:T.Group[]=[];
 for(const side of [-1,1]){
  const eye=new T.Group();eye.position.set(side*.235,.07,-.267);eye.rotation.y=side*-.32;head.add(eye);eyes.push(eye);
  mesh(new T.BoxGeometry(.155,.205,.035),black,0,0,0,1,1,1,eye);
  mesh(new T.BoxGeometry(.10,.16,.04),gold,0,0,-.025,1,1,1,eye);
  mesh(new T.BoxGeometry(.028,.135,.045),black,side*.008,0,-.05,1,1,1,eye);
  mesh(new T.BoxGeometry(.04,.047,.02),cream,-.027,.049,-.076,1,1,1,eye);
  mesh(new T.BoxGeometry(.026,.023,.015),black,side*.12,-.10,-.387,1,1,1,head);
 }
 // A ridged volcanic shell, with a warm seam beneath each low-poly plate.
 for(const [x,z,h] of [[0,.05,.48],[0,.34,.38],[0,-.17,.34],[-.29,.15,.29],[.29,.15,.29],[-.27,.4,.24],[.27,.4,.24]]){
  mesh(new T.ConeGeometry(.19,h,5),gold,x,.61,z,1,.24,1);
  const spike=mesh(new T.ConeGeometry(.18,h,5),charcoal,x,.63+h*.35,z);spike.rotation.z=x*-.35;
 }
 const tail=new T.Group();tail.position.set(0,.27,.48);body.add(tail);
 const tailPiece=mesh(new T.SphereGeometry(1,8,5),orange,.15,0,.15,.22,.13,.34,tail);tailPiece.rotation.y=.6;
 mesh(new T.SphereGeometry(1,8,5),orange,.36,.035,.30,.22,.10,.14,tail);
 mesh(new T.ConeGeometry(.10,.23,5),charcoal,.23,.13,.23,1,1,1,tail);
 const legs:T.Group[]=[];
 for(const z of [-.28,.36])for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.36,.23,z);body.add(leg);legs.push(leg);
  mesh(new T.SphereGeometry(1,8,5),orange,side*.045,-.075,0,.14,.16,.16,leg);
  mesh(new T.BoxGeometry(.23,.115,.25),charcoal,side*.07,-.16,-.045,1,1,1,leg);
  for(let toe=0;toe<3;toe++)mesh(new T.BoxGeometry(.034,.047,.055),gold,side*.07+(toe-1)*.065,-.17,-.18,1,1,1,leg);
 }
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
 const scale=1.4/Math.max(size.x,size.z);root.scale.setScalar(scale);root.position.y=-box.min.y*scale;
 return {root,body,head,tail,legs,eyes,textures:skins};
}
export class PetWalker {
 readonly group=new T.Group();
 private readonly model=createPetModel();
 private cell:number;private next:number;private progress=0;private duration=1;private pause=.65;private age=0;private spawn=0;
 private x=0;private z=0;private heading=0;
 constructor(cell:number,private readonly random:()=>number=Math.random){this.cell=this.next=cell;this.x=gridWorld(cell%8);this.z=gridWorld(Math.floor(cell/8));this.group.position.set(this.x,.08,this.z);this.group.add(this.model.root);
  // A small contact shadow follows the pet without re-rendering the island shadow map.
  const shadow=new T.Mesh(new T.CircleGeometry(.48,12),new T.MeshBasicMaterial({color:'#705536',transparent:true,opacity:.24,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.8,1);shadow.position.y=.005;this.group.add(shadow);
 }
 update(dt:number,reduced=false){
  this.age+=dt;this.spawn=Math.min(1,this.spawn+dt/.32);this.group.scale.setScalar(reduced?1:1-Math.pow(1-this.spawn,3));
  let walking=false;
  if(this.pause>0){this.pause-=dt;if(this.pause<=0){
    const x=this.cell%8,y=Math.floor(this.cell/8),choices:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<8&&y+dy>=0&&y+dy<8)choices.push((y+dy)*8+x+dx);
    this.next=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.progress=0;
    const dx=gridWorld(this.next%8)-this.x,dz=gridWorld(Math.floor(this.next/8))-this.z;
    this.duration=Math.hypot(dx,dz)/(1.05+this.random()*.25);this.heading=Math.atan2(-dx,-dz);
  }}else{
    walking=true;this.progress=Math.min(1,this.progress+dt/this.duration);
    const t=this.progress;const smooth=t*t*(3-2*t);
    this.group.position.x=T.MathUtils.lerp(this.x,gridWorld(this.next%8),smooth);this.group.position.z=T.MathUtils.lerp(this.z,gridWorld(Math.floor(this.next/8)),smooth);
    if(t===1){this.cell=this.next;this.x=this.group.position.x;this.z=this.group.position.z;this.pause=.35+this.random()*1.1;}
  }
  const delta=Math.atan2(Math.sin(this.heading-this.model.body.rotation.y),Math.cos(this.heading-this.model.body.rotation.y));this.model.body.rotation.y+=delta*Math.min(1,dt*7);
  const stride=walking?Math.sin(this.age*11):0;
  this.model.legs.forEach((leg,i)=>{leg.rotation.x=reduced?0:stride*(i===0||i===3?1:-1)*.30;});
  this.model.body.position.y=reduced?0:walking?Math.abs(stride)*.035:Math.sin(this.age*2)*.012;
  this.model.tail.rotation.y=reduced?0:Math.sin(this.age*(walking?5:2))*.12;
  this.model.head.rotation.x=reduced?0:Math.sin(this.age*2.4)*.035;
  const blink=this.age%5.3;this.model.eyes.forEach(eye=>eye.scale.y=blink>4.95&&blink<5.08?.12:1);
 }
 dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.model.textures.forEach(t=>t.dispose());this.group.removeFromParent();}
}
let icon:string|undefined;
export function petIcon(){
 if(icon)return icon;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setSize(128,128);renderer.setPixelRatio(1);
 const scene=new T.Scene(),model=createPetModel();model.body.rotation.y=-.45;scene.add(model.root,new T.HemisphereLight('#fff0ce','#654739',2));
 const light=new T.DirectionalLight('#fff2d5',3);light.position.set(-3,5,-4);scene.add(light);
 const camera=new T.PerspectiveCamera(32,1,.1,20);camera.position.set(1.0,1.3,-2.35);camera.lookAt(0,.4,0);
 renderer.render(scene,camera);icon=renderer.domElement.toDataURL();
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();model.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);materials.add(o.material as T.Material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());model.textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();return icon;
}
