import {gridWorld} from './map';
import * as T from 'three';

export const PIXELS_PER_UNIT = 32;
function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
function pixelTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!; draw(ctx);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  return texture;
}
export function sandTexture(units = 16) {
  const size = Math.round(units * PIXELS_PER_UNIT);
  return pixelTexture(size, ctx => {
    const rng = random(87); ctx.fillStyle = '#e6c88d'; ctx.fillRect(0, 0, size, size);
    // Restrained color steps keep the grain readable at exactly 32 texels/unit.
    const colors = ['#e0c18b','#e2c58f','#e5c994','#e7cc98','#e3c690'];
    for (let y=0; y<size; y++) for(let x=0;x<size;x++) {
      const wave=Math.sin(x*.037+Math.sin(y*.024)*2)*.5+.5;
      ctx.fillStyle=colors[Math.min(4,Math.floor(wave*3+(rng()>.85?1:0)))];ctx.fillRect(x,y,1,1);
    }
    for(let i=0;i<size*.8;i++) {
      const x=Math.floor(rng()*size),y=Math.floor(rng()*size);
      ctx.fillStyle=i%3 ? '#ead29f' : '#d3b67f';ctx.fillRect(x,y,1+Math.floor(rng()*3),1);
    }
  });
}
const coast = (angle: number) => {
  const c=Math.cos(angle),s=Math.sin(angle);
  const radius=9.25/Math.max(Math.abs(c),Math.abs(s));
  const wobble=.20*Math.sin(angle*13)+.13*Math.cos(angle*19)+.16*Math.sin(angle*7);
  return new T.Vector2(c*(radius+wobble),s*(radius+wobble));
};
function shoreBand(inner: number, outer: number, yi: number, yo: number, color: string, alternate: string) {
  const positions:number[]=[],colors:number[]=[], rng=random(27);
  for(let i=0;i<96;i++) {
    const a=coast(i/96*Math.PI*2),b=coast((i+1)/96*Math.PI*2);
    const verts=[[a.x*inner,yi,a.y*inner],[b.x*inner,yi,b.y*inner],[a.x*outer,yo,a.y*outer],[b.x*inner,yi,b.y*inner],[b.x*outer,yo,b.y*outer],[a.x*outer,yo,a.y*outer]];
    const tint=new T.Color(rng()>.55?color:alternate);
    verts.forEach(v=>{positions.push(...v);colors.push(tint.r,tint.g,tint.b);});
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  return new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));
}
export function rock(color = '#ac9c80', seed = 1) {
  const rng=random(seed),geo=new T.IcosahedronGeometry(1,0);
  const p=geo.getAttribute('position');
  for(let i=0;i<p.count;i++) { const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*(.85+rng()*.12),Math.max(-.48,y)*.8,z*(.8+rng()*.15)); }
  geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color,flatShading:true,roughness:1}));mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function stoneCluster(cell:number){
  const group=new T.Group();group.position.set(gridWorld(cell%8),.07,gridWorld(Math.floor(cell/8)));
  for(const [x,z,size] of [[-.25,.1,.64],[.40,.25,.35],[.1,-.4,.36]]){
    const boulder=rock('#bca471',cell+Math.round(size*100));boulder.scale.set(size,size*.85,size);boulder.position.set(x,size*.35,z);group.add(boulder);
  }
  return group;
}
// A collapsed bush silhouette: split charcoal stems and small glowing embers.
export function charredBush(cell:number){
 const group=new T.Group();group.position.set(gridWorld(cell%8),.07,gridWorld(Math.floor(cell/8)));
 const coal=new T.MeshBasicMaterial({color:'#393831'}),ash=new T.MeshBasicMaterial({color:'#696354'});
 const ember=new T.MeshBasicMaterial({color:'#e87832'}),hot=new T.MeshBasicMaterial({color:'#ffc86b'});
 const embers:T.Mesh[]=[];
 for(let i=0;i<11;i++){
  const a=i*2.399+cell,r=.12+(i%4)*.12;
  const branch=new T.Mesh(new T.BoxGeometry(.09+(i%2)*.04,.1,.3+(i%3)*.1),i%3?coal:ash);
  branch.position.set(Math.cos(a)*r,.08+(i%3)*.06,Math.sin(a)*r);branch.rotation.set((i%3-1)*.3,a,.14);group.add(branch);
  const glow=new T.Mesh(new T.BoxGeometry(.055,.045,.08),i%3?ember:hot);
  glow.position.copy(branch.position);glow.position.y+=.065;glow.rotation.y=a;group.add(glow);embers.push(glow);
 }
 group.userData.animate=(time:number)=>embers.forEach((e,i)=>e.scale.setScalar(.8+.2*Math.sin(time*8+i*2.399)));
 return group;
}
function palm(x:number,z:number,scale:number,rotation:number) {
  const palm=new T.Group();palm.position.set(x,-.13,z);palm.scale.setScalar(scale);palm.rotation.y=rotation;
  const bark=new T.MeshStandardMaterial({color:'#927047',flatShading:true});
  for(let i=0;i<6;i++) {
    const trunk=new T.Mesh(new T.CylinderGeometry(.12-i*.009,.15-i*.009,.42,6),bark);
    trunk.position.set(i*i*.012,i*.36+.2,0);trunk.rotation.z=-i*.045;trunk.castShadow=true;palm.add(trunk);
  }
  for(let i=0;i<7;i++) {
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.55,.26,-.27,.55,.37,0,0,0,0,.55,.37,0,.55,.26,.27,.55,.26,-.27,1.25,.05,-.19,.55,.37,0,.55,.37,0,1.25,.05,-.19,1.65,-.38,0,.55,.37,0,1.65,-.38,0,1.25,.05,.19,.55,.37,0,1.25,.05,.19,.55,.26,.27],3));geometry.computeVertexNormals();
    const leaf=new T.Mesh(geometry,new T.MeshStandardMaterial({color:i%2?'#3e9b70':'#6bba7c',flatShading:true,side:T.DoubleSide}));leaf.position.set(.32,2.2,0);leaf.rotation.y=i*Math.PI*2/7;leaf.castShadow=true;palm.add(leaf);
  }
  return palm;
}
export function createIsland() {
  const group=new T.Group();group.name='island-scenery';
  const oceanMaterial=new T.ShaderMaterial({
    uniforms:{time:{value:0},voyage:{value:0}},
    vertexShader:'varying vec2 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:`precision highp float;varying vec2 world;uniform float time;uniform float voyage;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec2 p=floor((world-vec2(0.,voyage))*32.)/32.;
      float wave=sin(p.x*.9+p.y*1.4+time*.3)+sin(p.y*2.2-p.x*.4-time*.25);
      vec3 c=wave>1.25?vec3(.18,.60,.75):vec3(.14,.54,.70);
      float ripple=sin(p.y*10.+sin(p.x*2.+time*.3)*1.4-time*.65);
      if(ripple>.975&&hash(vec2(floor(p.x*2.),floor(p.y*4.)))>.72)c=vec3(.23,.59,.72);
      vec2 q=mod(p+vec2(time*.025,0.),2.);float spark=step(q.y,.03125)*step(q.x,.25);
      if(spark>.5&&hash(floor(p/2.))>.87)c=vec3(.58,.83,.83);
      gl_FragColor=vec4(pow(c,vec3(2.2)),1.);
      #include <colorspace_fragment>
    }`,
  });
  const ocean=new T.Mesh(new T.PlaneGeometry(128,128),oceanMaterial);ocean.rotation.x=-Math.PI/2;ocean.position.y=-.8;group.add(ocean);
  group.userData.animate=(time:number)=>{oceanMaterial.uniforms.time.value=time;};
  // Shallow water, then wet sand, then the dry beach; irregular polygonal shores.
  group.add(shoreBand(1.07,1.34,-.70,-.77,'#35a9bc','#36aebf'));
  group.add(shoreBand(1.015,1.14,-.49,-.69,'#77c5bc','#82cac0'));
  const surf=shoreBand(.995,1.025,-.40,-.47,'#d9eee0','#bce4d5');group.add(surf);
  group.userData.animate=(time:number)=>{
    oceanMaterial.uniforms.time.value=time;
    const pulse=1+Math.round(Math.sin(time*.75)*3)/1000;surf.scale.set(pulse,1,pulse);
  };
  group.add(shoreBand(.965,1.0,-.18,-.39,'#d8c18c','#c9b885'));
  group.add(shoreBand(.90,.967,-.08,-.17,'#ead099','#e4c58c'));
  // Pixel-sized foam flecks break up the shoreline without covering the grid.
  const foamMaterial = new T.MeshBasicMaterial({color:'#e1f4dc',transparent:true,opacity:.85});
  for(let i=0;i<72;i++) {
    if(i%5===0)continue;
    const angle=i/72*Math.PI*2,p=coast(angle).multiplyScalar(1.018);
    const foam=new T.Mesh(new T.PlaneGeometry(.12+(i%4)*.065,.04),foamMaterial);
    foam.rotation.set(-Math.PI/2,0,-angle+Math.PI/2);foam.position.set(p.x,-.405,p.y);group.add(foam);
  }
  group.userData.shipShore=group.children.slice(1);
  const sand=new T.Mesh(new T.PlaneGeometry(17.6,17.6),new T.MeshStandardMaterial({map:sandTexture(17.6),roughness:1}));sand.rotation.x=-Math.PI/2;sand.position.y=-.09;sand.receiveShadow=true;group.add(sand);
  const sceneryStart=group.children.length;
  group.add(palm(-6.7,-9.1,.94,.3),palm(-8.6,-8.7,.65,-.7));
  const rng=random(552);
  for(const [x,z,s] of [[7.1,-9.05,.65],[7.9,-9,.4],[6.7,-9.5,.3],[-9.3,5,.35],[9.1,4.1,.4],[-5.8,9.2,.28]]) {
    const boulder=rock('#a6a999',Math.floor(rng()*1000));boulder.scale.set(s,s*.7,s);boulder.position.set(x,s*.25-.12,z);boulder.rotation.y=rng()*6;group.add(boulder);
  }
  // Beach details stay entirely outside the playable footprint.
  for(let i=0;i<65;i++) {
    const edge=coast(rng()*Math.PI*2).multiplyScalar(.92+rng()*.055);
    if(Math.abs(edge.x)<8.2&&Math.abs(edge.y)<8.2)continue;
    const shell=new T.Mesh(new T.BoxGeometry(.07+rng()*.12,.035,.06+rng()*.12),new T.MeshStandardMaterial({color:i%3?'#fff0c6':'#c4a774'}));shell.position.set(edge.x,-.045,edge.y);shell.rotation.y=rng()*6;group.add(shell);
  }
  group.userData.shipScenery=group.children.slice(sceneryStart);
  const land=group.children.filter(o=>o!==ocean).map(object=>({object,z:object.position.z}));
  group.userData.sail=(age:number)=>{const distance=age===0?0:1.5*(age-2*(1-Math.exp(-age/2)));oceanMaterial.uniforms.voyage.value=distance;for(const {object,z} of land)object.position.z=z+distance;};
  return group;
}
