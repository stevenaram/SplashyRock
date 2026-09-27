import * as T from 'three';

// The same textured 3D shell is used in the tray and in the hatch sequence.
export function createEgg(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=32;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff2ca';ctx.fillRect(0,0,64,32);
 ctx.fillStyle='#bca471';ctx.fillRect(0,25,64,7);ctx.fillStyle='#e4cc98';ctx.fillRect(0,22,64,3);
 for(const [cx,cy,rx,ry] of [[9,16,5,6],[27,9,3,3],[48,13,5,6],[38,7,3,3],[52,25,5,5],[23,27,4,4]]){
  for(let y=-ry;y<=ry;y++)for(let x=-rx;x<=rx;x++)if(x*x/(rx*rx)+y*y/(ry*ry)<1){ctx.fillStyle=y<0?'#a3b573':'#70955d';ctx.fillRect((cx+x+64)%64,cy+y,1,1);}
 }
 ctx.fillStyle='#fffbea';ctx.fillRect(42,2,9,3);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;
 const group=new T.Group(),parts:T.Mesh[]=[];
 for(let half=0;half<2;half++){
  const geo=new T.SphereGeometry(1,20,10,0,Math.PI*2,half?Math.PI/2:0,Math.PI/2);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i),angle=Math.atan2(pos.getZ(i),pos.getX(i));const seam=Math.abs(y)<.001?Math.sin(angle*10)*.045:0;pos.setXYZ(i,pos.getX(i)*.55*(1-y*.17),(y+seam)*.70,pos.getZ(i)*.55*(1-y*.17));}
  geo.computeVertexNormals();
  // Sphere halves need the UVs of one complete egg, not two repeated textures.
  const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,uv.getY(i)*.5+(half?0:.5));
  const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true});
  const mesh=new T.Mesh(geo,material);mesh.position.y=.70;group.add(mesh);parts.push(mesh);
 }
 const chips:T.Mesh[]=[];
 for(let i=0;i<4;i++){const chip=new T.Mesh(new T.TetrahedronGeometry(.075,0),new T.MeshBasicMaterial({color:i%2?'#fff2ca':'#abd38b',transparent:true}));chip.visible=false;group.add(chip);chips.push(chip);}
 return{group,parts,chips,texture};
}
let icon:string|undefined;
export function eggIcon(){
 if(icon)return icon;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setSize(128,128);renderer.setPixelRatio(1);
 const scene=new T.Scene(),egg=createEgg();scene.add(egg.group);
 const camera=new T.PerspectiveCamera(32,1,.1,20);camera.position.set(0,1.35,-3.3);camera.lookAt(0,.7,0);
 renderer.render(scene,camera);icon=renderer.domElement.toDataURL();[...egg.parts,...egg.chips].forEach(p=>{p.geometry.dispose();(p.material as T.Material).dispose();});egg.texture.dispose();renderer.dispose();renderer.forceContextLoss();return icon;
}
