import * as T from 'three';
/** Painted, light-independent shading with fine hammered-metal grain. */
export function paintedGeometry(round=false){
 const g=(round?new T.CylinderGeometry(.5,.5,1,12):new T.BoxGeometry(1,1,1)).toNonIndexed(),n=g.attributes.normal,colors=[];
 for(let i=0;i<n.count;i++){const v=n.getY(i)>.5?1:n.getY(i)<-.5?.52:.72+n.getX(i)*.09+n.getZ(i)*.05;colors.push(v,v,v);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
let grain:T.DataTexture|undefined;
export function metalMaterial(){
 if(!grain){const data=new Uint8Array(32*32*4);for(let i=0;i<1024;i++){const v=226+((i*17+Math.floor(i/32)*23)%29);data.set([v,v,v,255],i*4);}grain=new T.DataTexture(data,32,32);grain.needsUpdate=true;grain.magFilter=T.NearestFilter;grain.colorSpace=T.SRGBColorSpace;}
 return new T.MeshBasicMaterial({map:grain,vertexColors:true});
}
/** Deck uses the obsidian facet language, softened into fitted armor plates. */
export function deckMaterial(){
 const size=96,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const fx=Math.floor(x/16),fy=Math.floor(y/16),h=(fx*19+fy*13+fx*fy*11)%17;
  let c=h<5?[45,35,62]:h<12?[50,39,68]:[58,45,77];
  if(x%16===0||y%16===0)c=c.map(v=>v*.84);
  if(y%16===15&&h>12)c=[69,55,89];
  if((x*37+y*23)%163===0)c=[76,63,98];
  if(x<2||y<2||x>93||y>93)c=[31,25,44];
  if((x===4||x===91)&&(y===4||y===91))c=[136,139,157];
  data.set([...c.map(Math.round),255],(y*size+x)*4);
 }
 const map=new T.DataTexture(data,size,size);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.NearestFilter;map.needsUpdate=true;return new T.MeshBasicMaterial({map});
}
