import * as T from 'three';
import {BOAT_CURVE,BOAT_FRAME_UPPER_RADIUS,BOAT_FRAME_LOWER_RADIUS,BOAT_FRAME_LOWER_HEIGHT,BOAT_FRAME_LOWER_Y,BOAT_FRAME_UPPER_HEIGHT,BOAT_FRAME_UPPER_Y,BOAT_FRAME_COUNTS} from './boat';
import {obsidianMaterial} from './obsidian-material';
/** Watertight ribbon follows the same fair curve as construction targets. */
export function createShipHull(){
 const positions:number[]=[],uv:number[]=[],colors:number[]=[];
 const sections=256;
 const point=(i:number,out:number,y:number)=>{const p=BOAT_CURVE.getPointAt((i%sections)/sections),n=BOAT_CURVE.getTangentAt((i%sections)/sections);return [p.x+n.z*out,y,p.z-n.x*out];};
 const quad=(a:number[],b:number[],c:number[],d:number[],shade:number,u:number)=>{for(const [p,s,t] of [[a,u,0],[b,u+.28,0],[c,u+.28,1],[a,u,0],[c,u+.28,1],[d,u,1]] as [number[],number,number][]){positions.push(...p);uv.push(s,t);colors.push(shade,shade,shade);}};
 for(let i=0;i<sections;i++){
  const a=point(i,-.31,-.08),b=point(i+1,-.31,-.08),c=point(i+1,-.04,1.32),d=point(i,-.04,1.32),e=point(i,.60,1.32),f=point(i+1,.60,1.32),g=point(i+1,.33,-.08),h=point(i,.33,-.08);
  quad(a,b,c,d,.80,i*.28);quad(d,c,f,e,1,i*.28);quad(e,f,g,h,.67,i*.28);quad(h,g,b,a,.50,i*.28);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();const material=obsidianMaterial();material.vertexColors=true;material.side=T.DoubleSide;const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
}
/** Closed, bevelled beams: every delivery has solid end caps as well as an
 * underside. Shared endpoints keep the finished frame watertight. */
export const FRAME_SECTION_VERTICES=84;
export function createHullTrim(){
 return [BOAT_FRAME_UPPER_Y,BOAT_FRAME_LOWER_Y].map((height,index)=>{
  const radius=index?BOAT_FRAME_LOWER_RADIUS:BOAT_FRAME_UPPER_RADIUS,h=(index?BOAT_FRAME_LOWER_HEIGHT:BOAT_FRAME_UPPER_HEIGHT)/2,bevel=.07;
  const profile=[[-radius+bevel,-h],[radius-bevel,-h],[radius,-h+bevel],[radius,h-bevel],[radius-bevel,h],[-radius+bevel,h],[-radius,h-bevel],[-radius,-h+bevel]];
  const positions:number[]=[],colors:number[]=[],uv:number[]=[],out=index?.34:.59,count=index?BOAT_FRAME_COUNTS.lower:BOAT_FRAME_COUNTS.upper;
  const palette=['#29243b','#40354e','#51435f','#93839e','#766384','#4d405d','#352d44','#29243b'].map(c=>new T.Color(c));
  const at=(section:number)=>{const p=BOAT_CURVE.getPointAt((section%count)/count),n=BOAT_CURVE.getTangentAt((section%count)/count);return profile.map(([x,y])=>[p.x+n.z*(out+x),height+y,p.z-n.x*(out+x)]);};
  const triangle=(a:number[],b:number[],c:number[],shade:T.Color)=>{for(const v of [a,b,c]){positions.push(...v);colors.push(shade.r,shade.g,shade.b);uv.push((v[0]+v[2])*.5,v[1]);}};
  for(let i=0;i<count;i++){const a=at(i),b=at(i+1);
   for(let k=0;k<8;k++){const j=(k+1)%8;triangle(a[k],b[k],b[j],palette[k]);triangle(a[k],b[j],a[j],palette[k]);}
   for(let k=1;k<7;k++){triangle(a[0],a[k+1],a[k],palette[2]);triangle(b[0],b[k],b[k+1],palette[2]);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;return mesh;
 });
}
