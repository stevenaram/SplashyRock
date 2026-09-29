import * as T from 'three';
import type {Game} from './game';
import {bossHealth,BOSS_ENTRANCE_SECONDS,BOSS_DEATH_SECONDS,type Boss} from './boss';
import type {SoundCue} from './sound';
import {gridWorld} from './map';

// Unlit, deliberately small palette, like the pets and elemental surfaces.
export class BossView {
 private readonly hitColor=new T.Color('#fff0c5');
 private root=new T.Group();
 private body=new T.Group();
 private halo=new T.Group();
 private death=new T.Group();
 private aftermath=new T.Group();
 private bar=document.createElement('div');
 private health=1;private trail=1;private lastHealth=1;private trailDelay=0;

 private hitSoundDelay=-1;private deathSound=false;private burstSound=false;
 private notice=document.createElement('div');
 private id=0;private age=0;private hitAge=10;private hits=0;private exiting=0;private noticeAge=10;

 constructor(private scene:T.Scene,private host:HTMLElement,private project:(x:number,y:number,height:number)=>{x:number;y:number},private sound:(cue:SoundCue,cell:number,level:number)=>void=()=>{}){
  this.root.add(this.body,this.halo,this.death,this.aftermath);scene.add(this.root);
  this.bar.className='boss-health';this.bar.hidden=true;this.bar.innerHTML='<div class="territory-track" role="progressbar" aria-label="Boss territory" aria-valuemin="0" aria-valuemax="64"><em></em><i></i><span class="health-ticks"></span></div>';host.append(this.bar);
  this.notice.className='boss-notice';this.notice.hidden=true;this.notice.setAttribute('role','status');host.append(this.notice);
 }
 private clear(){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.body.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.death.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.halo.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.aftermath.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.body.clear();this.halo.clear();this.death.clear();this.aftermath.clear();}
 private build(b:Boss){
  this.clear();this.id=b.id;this.age=0;this.exiting=0;this.hits=b.hits;this.hitAge=10;this.hitSoundDelay=-1;this.deathSound=false;this.burstSound=false;
  this.sound('bossSpawn',b.cell,b.element==='water'?1:2);
  const water=b.element==='water',base=new T.MeshBasicMaterial({color:water?'#248ab2':'#d9522b'}),shade=new T.MeshBasicMaterial({color:water?'#17465a':'#6c343b'}),light=new T.MeshBasicMaterial({color:water?'#72c9cf':'#ffb957'}),cream=new T.MeshBasicMaterial({color:'#fff0c5'});this.body.rotation.y=Math.PI;
  const mesh=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);this.body.add(m);return m;};
  mesh(new T.SphereGeometry(1,10,7),shade,0,.55,0,1.05,.6,.82);
  mesh(new T.SphereGeometry(1,10,7),base,0,.88,-.12,.95,.83,.73);
  mesh(new T.SphereGeometry(1,8,5),light,-.24,1.33,-.35,.42,.24,.19);
  for(const side of [-1,1]){
   const horn=mesh(new T.ConeGeometry(.24,.85,5),shade,side*.65,1.75,0);horn.rotation.z=-side*.35;
   mesh(new T.ConeGeometry(.14,.46,5),light,side*.76,2,-.02);
   mesh(new T.SphereGeometry(1,7,5),base,side*1.0,.45,-.1,.33,.38,.38);
   mesh(new T.BoxGeometry(.35,.22,.1),cream,side*.35,1.02,-.79);
   mesh(new T.BoxGeometry(.10,.20,.12),shade,side*.34,1.02,-.86);
   const brow=mesh(new T.BoxGeometry(.46,.13,.15),shade,side*.35,1.2,-.8);brow.rotation.z=side*.22;
  }
  mesh(new T.BoxGeometry(.48,.16,.12),shade,0,.63,-.81);
  for(const x of [-.15,.15])mesh(new T.ConeGeometry(.065,.15,3),cream,x,.62,-.9);
  this.body.traverse(o=>{if(o instanceof T.Mesh)o.userData.baseColor=(o.material as T.MeshBasicMaterial).color.clone();});
  const debrisGeometry=new T.BoxGeometry(1,1,1),debrisMaterial=new T.MeshBasicMaterial({color:water?'#a3ded7':'#ffcf75',transparent:true,opacity:0,depthWrite:false});
  for(let i=0;i<18;i++){const piece=new T.Mesh(debrisGeometry,debrisMaterial);piece.userData.index=i;this.death.add(piece);}
  const ring=new T.Mesh(new T.RingGeometry(.86,1,24),new T.MeshBasicMaterial({color:water?'#b1efed':'#ffe0a1',transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.userData.ring=true;this.death.add(ring);this.death.visible=false;
  // A restrained steam-to-stone finish stays inside the four held tiles.
  const cube=new T.BoxGeometry(1,1,1);
  const crust=new T.MeshBasicMaterial({color:'#d9c9a5',transparent:true,opacity:0});
  for(let i=0;i<4;i++){const m=new T.Mesh(cube,crust);m.userData={kind:'crust',index:i};this.aftermath.add(m);}
  const steam=new T.MeshBasicMaterial({color:'#fff0d7',transparent:true,opacity:0,depthWrite:false});
  for(let i=0;i<12;i++){const m=new T.Mesh(cube,steam);m.userData={kind:'steam',index:i};this.aftermath.add(m);}
  this.aftermath.visible=false;
  const mark=new T.MeshBasicMaterial({color:water?'#a3ded7':'#ffd185',transparent:true,opacity:.48,depthWrite:false});
  const geometry=new T.RingGeometry(1.27,1.32,4);geometry.rotateZ(Math.PI/4);
  for(let c=0;c<64;c++){const m=new T.Mesh(geometry,mark);m.rotation.x=-Math.PI/2;m.position.set(gridWorld(c%8),.13,gridWorld(Math.floor(c/8)));m.userData.cell=c;this.halo.add(m);}
 }
 update(game:Game,dt:number,reduced:boolean,b:Boss){
  if(game.bossNotice){this.notice.textContent=game.bossNotice;game.bossNotice='';this.notice.hidden=false;this.noticeAge=0;}
  this.noticeAge+=dt;if(this.noticeAge>4.5)this.notice.hidden=true;
  if(b.id!==this.id){this.build(b);this.body.position.set(gridWorld(b.x),0,gridWorld(b.y));}
  if(b.deathRemaining>0){
    this.body.position.x=gridWorld(b.x);this.body.position.z=gridWorld(b.y);
    this.halo.visible=false;
    this.hitSoundDelay=-1;
    if(!this.deathSound){this.deathSound=true;this.sound('bossDeath',b.cell,b.element==='water'?1:2);}
    this.exiting=BOSS_DEATH_SECONDS-b.deathRemaining;const t=this.exiting,collapse=Math.max(0,Math.min(1,(t-.65)/1.45));
    if(t>=1.75&&!this.burstSound){this.burstSound=true;this.sound('bossBurst',b.cell,b.element==='water'?1:2);this.sound('steam',b.cell,1);}
    this.bar.querySelector('i')!.style.width='0%';this.bar.querySelector('em')!.style.width='0%';this.bar.hidden=t>1.75;this.bar.querySelector('.territory-track')!.setAttribute('aria-valuenow','0');
    const gather=Math.min(1,t/1.75);
    this.body.scale.set(1.25*(1-collapse*.6),1.25*(1-collapse*.8),1.25*(1-collapse*.6));
    this.body.position.y=-collapse*.45;
    this.body.rotation.x=0;
    this.body.rotation.z=reduced?0:Math.sin(t*22)*.045*gather*(1-collapse);
    this.body.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshBasicMaterial;m.transparent=true;m.opacity=1-collapse;m.color.copy(o.userData.baseColor).lerp(this.hitColor,gather*.65);}});
    this.death.visible=false;this.settleDeath(t,reduced);
    if(t>BOSS_DEATH_SECONDS){this.clear();this.id=0;this.bar.hidden=true;}return;
  }
  if(b.id!==this.id)this.build(b);
  this.age+=dt;this.hitAge+=dt;if(b.hits!==this.hits){this.hits=b.hits;this.hitAge=0;if(this.hitSoundDelay<0)this.hitSoundDelay=.105;}
  if(this.hitSoundDelay>=0){this.hitSoundDelay-=dt;if(this.hitSoundDelay<=0){this.hitSoundDelay=-1;this.sound('bossHit',b.cell,b.element==='water'?1:2);}}
  const hit=reduced?0:Math.max(0,1-this.hitAge/.6),intro=reduced?1:Math.min(1,this.age/BOSS_ENTRANCE_SECONDS);
  const rise=1-Math.pow(1-Math.min(1,intro/.65),3),settle=Math.sin(Math.max(0,(intro-.5)/.5)*Math.PI)*(1-intro);
  this.body.position.set(gridWorld(b.x),reduced?0:-1.5*(1-rise)+settle*.8+Math.sin(this.age*2)*.07+Math.sin(hit*Math.PI)*.35,gridWorld(b.y));
  this.body.scale.set(1.25*(.65+.35*rise)*(1+hit*.26),1.25*(.45+.55*rise+settle*.35)*(1-hit*.32),1.25*(.65+.35*rise)*(1+hit*.26));
  this.body.rotation.x=reduced?0:-Math.sin(intro*Math.PI)*.18;
  this.body.rotation.z=reduced?0:Math.sin(this.hitAge*30)*hit*.22;
  this.body.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshBasicMaterial).color.copy(o.userData.baseColor).lerp(this.hitColor,hit*.65);});
  this.burst(Math.min(1,this.age/BOSS_ENTRANCE_SECONDS),!reduced&&this.age<BOSS_ENTRANCE_SECONDS,2.7);
  this.bar.hidden=false;this.bar.dataset.element=b.element;
  this.bar.setAttribute('aria-label',b.element==='water'?'Water boss health':'Lava boss health');
  const hp=bossHealth(b),target=hp.fraction;
  if(target<this.lastHealth)this.trailDelay=.28;
  const healing=target>this.lastHealth;this.lastHealth=target;
  this.health=reduced?target:this.health+(target-this.health)*(1-Math.exp(-dt*(healing?8:22)));
  this.trailDelay=Math.max(0,this.trailDelay-dt);
  if(reduced)this.trail=target;else if(target>=this.trail)this.trail=this.health;else if(!this.trailDelay)this.trail+=(this.health-this.trail)*(1-Math.exp(-dt*5));
  this.bar.querySelector('i')!.style.width=`${this.health*100}%`;this.bar.querySelector('em')!.style.width=`${this.trail*100}%`;
  const track=this.bar.querySelector('.territory-track')!;track.setAttribute('aria-valuemax',String(hp.max));track.setAttribute('aria-valuenow',String(hp.current));
  const ticks=this.bar.querySelector('.health-ticks') as HTMLElement;ticks.style.setProperty('--tick',`${400/hp.max}%`);
  this.bar.classList.toggle('health-hit',this.hitAge<.25&&!reduced);

  const position=this.project(b.x,b.y,3.5+this.body.position.y);this.bar.style.left=`${Math.max(70,Math.min(this.host.clientWidth-70,position.x))}px`;this.bar.style.top=`${Math.max(6,position.y-12)}px`;
  this.halo.visible=true;for(const m of this.halo.children)m.visible=b.remaining.has(m.userData.cell);

 }
 private settleDeath(t:number,reduced:boolean){
  this.aftermath.visible=true;this.aftermath.position.set(this.body.position.x,0,this.body.position.z);
  const clamp=(v:number)=>Math.max(0,Math.min(1,v));
  const cool=clamp((t-2.1)/.8);
  for(const child of this.aftermath.children){const m=child as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>,i=m.userData.index;
   if(m.userData.kind==='crust'){
    m.position.set(i%2===0?-1:1,.17,Math.floor(i/2)===0?-1:1);
    m.scale.set(1.94,.09,1.94);m.material.opacity=cool*.95;
   }else{
    const rise=clamp((t-1.3)/1.7),angle=i*2.399,r=.35+(i%3)*.38;
    m.position.set(Math.cos(angle)*r,.35+rise*(1.1+i%3*.3),Math.sin(angle)*r);
    m.scale.setScalar((.15+.21*Math.sin(rise*Math.PI))*(reduced?.5:1));
    m.rotation.y=i*.7;m.material.opacity=Math.sin(rise*Math.PI)*.52;
   }
  }
 }
 // Reuse a fixed set of pooled droplets/embers and a ground ring for both entrances and exits.
 private burst(t:number,visible:boolean,radius:number){
  this.death.visible=visible;if(!visible)return;
  this.death.position.set(this.body.position.x,.12,this.body.position.z);
  const ease=1-Math.pow(1-t,3);
  for(const child of this.death.children){const m=child as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
   if(m.userData.ring){m.scale.setScalar(.45+radius*ease);m.material.opacity=.6*(1-t)*(1-t);}
   else{const i=m.userData.index,angle=i*2.399,r=(.45+i%3*.22)*radius*ease;
    m.position.set(Math.cos(angle)*r,.15+Math.sin(t*Math.PI)*(1.1+i%3*.35),Math.sin(angle)*r);
    m.scale.set(.13*(1-t),(.2+i%3*.07)*(1-t),.13*(1-t));m.rotation.set(t*4,angle,t*2);m.material.opacity=.85*(1-t);
   }
  }
 }
 dispose(){this.clear();this.root.removeFromParent();this.notice.remove();this.bar.remove();}
}
