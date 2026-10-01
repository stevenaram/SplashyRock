import * as T from 'three';
import {BOAT_CURVE,BOAT_FRAME_UPPER_RADIUS,BOAT_FRAME_LOWER_RADIUS,BOAT_FRAME_LOWER_HEIGHT,BOAT_FRAME_LOWER_Y,BOAT_FRAME_UPPER_HEIGHT} from './boat';
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
/** Continuous rolled-steel gunwales bind the curved armor into one silhouette. */
export function createHullTrim(){
 return [1.35,BOAT_FRAME_LOWER_Y].map((height,index)=>{
  const points=Array.from({length:256},(_,i)=>{const p=BOAT_CURVE.getPointAt(i/256),n=BOAT_CURVE.getTangentAt(i/256),out=index?.34:.59;return new T.Vector3(p.x+n.z*out,height,p.z-n.x*out);});
  const path=new T.CatmullRomCurve3(points,true),geometry=new T.TubeGeometry(path,256,index?BOAT_FRAME_LOWER_RADIUS:BOAT_FRAME_UPPER_RADIUS,5,true);
  // Taller elliptical beams retain the narrow horizontal footprint of the frame.
  const radius=index?BOAT_FRAME_LOWER_RADIUS:BOAT_FRAME_UPPER_RADIUS,beamHeight=index?BOAT_FRAME_LOWER_HEIGHT:BOAT_FRAME_UPPER_HEIGHT;
  geometry.translate(0,-height,0);geometry.scale(1,beamHeight/(radius*2),1);geometry.translate(0,height,0);
  return new T.Mesh(geometry,new T.MeshBasicMaterial({color:index?'#493c60':'#8c859d'}));
 });
}
