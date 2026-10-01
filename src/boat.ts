import {CatmullRomCurve3,Vector3,Matrix4,Euler,Shape,Path,ShapeGeometry} from 'three';
import {SHIP_PARTS,type ShipPart} from './ship-details';
/** Coordinates use world units; the playable grid remains independent of the hull. */
export interface BoatBrick {x:number;y:number;z:number;angle:number;width:number;depth:number;height:number;deck:boolean;cell?:number;detail?:number;part?:ShipPart;frame?:'lower'|'rib'|'upper';section?:number;apron?:number}
const outline=[[-8.5,8.5],[-8.5,-7.8],[-5.7,-11.4],[0,-14.2],[5.7,-11.4],[8.5,-7.8],[8.5,8.5],[5.6,10.5],[0,11.3],[-5.6,10.5]];
export const BOAT_CURVE=new CatmullRomCurve3(outline.map(([x,z])=>new Vector3(x,0,z)),true,'catmullrom',.22);
// Construction jobs own exactly the geometry they reveal. No repeated funding
// jobs and no whole-ship surfaces hidden behind a milestone visibility switch.
export const BOAT_FRAME_BRICKS=144;
export const BOAT_FRAME_UPPER_RADIUS=.15;
export const BOAT_FRAME_LOWER_RADIUS=.20;
export const BOAT_FRAME_POST_WIDTH=.30;
const SHELL_JOBS=154;
export const BOAT_HULL_BRICKS=BOAT_FRAME_BRICKS+SHELL_JOBS;
export const APRON_TRIANGLES=(()=>{
 const shape=new Shape();shape.moveTo(-8.9,8.5);for(const [x,z] of [[-8.9,-8],[-5.7,-11.7],[0,-14.2],[5.7,-11.7],[8.9,-8],[8.9,8.5],[5.6,10.7],[0,11.4],[-5.6,10.7]])shape.lineTo(x,z);shape.closePath();
 const hole=new Path();hole.moveTo(-8,-8);hole.lineTo(-8,8);hole.lineTo(8,8);hole.lineTo(8,-8);hole.closePath();shape.holes.push(hole);
 const source=new ShapeGeometry(shape),g=source.toNonIndexed(),p=g.attributes.position;
 const triangles:Vector3[][]=[];for(let i=0;i<p.count;i+=3)triangles.push([0,1,2].map(k=>new Vector3(p.getX(i+k),-.025,p.getY(i+k))));source.dispose();g.dispose();
 const area=(t:Vector3[])=>new Vector3().subVectors(t[1],t[0]).cross(new Vector3().subVectors(t[2],t[0])).length();
 while(triangles.length<128){let best=0;for(let i=1;i<triangles.length;i++)if(area(triangles[i])>area(triangles[best]))best=i;
  const t=triangles[best];let edge=0;for(let i=1;i<3;i++)if(t[i].distanceToSquared(t[(i+1)%3])>t[edge].distanceToSquared(t[(edge+1)%3]))edge=i;
  const a=t[edge],b=t[(edge+1)%3],c=t[(edge+2)%3],m=a.clone().lerp(b,.5);triangles.splice(best,1,[a,m,c],[m,b,c]);
 }
 return triangles.sort((a,b)=>Math.atan2(a[0].z,a[0].x)-Math.atan2(b[0].z,b[0].x));
})();
function detailChunks(count:number){
 const chunks=SHIP_PARTS.map((p,detail)=>({part:{...p},detail}));
 const weight=(p:ShipPart)=>{const dims=[p.width,p.height,p.depth].sort((a,b)=>b-a);return p.round?p.height*Math.max(p.width,p.depth):dims[0]*dims[1];};
 while(chunks.length<count){
  let best=0;for(let i=1;i<chunks.length;i++)if(weight(chunks[i].part)>weight(chunks[best].part))best=i;
  const {part:p,detail}=chunks[best],dims=[p.width,p.height,p.depth],axis=p.round?1:dims.indexOf(Math.max(...dims)),key=(['width','height','depth'] as const)[axis];
  const rotation=new Euler(p.rx??0,p.ry??0,p.rz??0),offset=new Vector3().setComponent(axis,dims[axis]/4).applyEuler(rotation);
  const halves=[-1,1].map(sign=>({detail,part:{...p,[key]:dims[axis]/2,x:p.x+offset.x*sign,y:p.y+offset.y*sign,z:p.z+offset.z*sign}}));
  chunks.splice(best,1,...halves);
 }
 // Authored assembly order, with each large part built bottom-up in small pieces.
 return chunks.sort((a,b)=>a.detail-b.detail||a.part.y-b.part.y||a.part.z-b.part.z||a.part.x-b.part.x);
}
function blueprint(){
 const result:BoatBrick[]=[];
 for(const frame of ['lower','rib','upper'] as const)for(let i=0;i<48;i++){
  const start=Math.floor(i/48*256),end=Math.floor((i+1)/48*256),t=(start+end)/512,p=BOAT_CURVE.getPointAt(t),n=BOAT_CURVE.getTangentAt(t),out=frame==='upper'?.59:.34;
  result.push({x:p.x+n.z*out,z:p.z-n.x*out,y:frame==='lower'?.18:frame==='upper'?1.35:.76,angle:-Math.atan2(n.z,n.x),width:frame==='rib'?BOAT_FRAME_POST_WIDTH:1.6,height:frame==='rib'?1.16:2*(frame==='upper'?BOAT_FRAME_UPPER_RADIUS:BOAT_FRAME_LOWER_RADIUS),depth:frame==='rib'?BOAT_FRAME_POST_WIDTH:2*(frame==='upper'?BOAT_FRAME_UPPER_RADIUS:BOAT_FRAME_LOWER_RADIUS),deck:false,frame,section:i});
 }
 for(let i=0;i<SHELL_JOBS;i++){const start=Math.floor(i/SHELL_JOBS*256),end=Math.floor((i+1)/SHELL_JOBS*256),t=(start+end)/512,p=BOAT_CURVE.getPointAt(t),n=BOAT_CURVE.getTangentAt(t);result.push({x:p.x+n.z*.28,z:p.z-n.x*.28,y:1.17,angle:-Math.atan2(n.z,n.x),width:(end-start)*.30,depth:.64,height:.30,deck:false});}
 APRON_TRIANGLES.forEach((t,apron)=>{const p=t[0].clone().add(t[1]).add(t[2]).divideScalar(3);result.push({x:p.x,y:p.y,z:p.z,angle:0,width:0,depth:0,height:0,deck:false,apron});});
 for(const {part:p,detail} of detailChunks(1985-64-result.length))result.push({x:p.x,y:p.y,z:p.z,angle:0,width:p.width,height:p.height,depth:p.depth,deck:false,detail,part:p});
 for(let row=0;row<8;row++)for(let col=0;col<8;col++)result.push({x:-7+col*2,z:-7+row*2,y:-.17,angle:0,width:2,depth:2,height:.30,deck:true,cell:row*8+col});
 return result;
}
export const BOAT_BLUEPRINT:readonly BoatBrick[]=blueprint();
export const BOAT_WALL_BRICKS=BOAT_BLUEPRINT.findIndex(b=>b.deck);
export const BOAT_TOTAL_BRICKS=BOAT_BLUEPRINT.length;
export function hullDeliverySections(id:number){const b=BOAT_BLUEPRINT[id],i=b.frame?b.section!:id-BOAT_FRAME_BRICKS,count=b.frame?48:SHELL_JOBS;return {start:Math.floor(i/count*256),end:Math.floor((i+1)/count*256)};}
export function boatDeliveryTarget(id:number){
 const b=BOAT_BLUEPRINT[id];let height=b.deck?0:b.y+b.height/2;
 if(b.part){const p=b.part,m=new Matrix4().makeRotationFromEuler(new Euler(p.rx??0,p.ry??0,p.rz??0)).elements;
  const rise=Math.min(...[p.width,p.height,p.depth].map((size,i)=>Math.abs(m[1+i*4])<1e-8?Infinity:size/(2*Math.abs(m[1+i*4]))));height=p.y+rise;}
 return {x:b.x/2+3.5,y:b.z/2+3.5,height:Math.max(0,height)};
}
export class BoatProgress {
 readonly built=new Set<number>();
 private reserved=new Set<number>();
 revision=0;
 get count(){return this.built.size;}
 get complete(){return this.count===BOAT_TOTAL_BRICKS;}
 reserve(){for(let i=0;i<BOAT_TOTAL_BRICKS;i++)if(!this.built.has(i)&&!this.reserved.has(i)){this.reserved.add(i);return i;}return null;}
 release(id:number){this.reserved.delete(id);}
 deliver(id:number){if(!this.reserved.delete(id)||this.built.has(id))return false;this.built.add(id);this.revision++;return true;}
 setProgress(count:number){this.built.clear();this.reserved.clear();for(let i=0;i<Math.max(0,Math.min(BOAT_TOTAL_BRICKS,Math.floor(count)));i++)this.built.add(i);this.revision++;}
 reset(){this.setProgress(0);}
}
