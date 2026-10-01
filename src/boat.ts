import {CatmullRomCurve3,Vector3,Matrix4,Euler} from 'three';
import {SHIP_PARTS} from './ship-details';
/** Coordinates use world units; the playable grid remains independent of the hull. */
export interface BoatBrick {x:number;y:number;z:number;angle:number;width:number;depth:number;height:number;deck:boolean;cell?:number;detail?:number}
const outline=[[-8.5,8.5],[-8.5,-7.8],[-5.7,-11.4],[0,-14.2],[5.7,-11.4],[8.5,-7.8],[8.5,8.5],[5.6,10.5],[0,11.3],[-5.6,10.5]];
export const BOAT_CURVE=new CatmullRomCurve3(outline.map(([x,z])=>new Vector3(x,0,z)),true,'catmullrom',.22);
function hullRing(out:number,y:number,stagger:boolean){
 const points=Array.from({length:512},(_,i)=>{const t=i/512,p=BOAT_CURVE.getPointAt(t),n=BOAT_CURVE.getTangentAt(t);return {x:p.x+n.z*out,z:p.z-n.x*out};});
 const lengths=points.map((p,i)=>Math.hypot(points[(i+1)%points.length].x-p.x,points[(i+1)%points.length].z-p.z)),perimeter=lengths.reduce((a,b)=>a+b,0),count=Math.ceil(perimeter/1.96),step=perimeter/count;
 const at=(distance:number)=>{let d=(distance+perimeter)%perimeter;for(let i=0;i<points.length;i++){if(d<=lengths[i]){const p=points[i],q=points[(i+1)%points.length],t=d/lengths[i];return {x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};}d-=lengths[i];}return points[0];};
 return Array.from({length:count},(_,i):BoatBrick=>{const offset=(i+(stagger?.5:0))*step,a=at(offset-step*.5),b=at(offset+step*.5);return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,y,angle:-Math.atan2(b.z-a.z,b.x-a.x),width:Math.hypot(b.x-a.x,b.z-a.z)-.025,depth:.64,height:.30,deck:false};});
}
function blueprint(){
 const result:BoatBrick[]=[];
 // One brick across; deliveries beyond the masonry assemble ship fittings.
 for(let course=0;course<4;course++)result.push(...hullRing(course*.09,.16+course/3,course%2===1));
 // Match each delivery to the exact ribbon section that it reveals.
 const hullCount=result.length;
 for(let id=0;id<hullCount;id++){const start=Math.floor(id/hullCount*256),end=Math.floor((id+1)/hullCount*256),t=(start+end)/512,p=BOAT_CURVE.getPointAt(t),n=BOAT_CURVE.getTangentAt(t);Object.assign(result[id],{x:p.x+n.z*.28,z:p.z-n.x*.28,y:1.17,angle:-Math.atan2(n.z,n.x)});}
 const work=1985-64-result.length;
 for(let i=0;i<work;i++){const detail=Math.floor(i*SHIP_PARTS.length/work),p=SHIP_PARTS[detail];result.push({x:p.x,y:p.y,z:p.z,angle:0,width:p.width,height:p.height,depth:p.depth,deck:false,detail});}
 const deck:BoatBrick[]=[];
 for(let row=0;row<8;row++)for(let col=0;col<8;col++)deck.push({x:-7+col*2,z:-7+row*2,y:-.17,angle:0,width:2,depth:2,height:.30,deck:true,cell:row*8+col});
 result.push(...deck);return result;
}
export const BOAT_BLUEPRINT:readonly BoatBrick[]=blueprint();
export const BOAT_HULL_BRICKS=BOAT_BLUEPRINT.findIndex(b=>b.detail!==undefined);
export const BOAT_WALL_BRICKS=BOAT_BLUEPRINT.findIndex(b=>b.deck);
export const BOAT_TOTAL_BRICKS=BOAT_BLUEPRINT.length;
export function hullDeliverySections(id:number){return {start:Math.floor(id/BOAT_HULL_BRICKS*256),end:Math.floor((id+1)/BOAT_HULL_BRICKS*256)};}
export function boatDeliveryTarget(id:number){
 const b=BOAT_BLUEPRINT[id];let height=b.deck?0:b.y+b.height/2;
 if(b.detail!==undefined){const p=SHIP_PARTS[b.detail],m=new Matrix4().makeRotationFromEuler(new Euler(p.rx??0,p.ry??0,p.rz??0)).elements;// Intersect a vertical line through the part center with its oriented box.
  // Unlike its overall bounding-box top, this point stays on slanted beams.
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
