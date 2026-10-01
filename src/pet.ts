import {carriedBrick} from './boat-view';
import * as T from 'three';
import {createEgg} from './egg';
import {gridWorld} from './map';
import type {Element} from './game';
import type {PetMotion} from './pet-motion';

function skinTexture(stone=false,water=false){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const ctx=canvas.getContext('2d')!;
 const base=water?(stone?'#205b70':'#248ab2'):(stone?'#54333a':'#e5632c');
 const shade=water?(stone?'#17465a':'#26758b'):(stone?'#261f27':'#bb482d');
 const light=water?(stone?'#26758b':'#72c9cf'):(stone?'#655347':'#ffb957');
 ctx.fillStyle=base;ctx.fillRect(0,0,32,32);
 ctx.fillStyle=shade;ctx.fillRect(0,23,32,9);ctx.fillRect(0,20,9,3);ctx.fillRect(24,19,8,4);
 ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(5,5);ctx.lineTo(18,5);ctx.lineTo(23,10);ctx.lineTo(20,13);ctx.lineTo(7,11);ctx.closePath();ctx.fill();
 if(stone){ctx.fillStyle=water?'#72c9cf':'#ffb957';for(const [x,y] of [[2,25],[6,24],[10,26],[14,25],[18,23],[22,24],[26,25]])ctx.fillRect(x,y,4,1);}
 else{ctx.fillStyle=water?'#a3ded7':'#ffe097';ctx.fillRect(0,28,32,4);}
 const texture=new T.CanvasTexture(canvas);texture.magFilter=texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.name=`pet-${water?'water':'lava'}-${stone?'shell':'body'}`;return texture;
}
export function createPetModel(element:Element='lava'){
 const water=element==='water';
 const root=new T.Group(),body=new T.Group();root.add(body);
 const skins=[skinTexture(false,water),skinTexture(true,water)];
 const orange=new T.MeshBasicMaterial({map:skins[0]});
 const charcoal=new T.MeshBasicMaterial({map:skins[1]});
 const gold=new T.MeshBasicMaterial({color:water?'#a8ede1':'#ffb957'}),black=new T.MeshBasicMaterial({color:'#261f27'}),cream=new T.MeshBasicMaterial({color:'#fff0c5'});
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
 return {root,body,head,tail,legs,eyes,glowMaterials:[orange,charcoal],textures:skins};
}
export class PetWalker {
 readonly group=new T.Group();
 private readonly model:ReturnType<typeof createPetModel>;
 private readonly egg=createEgg();
 private age=0;private spawn=0;private swim=0;
 private gait=0;private walkBlend=0;private swimPhase=0;
 private readonly wake=new T.Group();
 private readonly wakeMaterial:T.ShaderMaterial;
 private readonly cargo=carriedBrick();
 private readonly shadow:T.Mesh;
 private readonly landing:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>;
 constructor(readonly motion:PetMotion){this.age=motion.cell*.371;this.gait=(motion.cell*.618)%1;this.swimPhase=motion.cell*1.37;this.model=createPetModel(motion.element);this.group.position.set(gridWorld(motion.x),.08,gridWorld(motion.y));this.group.add(this.model.root,this.egg.group);this.model.root.visible=false;this.model.body.add(this.cargo);this.cargo.position.set(0,.86,.08);this.cargo.visible=false;
  // A small contact shadow follows the pet without re-rendering the island shadow map.
  const shadow=this.shadow=new T.Mesh(new T.CircleGeometry(.48,12),new T.MeshBasicMaterial({color:'#705536',transparent:true,opacity:.24,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.8,1);shadow.position.y=.005;this.group.add(shadow);
  const frame=new T.RingGeometry(.88*Math.SQRT2,.94*Math.SQRT2,4);frame.rotateZ(Math.PI/4);
  this.landing=new T.Mesh(frame,new T.MeshBasicMaterial({color:motion.element==='water'?'#bcf5ed':'#ffcf75',transparent:true,opacity:0,depthWrite:false}));
  this.landing.rotation.x=-Math.PI/2;this.landing.position.y=.035;this.landing.visible=false;this.group.add(this.landing);
  this.wakeMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{shipInverse:{value:new T.Matrix4()},color:{value:new T.Color(motion.element==='water'?'#a3ded7':'#ffb957')},alpha:{value:0},bounds:{value:new T.Vector4()}},vertexShader:`uniform mat4 shipInverse;varying vec2 ground;void main(){vec4 p=modelMatrix*vec4(position,1.);ground=(shipInverse*p).xz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`varying vec2 ground;uniform vec3 color;uniform float alpha;uniform vec4 bounds;void main(){if(ground.x<bounds.x||ground.y<bounds.y||ground.x>bounds.z||ground.y>bounds.w)discard;gl_FragColor=vec4(color,alpha);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  for(let i=0;i<2;i++){const ring=new T.Mesh(new T.RingGeometry(.91,1,24,1,.25,Math.PI*1.5),this.wakeMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(0,.012,i*.30);ring.scale.set(.55+i*.08,.33+i*.05,1);this.wake.add(ring);}
  this.group.add(this.wake);
 }
 update(dt:number,reduced=false){
  this.age+=dt;this.spawn=Math.min(1,this.spawn+dt/.32);this.group.scale.setScalar(reduced?1:1-Math.pow(1-this.spawn,3));
  const previousX=this.motion.x,previousY=this.motion.y,wasLeaping=this.motion.leaping;
  this.motion.update(dt);
  const distance=wasLeaping||this.motion.leaping?0:Math.hypot(this.motion.x-previousX,this.motion.y-previousY)*2;
  this.gait=(this.gait+distance/.72)%1;
  if(this.motion.hatchRemaining>0){
    const t=1.8-this.motion.hatchRemaining,crack=Math.max(0,Math.min(1,(t-.9)/.25)),open=Math.max(0,Math.min(1,(t-1.1)/.55));
    this.wake.visible=false;this.egg.group.visible=true;
    this.egg.group.rotation.z=reduced?0:Math.sin(t*24)*Math.sin(Math.min(1,t/1.1)*Math.PI)*.15;
    this.egg.parts.forEach((part,i)=>{
      part.position.set(reduced?0:(i===0?1:-1)*open*.7,reduced?.7:.7+(i===0?Math.sin(open*Math.PI)*.65+open*.15:-open*.45)+crack*(i===0?.025:-.025),0);
      part.rotation.z=reduced?0:(i===0?-1:1)*open*1.3;
      (part.material as T.MeshBasicMaterial).opacity=1-open;
    });
    this.egg.chips.forEach((chip,i)=>{chip.visible=open>0&&!reduced;const angle=i*Math.PI*.5+.4;chip.position.set(Math.cos(angle)*open*.85,.55+Math.sin(open*Math.PI)*.45-open*.5,Math.sin(angle)*open*.85);chip.rotation.set(open*4+i,open*3,open*2);chip.scale.setScalar(1-open);(chip.material as T.MeshBasicMaterial).opacity=1-open;});
    const emerge=Math.max(0,Math.min(1,(t-1.1)/.5));this.model.root.visible=emerge>0;
    this.model.body.scale.setScalar(.45+emerge*.55);
    this.model.body.position.y=reduced?0:Math.sin(emerge*Math.PI)*.28;
    this.model.head.rotation.x=reduced?0:-Math.sin(emerge*Math.PI)*.22;
    this.model.tail.rotation.y=reduced?0:Math.sin(t*15)*emerge*.18;
    return;
  }
  this.egg.group.visible=false;this.model.root.visible=true;
  this.cargo.visible=this.motion.carryingBrick;this.model.root.position.y=this.motion.altitude;
  const leaping=this.motion.leaping,walking=this.motion.next!==null&&!leaping;
  const targetSwim=this.motion.onOwnLiquid&&!leaping&&this.motion.planting===0?1:0;
  this.swim+=(targetSwim-this.swim)*Math.min(1,dt*9);
  this.shadow.visible=leaping||this.swim<.15;
  const flightArc=leaping?Math.pow(Math.sin(this.motion.leapProgress*Math.PI),.85):0;
  // Height is purely visual: the ability still lands on the same gameplay frame.
  const height=reduced?0:flightArc*4.5*(this.motion.attacking?1.8:1);
  this.landing.visible=leaping;
  if(leaping&&this.motion.flightDestination){
    const target=this.motion.flightDestination;this.landing.position.set(gridWorld(target.x)-gridWorld(this.motion.x),.035,gridWorld(target.y)-gridWorld(this.motion.y));
    this.landing.material.opacity=reduced?.6:.3+this.motion.leapProgress*.5;
  }
  const shadowLift=reduced?0:flightArc;
  this.shadow.scale.set(1+shadowLift*.65,.8+shadowLift*.5,1);
  (this.shadow.material as T.MeshBasicMaterial).opacity=.27-shadowLift*.16;
  this.wake.visible=this.swim>.02&&this.motion.onOwnLiquid;
  this.wake.rotation.y=this.model.body.rotation.y;
  this.wakeMaterial.uniforms.alpha.value=this.swim*(walking?.48:.23);
  const cx=gridWorld(Math.round(this.motion.x)),cz=gridWorld(Math.round(this.motion.y));this.wakeMaterial.uniforms.bounds.value.set(cx-1,cz-1,cx+1,cz+1);
  this.wake.scale.setScalar(reduced?1:1+Math.sin(this.age*5)*.045);
  this.group.position.x=gridWorld(this.motion.x)+(this.motion.building?0:this.motion.visualOffsetX*2);this.group.position.z=gridWorld(this.motion.y)+(this.motion.building?0:this.motion.visualOffsetY*2);
  const delta=Math.atan2(Math.sin(this.motion.heading-this.model.body.rotation.y),Math.cos(this.motion.heading-this.model.body.rotation.y));
  this.model.body.rotation.y+=delta*(1-Math.exp(-dt*16));
  this.walkBlend+=((walking?1:0)-this.walkBlend)*(1-Math.exp(-dt*18));
  const land=reduced?0:this.walkBlend*(1-this.swim),cycle=this.gait*Math.PI*2;
  // Continuous strokes blend from slow treading to a stronger travelling paddle.
  const aquatic=this.motion.element==='water'?this.swim:0;
  this.swimPhase+=dt*(2.7+this.walkBlend*3.2);
  const swimCycle=this.swimPhase,stroke=reduced?0:aquatic;
  const effort=.55+this.walkBlend*.45;
  const lavaSwim=this.motion.element==='lava'?this.swim:0;
  const bob=(.025-Math.cos(cycle*2)*.025)*land;
  // Paws spend most of each stride planted, then lift and curl forward.
  // Advance the gait by distance, so short turns never scramble the footsteps.
  this.model.legs.forEach((leg,i)=>{
    const phase=(this.gait+(i===0||i===3?0:.5))%1,stance=phase<.62;
    const swing=stance?0:(phase-.62)/.38,lift=Math.sin(swing*Math.PI);
    const reach=stance?-.2+phase/.62*.4:.2-(swing*swing*(3-2*swing))*.4;
    const paddle=swimCycle+(i%2===0?0:Math.PI)+(i>=2?.65:0);
    const pull=Math.sin(paddle),recover=Math.max(0,-pull),side=i%2===0?-1:1;
    leg.position.x=side*(.36+stroke*(.035+.045*Math.cos(paddle)));
    leg.position.y=.23+lift*.15*land-bob+stroke*(-.055+recover*.055);
    leg.position.z=(i<2?-.28:.36)+reach*land+pull*.14*stroke*effort;
    leg.rotation.x=reduced?0:(stance?-.06:Math.sin(swing*Math.PI)*-.48)*land+Math.sin(this.age*7+(i===0||i===3?0:Math.PI))*lavaSwim*.22+pull*.58*stroke*effort;
    leg.rotation.z=reduced?0:(i%2===0?-1:1)*lift*.13*land+Math.sin(this.age*7+i*Math.PI/2)*lavaSwim*.24+side*(.28+Math.cos(paddle)*.18)*stroke;
  });
  const breath=reduced?0:Math.sin(this.age*2.5)*.014;
  const sniff=reduced?0:Math.pow(Math.max(0,Math.sin(this.age*.85)),10)*(1-this.walkBlend)*.1;
  this.model.body.position.y=bob+breath*(1-this.walkBlend)-this.swim*.19+Math.sin(swimCycle*2-.5)*.025*stroke;
  this.model.body.rotation.x=reduced?0:Math.sin(cycle*2)*.055*land+(-.055+Math.sin(swimCycle*2)*.035)*stroke;
  this.model.body.rotation.z=reduced?0:Math.sin(cycle)*.075*land+Math.sin(this.age*5)*lavaSwim*.045+Math.sin(swimCycle)*.09*stroke*effort;
  this.model.head.rotation.x=reduced?0:-Math.sin(cycle*2+.55)*.085*land+sniff+breath+(.07-Math.sin(swimCycle*2-.25)*.035)*stroke;
  this.model.head.rotation.y=reduced?0:Math.max(-.38,Math.min(.38,delta*.55))+Math.sin(this.age*1.4)*.08*(1-this.walkBlend)*(1-aquatic)-Math.sin(swimCycle)*.06*stroke;
  this.model.head.position.y=.34+(reduced?0:-bob*.45+sniff*.15+aquatic*.045);
  const tailTarget=reduced?0:Math.sin(cycle-.7)*.24*land-delta*.22+Math.sin(this.age*2)*.11*(1-this.walkBlend)+Math.sin(this.age*7)*lavaSwim*.23+Math.sin(swimCycle-.85)*.43*stroke*effort;
  this.model.tail.rotation.y+=(Math.max(-.5,Math.min(.5,tailTarget))-this.model.tail.rotation.y)*(1-Math.exp(-dt*11));
  const planting=this.motion.planting;
  const charge=leaping?Math.sin(this.motion.leapProgress*Math.PI):planting>0?1-planting/.18:0;
  this.model.glowMaterials.forEach(material=>{const glow=charge>.66?.55:charge>.25?.25:0;material.color.setRGB(1+glow*(this.motion.element==='lava'?1:.2),1+glow*.5,1+glow*(this.motion.element==='water'?1:.1));});
  this.model.body.scale.set(1-breath*.3,1+breath*.7,1-breath*.3);this.model.tail.rotation.x=reduced?0:Math.sin(cycle*2-.5)*.09*land+Math.sin(swimCycle*2-1.1)*.075*stroke;
  if(leaping&&!reduced){
    this.model.body.rotation.x=0;this.model.body.rotation.z=0;this.model.head.rotation.y=0;
    this.model.body.position.y=height;this.model.body.scale.set(1-charge*.12,1+charge*.22,1-charge*.12);
    this.model.head.rotation.x=-Math.sin(this.motion.leapProgress*Math.PI*2)*.26;this.model.tail.rotation.x=-charge*.4;
    this.model.legs.forEach((leg,i)=>{leg.position.x=(i%2===0?-1:1)*.36;leg.position.y=.23+charge*.07;leg.position.z=i<2?-.28:.36;leg.rotation.x=-charge*.65;leg.rotation.z=0;});
  }else if(planting>0&&!reduced){
    const squash=Math.sin((planting/.18)*Math.PI);
    this.model.body.scale.set(1+squash*.28,1-squash*.4,1+squash*.28);
    this.model.body.position.y=-squash*.07;this.model.head.rotation.x=squash*.12;
  }
  if(this.motion.feeding>0&&!reduced){const nibble=Math.sin((1-this.motion.feeding)*32);this.model.body.position.y=-.06;this.model.head.rotation.x=.24+nibble*.1;this.model.head.position.y=.27+nibble*.025;this.model.tail.rotation.y=Math.sin(this.age*12)*.2;}
  const blink=this.age%5.3;this.model.eyes.forEach(eye=>eye.scale.y=blink>4.95&&blink<5.08?.12:1);
 }
 dispose(){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.model.textures.forEach(t=>t.dispose());this.egg.texture.dispose();this.group.removeFromParent();}
}
