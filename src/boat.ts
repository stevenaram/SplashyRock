import {CatmullRomCurve3,Vector3} from 'three';
/** Coordinates use world units; the playable grid remains independent of the hull. */
export interface BoatBrick {x:number;y:number;z:number;angle:number;width:number;depth:number;height:number;deck:boolean;cell?:number}
const outline=[[-8.5,8.5],[-8.5,-7.8],[-5.7,-11.4],[0,-14.2],[5.7,-11.4],[8.5,-7.8],[8.5,8.5],[5.6,10.5],[0,11.3],[-5.6,10.5]];
function inside(x:number,z:number){let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const curve=new CatmullRomCurve3(outline.map(([x,z])=>new Vector3(x,0,z)),true,'catmullrom',.22);
function hullRing(out:number,y:number,stagger:boolean){
 const points=Array.from({length:512},(_,i)=>{const t=i/512,p=curve.getPointAt(t),n=curve.getTangentAt(t);return {x:p.x+n.z*out,z:p.z-n.x*out};});
 const lengths=points.map((p,i)=>Math.hypot(points[(i+1)%points.length].x-p.x,points[(i+1)%points.length].z-p.z)),perimeter=lengths.reduce((a,b)=>a+b,0),count=Math.ceil(perimeter/1.96),step=perimeter/count;
 const at=(distance:number)=>{let d=(distance+perimeter)%perimeter;for(let i=0;i<points.length;i++){if(d<=lengths[i]){const p=points[i],q=points[(i+1)%points.length],t=d/lengths[i];return {x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t};}d-=lengths[i];}return points[0];};
 return Array.from({length:count},(_,i):BoatBrick=>{const offset=(i+(stagger?.5:0))*step,a=at(offset-step*.5),b=at(offset+step*.5);return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,y,angle:-Math.atan2(b.z-a.z,b.x-a.x),width:Math.hypot(b.x-a.x,b.z-a.z)-.025,depth:.64,height:.30,deck:false};});
}
function blueprint(){
 const result:BoatBrick[]=[];
 // The staggered, rounded courses widen outward as they rise. Each offset
 // ring is sampled by its own length so the bow has no cracks or overlap fans.
 for(let course=0;course<8;course++)for(let lane=0;lane<5;lane++)result.push(...hullRing(lane*.64+Math.pow(course/7,1.5)*.85,.21+course/3,course%2===1));
 // Lay the bow/stern first, then cover the playable sand from back to front.
 const deck:BoatBrick[]=[];
 for(let row=0;row<39;row++){const z=-14+(row+.5)*2/3;for(let col=0;col<8;col++){const x=-7+col*2;if(!inside(x-.88,z)||!inside(x+.88,z))continue;const cell=z>=-8&&z<8?Math.floor((z+8)/2)*8+col:undefined;deck.push({x,z,y:-.112,angle:0,width:1.96,depth:.62,height:.30,deck:true,cell});}}
 deck.sort((a,b)=>(a.cell===undefined?0:1)-(b.cell===undefined?0:1)||a.z-b.z||a.x-b.x);
 result.push(...deck);return result;
}
export const BOAT_BLUEPRINT:readonly BoatBrick[]=blueprint();
export const BOAT_WALL_BRICKS=BOAT_BLUEPRINT.findIndex(b=>b.deck);
export const BOAT_TOTAL_BRICKS=BOAT_BLUEPRINT.length;
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
