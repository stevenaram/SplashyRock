import * as T from 'three';

// The same textured 3D shell is used in the tray and in the hatch sequence.
export function createEgg(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f5edbf';ctx.fillRect(0,0,64,32);
 // Deliberately painted bands and single-color spots: no real-time shading.
 ctx.fillStyle='#c6b681';ctx.fillRect(0,27,64,5);
 ctx.fillStyle='#e0d29b';ctx.fillRect(0,24,64,3);
 for(const [cx,cy,rx,ry] of [[8,18,4,4],[24,9,3,3],[42,21,4,4],[53,16,2,3],[47,8,3,3],[61,27,3,3]]){
  ctx.fillStyle='#92a66b';
  for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++)if(x*x/(rx*rx)+y*y/(ry*ry)<1)ctx.fillRect((cx+x+64)%64,cy+y,1,1);
 }
 ctx.fillStyle='#fff7d8';ctx.fillRect(0,0,64,3);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;
 const group=new T.Group(),parts:T.Mesh[]=[];
 for(let half=0;half<2;half++){
  const geo=new T.SphereGeometry(1,20,10,0,Math.PI*2,half?Math.PI/2:0,Math.PI/2);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i),angle=Math.atan2(pos.getZ(i),pos.getX(i));const seam=Math.abs(y)<.001?Math.sin(angle*10)*.045:0;pos.setXYZ(i,pos.getX(i)*.55*(1-y*.25),(y+seam)*.70,pos.getZ(i)*.55*(1-y*.25));}
  geo.computeVertexNormals();
  // Sphere halves need the UVs of one complete egg, not two repeated textures.
  const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*.5+(half?0:.5));
  const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true});
  const mesh=new T.Mesh(geo,material);mesh.position.y=.70;group.add(mesh);parts.push(mesh);
 }
 const chips:T.Mesh[]=[];
 for(let i=0;i<4;i++){const chip=new T.Mesh(new T.TetrahedronGeometry(.075,0),new T.MeshBasicMaterial({color:i%2?'#f5edbf':'#92a66b',transparent:true}));chip.visible=false;group.add(chip);chips.push(chip);}
 return{group,parts,chips,texture};
}
let icon:string|undefined;
export function eggIcon(){
 if(icon)return icon;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setSize(48,48);renderer.setPixelRatio(1);
 const scene=new T.Scene(),egg=createEgg();scene.add(egg.group);
 const camera=new T.PerspectiveCamera(32,1,.1,20);camera.position.set(0,.95,-3.3);camera.lookAt(0,.7,0);
 renderer.render(scene,camera);icon=renderer.domElement.toDataURL();[...egg.parts,...egg.chips].forEach(p=>{p.geometry.dispose();(p.material as T.Material).dispose();});egg.texture.dispose();renderer.dispose();renderer.forceContextLoss();return icon;
}
