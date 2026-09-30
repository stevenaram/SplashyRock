import * as T from 'three';
// The volcanic-glass palette used by the cooled lava surface, with chunky
// facets, dark seams and occasional violet glints. No scene lights involved.
let texture:T.DataTexture|undefined;
export function obsidianTexture(){
 if(texture)return texture;
 const size=48,data=new Uint8Array(size*size*4),palette=[[19,14,31],[36,26,54],[61,43,84],[100,74,130]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const fx=Math.floor(x/24),fy=Math.floor(y/24),seed=(fx*17+fy*31+fx*fy*7)%23;
  const color=[...palette[seed<7?0:seed<16?1:2]];
  if(x%24===0||y%24===0)for(let c=0;c<3;c++)color[c]*=.65;
  else if(y%24===23&&seed>15)color.splice(0,3,...palette[3]);
  if((x*31+y*17)%71===0)for(let c=0;c<3;c++)color[c]+=[15,10,20][c];
  const i=(y*size+x)*4;data.set([...color.map(Math.round),255],i);
 }
 texture=new T.DataTexture(data,size,size);texture.name='volcanic-glass';texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.magFilter=texture.minFilter=T.NearestFilter;texture.needsUpdate=true;return texture;
}
export function obsidianMaterial(){return new T.MeshBasicMaterial({map:obsidianTexture()});}
