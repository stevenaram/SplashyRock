import * as T from 'three';
import type {Game} from './game';
import type {Boss} from './boss';
import {gridWorld} from './map';

// Unlit, deliberately small palette, like the pets and elemental surfaces.
export class BossView {
 private root=new T.Group();
 private body=new T.Group();
 private halo=new T.Group();
 private bar=document.createElement('div');
 private notice=document.createElement('div');
 private id=0;private age=0;private hitAge=10;private hits=0;private exiting=0;private noticeAge=10;

 constructor(private scene:T.Scene,private host:HTMLElement,private project:(cell:number,height:number)=>{x:number;y:number}){
  this.root.add(this.body,this.halo);scene.add(this.root);
  this.bar.className='boss-health';this.bar.hidden=true;this.bar.innerHTML='<strong></strong><div><i></i></div><small></small>';
  this.notice.className='boss-notice';this.notice.hidden=true;this.notice.setAttribute('role','status');host.append(this.bar,this.notice);
 }
 private clear(){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.body.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});this.halo.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);ms.add(o.material as T.Material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.body.clear();this.halo.clear();}
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
  const mark=new T.MeshBasicMaterial({color:water?'#a3ded7':'#ffd185',transparent:true,opacity:.48,depthWrite:false});
  const geometry=new T.RingGeometry(1.27,1.32,4);geometry.rotateZ(Math.PI/4);
  for(const c of b.pool){const m=new T.Mesh(geometry,mark);m.rotation.x=-Math.PI/2;m.position.set(gridWorld(c%8),.13,gridWorld(Math.floor(c/8)));m.userData.cell=c;this.halo.add(m);}
 }
 update(game:Game,dt:number,reduced:boolean){
  if(game.bossNotice){this.notice.textContent=game.bossNotice;game.bossNotice='';this.notice.hidden=false;this.noticeAge=0;}
  this.noticeAge+=dt;if(this.noticeAge>4.5)this.notice.hidden=true;
  const b=game.boss;
  if(!b){this.bar.hidden=true;this.halo.visible=false;if(this.id){this.exiting+=dt;this.body.scale.setScalar(Math.max(0,1.25*(1-this.exiting/.4)));this.body.position.y=-this.exiting*2;if(this.exiting>=.4){this.clear();this.id=0;}}return;}
  if(b.id!==this.id)this.build(b);
  this.age+=dt;this.hitAge+=dt;if(b.hits!==this.hits){this.hits=b.hits;this.hitAge=0;}
  const hit=reduced?0:Math.max(0,1-this.hitAge/.24),intro=reduced?1:Math.min(1,this.age/.45);
  this.body.position.set(gridWorld(b.cell%8),reduced?0:Math.sin(this.age*2)*.07,gridWorld(Math.floor(b.cell/8)));
  this.body.scale.set(intro*1.25*(1+hit*.12),intro*1.25*(1-hit*.18),intro*1.25*(1+hit*.12));
  this.body.rotation.z=reduced?0:Math.sin(this.hitAge*40)*hit*.08;
  this.halo.visible=true;for(const m of this.halo.children)m.visible=b.remaining.has(m.userData.cell);
  this.bar.hidden=false;this.bar.dataset.element=b.element;
  this.bar.querySelector('strong')!.textContent=b.element==='water'?'Water Boss':'Lava Boss';
  (this.bar.querySelector('i') as HTMLElement).style.width=`${b.hp/b.maxHp*100}%`;
  this.bar.querySelector('small')!.textContent=`${b.hp} / ${b.maxHp}`;
  const p=this.project(b.cell,3.2);this.bar.style.left=`${Math.max(72,Math.min(this.host.clientWidth-72,p.x))}px`;this.bar.style.top=`${Math.max(8,Math.min(this.host.clientHeight-52,p.y-25))}px`;
 }
 dispose(){this.clear();this.root.removeFromParent();this.bar.remove();this.notice.remove();}
}
