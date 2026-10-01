import * as T from 'three';
import {BOSS_SLAM_DELAY,BOSS_WAVE_SPEED,BOSS_SURGE_DURATION,type Boss,type BossSurge} from './boss';
import {gridWorld} from './map';
import type {SoundCue} from './sound';

// One masked, displaced sheet per boss. The first crest matches logical growth;
// a softer trailing wake stays purely cosmetic.
export class BossSurgeView {
 readonly group=new T.Group();
 private data=new Uint8Array(64*4);
 private mask=new T.DataTexture(this.data,8,8,T.RGBAFormat);
 private waves=Array.from({length:8},()=>new T.Vector4(0,0,-100,0));
 private material:T.ShaderMaterial;
 private sheet:T.Mesh;
 private droplets:T.InstancedMesh;
 private dropMaterial=new T.MeshBasicMaterial({color:'#bffbfa',transparent:true,depthWrite:false});
 private sounded=new WeakSet<BossSurge>();
 private lastImpact:BossSurge|null=null;
 private dummy=new T.Object3D();
 constructor(){
  this.mask.minFilter=this.mask.magFilter=T.NearestFilter;
  const shared=`uniform sampler2D mask;uniform vec4 waves[8];uniform float lava;float occupied(vec2 p){vec2 c=floor((p+8.)/2.);if(any(lessThan(c,vec2(0.)))||any(greaterThanEqual(c,vec2(8.))))return 0.;return texture2D(mask,(c+.5)/8.).r;}float crest(vec2 p,vec4 w){float d=length(p-w.xy);return exp(-pow((d-w.z)/.26,2.))*w.w;}`;
  this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{shipInverse:{value:new T.Matrix4()},mask:{value:this.mask},waves:{value:this.waves},lava:{value:0}},
   vertexShader:shared+`uniform mat4 shipInverse;varying vec2 p;varying float rise;void main(){vec4 world=modelMatrix*vec4(position,1.);p=(shipInverse*world).xz;rise=0.;for(int i=0;i<8;i++)rise+=crest(p,waves[i]);world.y+=min(rise,1.6)*.22*occupied(p);gl_Position=projectionMatrix*viewMatrix*world;}`,
   fragmentShader:shared+`varying vec2 p;varying float rise;void main(){if(occupied(p)<.5)discard;vec2 q=floor((p+8.)*32.)/32.-8.;float front=0.,wake=0.;for(int i=0;i<8;i++){front+=crest(q,waves[i]);vec4 w=waves[i];w.z-=.75;wake+=crest(q,w)*.3;}float energy=min(1.,front+wake);if(energy<.015)discard;float grain=fract(sin(dot(floor(q*32.),vec2(12.9898,78.233)))*43758.5453);vec3 base=mix(vec3(.24,.75,.83),vec3(1.,.39,.09),lava);vec3 foam=mix(vec3(.88,1.,.97),vec3(1.,.88,.48),lava);vec3 color=mix(base,foam,step(.63,front+grain*.12));gl_FragColor=vec4(color,energy*.78);}`});
  this.sheet=new T.Mesh(new T.PlaneGeometry(16,16,128,128),this.material);this.sheet.rotation.x=-Math.PI/2;this.sheet.position.y=.085;this.sheet.renderOrder=3;this.group.add(this.sheet);
  this.droplets=new T.InstancedMesh(new T.IcosahedronGeometry(.11,0),this.dropMaterial,18);this.droplets.frustumCulled=false;this.group.add(this.droplets);this.droplets.visible=false;
 }
 update(b:Boss,reduced:boolean,sound:(cue:SoundCue,cell:number,level:number)=>void){
  this.group.visible=!b.deathRemaining&&b.surges.length>0;if(!this.group.visible)return;
  this.data.fill(0);for(const c of b.remaining)this.data[c*4]=255;this.mask.needsUpdate=true;
  this.material.uniforms.lava.value=b.element==='lava'?1:0;this.dropMaterial.color.set(b.element==='lava'?'#ffd27e':'#bffbfa');
  this.waves.forEach(w=>w.set(0,0,-100,0));
  for(const wave of b.surges){if(wave.age>=BOSS_SLAM_DELAY&&!this.sounded.has(wave)){this.sounded.add(wave);this.lastImpact=wave;sound('bossSlam',b.cell,b.element==='water'?1:2);}}
  b.surges.slice(-8).forEach((wave,i)=>{const age=wave.age-BOSS_SLAM_DELAY;if(age>=0)this.waves[i].set(gridWorld(wave.x),gridWorld(wave.y),age*BOSS_WAVE_SPEED*2,reduced?.4:Math.min(1,age/.055)*Math.min(1,(BOSS_SURGE_DURATION-wave.age)/.2));});
  const wave=this.lastImpact,age=wave?wave.age-BOSS_SLAM_DELAY:10;this.droplets.visible=!!wave&&age>=0&&age<.6&&!reduced;
  if(this.droplets.visible&&wave){
   const t=age/.6;this.dropMaterial.opacity=(1-t)*.85;
   for(let i=0;i<18;i++){const angle=i*2.399,r=.65+t*(1.4+i%3*.2);this.dummy.position.set(gridWorld(wave.x)+Math.cos(angle)*r,.12+Math.sin(t*Math.PI)*(1.1+i%3*.22),gridWorld(wave.y)+Math.sin(angle)*r);this.dummy.scale.set(.7*(1-t),1.8*(1-t),.7*(1-t));this.dummy.rotation.set(t*3,angle,t*2);this.dummy.updateMatrix();this.droplets.setMatrixAt(i,this.dummy.matrix);}
   this.droplets.instanceMatrix.needsUpdate=true;
  }
 }
 dispose(){this.group.removeFromParent();this.sheet.geometry.dispose();this.material.dispose();this.mask.dispose();this.droplets.geometry.dispose();this.dropMaterial.dispose();}
}
