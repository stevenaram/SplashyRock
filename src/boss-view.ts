import * as T from 'three';
import type {Game} from './game';
import type {Boss} from './boss';
import {gridWorld} from './map';

// Unlit, deliberately small palette, like the pets and elemental surfaces.
export class BossView {
 private readonly hitColor=new T.Color('#fff0c5');
 private root=new T.Group();
 private body=new T.Group();
 private halo=new T.Group();
 private death=new T.Group();
 private bar=document.createElement('div');
 private lastDefeats=0;

 private notice=document.createElement('div');
 private id=0;private age=0;private hitAge=10;private hits=0;private exiting=0;private noticeAge=10;

 constructor(private scene:T.Scene,private host:HTMLElement,private project:(cell:number,height:number)=>{x:number;y:number}){
  this.root.add(this.body,this.halo,this.death);scene.add(this.root);
  this.bar.className='boss-health';this.bar.hidden=true;this.bar.innerHTML='<strong></strong><div class="territory-track" role="progressbar" aria-label="Boss territory" aria-valuemin="0" aria-valuemax="64"><i></i></div><small></small>';host.append(this.bar);
  this.notice.className='boss-notice';this.notice.hidden=true;this.notice.setAttribute('role','status');host.append(this.notice);
 }
 private clear(){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.body.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.death.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.halo.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.body.clear();this.halo.clear();this.death.clear();}
 private build(b:Boss){
  this.clear();this.id=b.id;this.age=0;this.exiting=0;this.hits=b.hits;this.hitAge=10;
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
  const mark=new T.MeshBasicMaterial({color:water?'#a3ded7':'#ffd185',transparent:true,opacity:.48,depthWrite:false});
  const geometry=new T.RingGeometry(1.27,1.32,4);geometry.rotateZ(Math.PI/4);
  for(let c=0;c<64;c++){const m=new T.Mesh(geometry,mark);m.rotation.x=-Math.PI/2;m.position.set(gridWorld(c%8),.13,gridWorld(Math.floor(c/8)));m.userData.cell=c;this.halo.add(m);}
 }
 update(game:Game,dt:number,reduced:boolean){
  if(game.bossNotice){this.notice.textContent=game.bossNotice;game.bossNotice='';this.notice.hidden=false;this.noticeAge=0;}
  this.noticeAge+=dt;if(this.noticeAge>4.5)this.notice.hidden=true;
  const b=game.boss;
  if(!b){
    this.halo.visible=false;
    if(!this.id){this.bar.hidden=true;return;}
    if(game.bossesDefeated<=this.lastDefeats){this.clear();this.id=0;this.bar.hidden=true;return;}
    this.exiting+=dt;const t=this.exiting,dissolve=Math.max(0,Math.min(1,(t-.24)/.42));
    this.bar.querySelector('i')!.style.width='0%';this.bar.querySelector('small')!.textContent='Defeated';this.bar.hidden=t>.7;
    this.body.scale.set(1.25*(1+dissolve*.55),1.25*(1-dissolve),1.25*(1+dissolve*.55));
    this.body.position.y=reduced?0:Math.sin(Math.min(1,t/.24)*Math.PI)*.38;
    this.body.rotation.z=reduced?0:Math.sin(t*45)*.14*(1-dissolve);
    this.body.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshBasicMaterial;m.transparent=true;m.opacity=1-dissolve;m.color.copy(o.userData.baseColor).lerp(this.hitColor,.5*(1-dissolve));}});
    const burst=Math.max(0,(t-.2)/.85);this.death.visible=!reduced&&t>.2;this.death.position.set(this.body.position.x,.1,this.body.position.z);
    for(const child of this.death.children){const m=child as T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;if(m.userData.ring){m.scale.setScalar(.5+3*(1-Math.pow(1-Math.min(1,burst),3)));m.material.opacity=.65*Math.pow(Math.max(0,1-burst),2);}else{const i=m.userData.index,angle=i*2.399,r=(.6+(i%3)*.3)*burst*2.3;m.position.set(Math.cos(angle)*r,.2+Math.sin(Math.min(1,burst)*Math.PI)*(.7+i%3*.22),Math.sin(angle)*r);m.scale.setScalar((.12+i%3*.035)*Math.max(0,1-burst));m.rotation.set(burst*3,angle,burst*2);m.material.opacity=Math.max(0,1-burst);}}
    if(t>1.1){this.clear();this.id=0;this.bar.hidden=true;}return;
  }
  this.lastDefeats=game.bossesDefeated;
  if(b.id!==this.id)this.build(b);
  this.age+=dt;this.hitAge+=dt;if(b.hits!==this.hits){this.hits=b.hits;this.hitAge=0;}
  const hit=reduced?0:Math.max(0,1-this.hitAge/.6),intro=reduced?1:Math.min(1,this.age/.45);
  this.body.position.set(gridWorld(b.x),reduced?0:Math.sin(this.age*2)*.07+Math.sin(hit*Math.PI)*.35,gridWorld(b.y));
  this.body.scale.set(intro*1.25*(1+hit*.26),intro*1.25*(1-hit*.32),intro*1.25*(1+hit*.26));
  this.body.rotation.z=reduced?0:Math.sin(this.hitAge*30)*hit*.22;
  this.body.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshBasicMaterial).color.copy(o.userData.baseColor).lerp(this.hitColor,hit*.65);});
  this.bar.hidden=false;this.bar.dataset.element=b.element;
  this.bar.querySelector('strong')!.textContent=b.element==='water'?'Water Boss':'Lava Boss';
  const count=b.remaining.size;this.bar.querySelector('i')!.style.width=`${count/64*100}%`;this.bar.querySelector('.territory-track')!.setAttribute('aria-valuenow',String(count));this.bar.querySelector('small')!.textContent=`${count} tiles`;
  const a=this.project(b.cell,3.5),z=this.project(b.cell+9,3.5);this.bar.style.left=`${Math.max(70,Math.min(this.host.clientWidth-70,(a.x+z.x)/2))}px`;this.bar.style.top=`${Math.max(6,(a.y+z.y)/2-30)}px`;
  this.halo.visible=true;for(const m of this.halo.children)m.visible=b.remaining.has(m.userData.cell);

 }
 dispose(){this.clear();this.root.removeFromParent();this.notice.remove();this.bar.remove();}
}
