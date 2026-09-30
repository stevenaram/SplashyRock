import * as T from 'three';
import {BOAT_BLUEPRINT,BOAT_TOTAL_BRICKS,BOAT_WALL_BRICKS} from './boat';
import type {Game} from './game';
import {gridWorld} from './map';
import {obsidianMaterial} from './obsidian-material';
import {SHIP_PARTS} from './ship-details';

/** Shared painted geometry: the entire 2,000-ish brick hull costs two draws. */
export function paintedBrickGeometry(){
 const g=new T.BoxGeometry(1,1,1).toNonIndexed(),n=g.attributes.normal,colors=[] as number[];
 for(let i=0;i<n.count;i++){const color=new T.Color(n.getY(i)>.5?'#644a82':n.getZ(i)>.5?'#3d2b54':n.getX(i)<-.5?'#3d2b54':'#241a36');colors.push(color.r,color.g,color.b);}
 g.name='painted-obsidian-brick';g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
export function carriedBrick(){
 const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1),obsidianMaterial());mesh.scale.set(.95,.22,.43);root.add(mesh);
 const seam=new T.Mesh(new T.BoxGeometry(.55,.009,.05),new T.MeshBasicMaterial({color:'#b49ac5'}));seam.position.set(-.12,.115,-.1);root.add(seam);return root;
}
export class BoatView {
 readonly group=new T.Group();
 readonly bounds={x:8,minZ:-8,maxZ:8,height:0};
 private readonly brick=new T.InstancedMesh(new T.BoxGeometry(1,1,1),obsidianMaterial(),BOAT_TOTAL_BRICKS);
 private readonly deck=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:'#3d2b54'}),BOAT_TOTAL_BRICKS);
 private readonly glint=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:'#8870a6'}),BOAT_TOTAL_BRICKS);
 private readonly sparks=new T.InstancedMesh(new T.OctahedronGeometry(.10,0),new T.MeshBasicMaterial({color:'#bba5d2'}),96);
 private readonly soil=new T.InstancedMesh(new T.CylinderGeometry(.68,.73,.08,10),new T.MeshBasicMaterial({color:'#795b44'}),64);
 private readonly detailBatches=Array.from({length:4},(_,i)=>{const mesh=new T.InstancedMesh(i%2?new T.CylinderGeometry(.5,.5,1,8):new T.BoxGeometry(1,1,1),i<2?obsidianMaterial():new T.MeshBasicMaterial(),SHIP_PARTS.length);mesh.count=0;mesh.frustumCulled=false;return mesh;});
 private readonly apron=(()=>{const shape=new T.Shape();shape.moveTo(-8.9,8.5);shape.lineTo(-8.9,-8);shape.lineTo(-5.7,-11.7);shape.lineTo(0,-14.2);shape.lineTo(5.7,-11.7);shape.lineTo(8.9,-8);shape.lineTo(8.9,8.5);shape.lineTo(5.6,10.7);shape.lineTo(0,11.4);shape.lineTo(-5.6,10.7);shape.closePath();const hole=new T.Path();hole.moveTo(-8,-8);hole.lineTo(-8,8);hole.lineTo(8,8);hole.lineTo(8,-8);hole.closePath();shape.holes.push(hole);const mesh=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:'#241a36'}));mesh.rotation.x=Math.PI/2;mesh.position.y=-.025;mesh.material.side=T.DoubleSide;return mesh;})();
 private transform=new T.Object3D();
 private revision=-1;
 private fresh=new Map<number,number>();
 private label:HTMLDivElement;
 private lastCount=-1;
 private deckCells=new Set<number>();
 private completeAge=0;
 constructor(host:HTMLElement){
  this.group.visible=false;this.sparks.count=0;this.group.add(this.apron,...this.detailBatches);
  for(const mesh of [this.brick,this.deck,this.glint,this.soil,this.sparks]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);}
  this.label=document.createElement('div');this.label.id='boat-progress';this.label.hidden=true;
  this.label.innerHTML='<svg viewBox="0 0 28 22" aria-hidden="true"><path d="M3 12h22l-5 7H8zM14 2v10M12 3L5 10h7m4-6 6 6h-6"/></svg><div><span>Build your escape</span><strong></strong><i><b></b></i></div>';
  host.append(this.label);
 }
 private matrix(id:number,scale=1,lift=0){
  const b=BOAT_BLUEPRINT[id],t=this.transform;
  if(b.detail!==undefined)scale=0;
  if(b.deck){lift=0;scale=Math.min(1,scale);}
  t.position.set(b.x,b.y+lift,b.z);t.rotation.set(0,b.angle,0);t.scale.set(b.width*scale,b.height*scale,b.depth*scale);t.updateMatrix();(b.deck?this.deck:this.brick).setMatrixAt(id,t.matrix);
  const empty=new T.Matrix4().makeScale(0,0,0);(b.deck?this.brick:this.deck).setMatrixAt(id,empty);
  // A restrained painted bevel catches the eye without dynamic lights.
  t.position.set(b.x-Math.cos(b.angle)*b.width*.08,b.y+b.height*.505+lift,b.z+Math.sin(b.angle)*b.width*.08);t.scale.set(b.width*.64*scale,.006*scale,.025*scale);t.updateMatrix();this.glint.setMatrixAt(id,t.matrix);
 }
 update(game:Game,dt:number,reduced:boolean){
  this.group.visible=game.forges.size>0||game.boat.count>0;this.label.hidden=!this.group.visible;
  const arrivals=game.boatDeliveries.splice(0);
  if(this.revision!==game.boat.revision){
   this.revision=game.boat.revision;
   const funded=new Set<number>();for(const id of game.boat.built){const b=BOAT_BLUEPRINT[id];if(b.detail!==undefined)funded.add(b.detail);}
   this.detailBatches.forEach(m=>m.count=0);
   SHIP_PARTS.forEach((p,i)=>{if(!funded.has(i))return;const batch=this.detailBatches[(p.color?2:0)+(p.round?1:0)],t=this.transform;t.position.set(p.x,p.y,p.z);t.rotation.set(p.rx??0,p.ry??0,p.rz??0);t.scale.set(p.width,p.height,p.depth);t.updateMatrix();batch.setMatrixAt(batch.count,t.matrix);if(p.color)batch.setColorAt(batch.count,new T.Color(p.color));batch.count++;});
   this.detailBatches.forEach(m=>{m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;});this.apron.visible=funded.size>0;

   Object.assign(this.bounds,{x:8,minZ:-8,maxZ:8,height:0});
   for(const id of game.boat.built){const b=BOAT_BLUEPRINT[id],dx=Math.abs(Math.cos(b.angle))*b.width/2+Math.abs(Math.sin(b.angle))*b.depth/2,dz=Math.abs(Math.sin(b.angle))*b.width/2+Math.abs(Math.cos(b.angle))*b.depth/2;this.bounds.x=Math.max(this.bounds.x,Math.abs(b.x)+dx+.15);this.bounds.minZ=Math.min(this.bounds.minZ,b.z-dz-.15);this.bounds.maxZ=Math.max(this.bounds.maxZ,b.z+dz+.15);this.bounds.height=Math.max(this.bounds.height,b.y+b.height/2);}

   for(let i=0;i<BOAT_TOTAL_BRICKS;i++)this.matrix(i,game.boat.built.has(i)?1:0);
   this.deckCells.clear();for(const id of game.boat.built){const b=BOAT_BLUEPRINT[id];if(b.deck&&b.cell!==undefined)this.deckCells.add(b.cell);}
   if(!arrivals.length)this.fresh.clear();
   for(const id of arrivals)if(!reduced)this.fresh.set(id,0);
   this.brick.instanceMatrix.needsUpdate=this.deck.instanceMatrix.needsUpdate=this.glint.instanceMatrix.needsUpdate=true;
  }
  let sparkCount=0;
  for(const [id,age] of this.fresh){const t=Math.min(1,(age+dt)/.38);this.fresh.set(id,age+dt);this.matrix(id,1+Math.sin(t*Math.PI)*.08,(1-t)*(1-t)*.65);
   const b=BOAT_BLUEPRINT[id];for(let k=0;k<6&&sparkCount<96;k++){const a=k*Math.PI/3+id,pose=this.transform;pose.position.set(b.x+Math.cos(a)*t*.8,b.y+.3+Math.sin(t*Math.PI)*.4,b.z+Math.sin(a)*t*.6);pose.rotation.set(a,t*5,a);pose.scale.setScalar((1-t)*.9);pose.updateMatrix();this.sparks.setMatrixAt(sparkCount++,pose.matrix);}
   if(t===1)this.fresh.delete(id);this.brick.instanceMatrix.needsUpdate=this.deck.instanceMatrix.needsUpdate=this.glint.instanceMatrix.needsUpdate=true;}
  this.sparks.count=sparkCount;this.sparks.instanceMatrix.needsUpdate=true;
  for(let c=0;c<64;c++){const t=this.transform;t.rotation.set(0,0,0);t.position.set(gridWorld(c%8),.06,gridWorld(Math.floor(c/8)));t.scale.setScalar(this.deckCells.has(c)&&game.board[c]==='bush'?1:0);t.updateMatrix();this.soil.setMatrixAt(c,t.matrix);}this.soil.instanceMatrix.needsUpdate=true;
  if(this.lastCount!==game.boat.count){this.lastCount=game.boat.count;this.label.querySelector('strong')!.textContent=`${game.boat.count.toLocaleString()} / ${BOAT_TOTAL_BRICKS.toLocaleString()}`;this.label.querySelector('span')!.textContent=game.boat.complete?'Boat complete!':game.boat.count>=BOAT_WALL_BRICKS?'Laying the deck':'Build your escape';(this.label.querySelector('b') as HTMLElement).style.width=`${game.boat.count/BOAT_TOTAL_BRICKS*100}%`;this.label.classList.remove('delivered');if(arrivals.length){void this.label.offsetWidth;this.label.classList.add('delivered');}}
  this.completeAge=game.boat.complete?this.completeAge+dt:0;
  const glow=reduced?0:Math.max(0,1-this.completeAge/2)*Math.sin(this.completeAge*8);
  this.glint.material.color.set(game.boat.complete?new T.Color('#e8cf9a').multiplyScalar(1+glow*.15):'#8870a6');
 }
 dispose(){for(const mesh of [this.brick,this.deck,this.glint,this.soil,this.sparks,this.apron,...this.detailBatches]){mesh.geometry.dispose();mesh.material.dispose();}this.group.removeFromParent();this.label.remove();}
}
