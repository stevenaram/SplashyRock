import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Game} from './game';
import {gridWorld} from './map';
import {disposeGroup} from './tiles';

// Collapse static painted parts into one draw call; moving parts remain independent.
function batchPainted(parent:T.Group,exclude:readonly T.Mesh[]=[]){
 const meshes=parent.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&!exclude.includes(o)&&!(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent));
 if(!meshes.length)return;
 const geometries=meshes.map(mesh=>{mesh.updateMatrix();const g=mesh.geometry.toNonIndexed(),colors=new Float32Array(g.attributes.position.count*3),materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const part of g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}]){const color=((materials[part.materialIndex??0]??materials[0]) as T.MeshBasicMaterial).color;for(let i=part.start;i<part.start+part.count;i++){colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}}
  g.setAttribute('color',new T.BufferAttribute(colors,3));g.clearGroups();g.applyMatrix4(mesh.matrix);mesh.removeFromParent();mesh.geometry.dispose();return g;});
 const merged=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());parent.add(new T.Mesh(merged,new T.MeshBasicMaterial({vertexColors:true})));
}
// Painted faces, rather than scene lighting, keep the machine in the island palette.
export function createForge(){
 const group=new T.Group(),pistons:T.Mesh[]=[],gears:T.Group[]=[],bricks:T.Group[]=[];
 const palette=(top:string,side:string,dark:string)=>[side,side,top,dark,side,dark].map(color=>new T.MeshBasicMaterial({color}));
 const metal=palette('#a5a9aa','#697580','#414854'),bronze=palette('#cfab75','#8c6545','#604333'),iron=palette('#666479','#414151','#292638'),purple=palette('#8970a4','#493558','#2a243c');
 const box=(parent:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material|T.Material[])=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 for(const x of [-2,2]){
  // Basins stay open: the actual game tile supplies their liquid.
  for(const z of [-.89,.89])box(group,x,.18,z,1.94,.27,.12,metal);
  for(const dx of [-.9,.9])box(group,x+dx,.18,0,.12,.27,1.8,metal);
  for(const dx of [-.86,.86])for(const z of [-.86,.86]){box(group,x+dx,.28,z,.24,.24,.24,bronze);box(group,x+dx,.415,z,.09,.04,.09,metal);}
  // Inlaid element glyphs on the front rail explain the two inputs without words.
  box(group,x,.33,.89,.36,.045,.1,new T.MeshBasicMaterial({color:x<0?'#ffc075':'#a4e5ed'}));
 }
 box(group,0,.2,0,1.8,.4,1.85,iron);
 box(group,0,.52,-.43,1.5,.58,.88,metal);
 box(group,0,.9,-.47,1.32,.14,.85,iron);
 // Recessed furnace lid and raised ribs read clearly from the game's high camera.
 box(group,0,.979,-.46,1.02,.035,.58,bronze);
 box(group,0,1.003,-.46,.86,.024,.43,iron);
 for(const x of [-.72,.72])for(const z of [-.77,-.17])box(group,x,.84,z,.16,.13,.16,bronze);
 for(const x of [-1,1]){box(group,x*.96,.24,-.15,.38,.13,.28,bronze);box(group,x*.96,.32,-.15,.38,.04,.16,metal);}

 const glow=new T.MeshBasicMaterial({color:'#50434b'});
 box(group,0,.56,.025,1.1,.38,.045,glow);
 box(group,0,1.02,-.46,.68,.018,.25,glow);
 for(const x of [-.24,0,.24])box(group,x,1.039,-.46,.055,.035,.32,iron);
 for(let i=0;i<5;i++)box(group,-.48+i*.24,.56,.065,.065,.46,.1,iron);
 for(const x of [-.65,.65]){
  box(group,x,.53,.47,.13,.58,.16,bronze);
  box(group,x,.85,.47,.21,.08,.23,metal);
  const piston=box(group,x,.7,.47,.09,.28,.1,metal);pistons.push(piston);
  const gear=new T.Group();gear.position.set(x*1.14,.51,-.58);group.add(gear);
  gear.rotation.z=Math.PI/2;
  const disk=new T.Mesh(new T.CylinderGeometry(.23,.23,.12,10),bronze);disk.rotation.z=Math.PI/2;gear.add(disk);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;const tooth=box(gear,0,Math.cos(a)*.235,Math.sin(a)*.235,.15,.1,.1,bronze);tooth.rotation.x=-a;}gears.push(gear);
 }
 box(group,0,.27,.55,1.12,.13,.71,bronze);
 for(let i=0;i<10;i++){
  const brick=new T.Group();brick.position.set((i%2?1:-1)*.235,.4+Math.floor(i/2)*.15,.54+(Math.floor(i/2)%2?-.035:.035));
  box(brick,0,0,0,.43,.14,.38,purple);box(brick,-.02,.073,-.02,.3,.008,.23,new T.MeshBasicMaterial({color:'#695382'}));
  box(brick,.14,.025,-.194,.025,.07,.008,new T.MeshBasicMaterial({color:'#a68abb'}));brick.visible=false;group.add(brick);bricks.push(brick);
 }
 const chimney=box(group,-.5,1.1,-.67,.25,.35,.25,iron);box(group,-.5,1.29,-.67,.32,.055,.32,metal);
 const steam=Array.from({length:4},()=>{const puff=new T.Mesh(new T.IcosahedronGeometry(.12,0),new T.MeshBasicMaterial({color:'#dbe9dc',transparent:true,opacity:0,depthWrite:false}));group.add(puff);return puff;});
 const waterSteam=Array.from({length:5},()=>{const puff=new T.Mesh(new T.IcosahedronGeometry(.20,1),new T.MeshBasicMaterial({color:'#e4f5ef',transparent:true,opacity:0,depthWrite:false}));puff.name='forge-water-steam';puff.visible=false;group.add(puff);return puff;});
 const paintedMaterials=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])paintedMaterials.add(m);});
 gears.forEach(g=>batchPainted(g));bricks.forEach(b=>batchPainted(b));
 const glowParts=group.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&o.material===glow);batchPainted(group,[...pistons,...steam,...glowParts]);
 return{group,pistons,gears,bricks,glow,steam,waterSteam,chimney,dispose:()=>{disposeGroup(group);paintedMaterials.forEach(m=>m.dispose());}};
}
export class ForgeField{
 readonly group=new T.Group();
 constructor(private readonly produced:(cell:number)=>void=()=>{},private readonly heat:(cell:number,value:number)=>void=()=>{}){}
 private views=new Map<number,{model:ReturnType<typeof createForge>;age:number;count:number;production:number;mechanism:number}>();
 update(game:Game,dt:number,reduced:boolean){
  for(const [c,v] of this.views)if(!game.forges.has(c)){this.heat(c-1,0);v.model.dispose();this.views.delete(c);}
  for(const [c,f] of game.forges){
   let v=this.views.get(c);if(!v){const model=createForge();model.group.position.set(gridWorld(c%8),.06,gridWorld(Math.floor(c/8)));this.group.add(model.group);v={model,age:0,count:0,production:10,mechanism:0};this.views.set(c,v);}
   if(v.count!==f.bricks){this.produced(c);v.production=0;v.count=f.bricks;}v.age+=dt;v.production+=dt;
   const active=game.board[c-1]==='lava'&&game.board[c+1]==='water'&&f.bricks<10,working=active||v.production<.8;
   if(working&&!reduced)v.mechanism+=dt;
   const burst=reduced?0:Math.pow(Math.max(0,1-v.production/.85),.6);
   this.heat(c-1,game.board[c-1]==='lava'?.3+burst*.7:0);
   const m=v.model;m.glow.color.set(working?'#ffba64':'#50434b');
   m.pistons.forEach((p,i)=>p.position.y=.7+(working&&!reduced?Math.sin(v.mechanism*9+i*Math.PI)*.1:0));
   m.gears.forEach((g,i)=>g.rotation.x=v.mechanism*(i?-1:1)*1.8);
   m.bricks.forEach((b,i)=>{b.visible=i<f.bricks;const t=Math.min(1,Math.max(0,(v.production-(i>=f.bricks-1?.12:0))/.4));const pop=i>=f.bricks-2&&!reduced?1+Math.sin(t*Math.PI)*.22:1;b.scale.setScalar(pop);b.position.y=.4+Math.floor(i/2)*.15+(i>=f.bricks-2&&!reduced?Math.sin(t*Math.PI)*.35:0);});
   m.steam.forEach((p,i)=>{const t=(v.age*.55+i*.25)%1;p.visible=working&&!reduced;p.position.set(-.5+Math.sin(i+t*4)*.06,1.4+t*.7,-.67);p.scale.setScalar(.6+t);p.material.opacity=Math.sin(t*Math.PI)*.24;});
   m.waterSteam.forEach((p,i)=>{const t=(v.age*.65+i*.2)%1;p.visible=game.board[c+1]==='water'&&!reduced&&(i<4||burst>.05);p.position.set(2+Math.sin(i*2.4)*.53+Math.sin(t*3+i)*.08,.14+t*(.75+burst*.45),Math.cos(i*2.4)*.5);p.scale.setScalar(.35+t*(.9+burst*.4));p.material.opacity=Math.sin(t*Math.PI)*(.22+burst*.16);});
   if(!reduced&&v.age<.45){const t=Math.min(1,v.age/.45);m.group.scale.setScalar(.85+.15*t);m.group.position.y=.06+Math.sin(t*Math.PI)*.22;}
  }
 }
 dispose(){for(const v of this.views.values())v.model.dispose();this.views.clear();this.group.clear();}
}
let icon:string|undefined;
export function forgeIcon(){
 if(icon)return icon;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setSize(144,80);
 const scene=new T.Scene(),model=createForge();scene.add(model.group);
 const camera=new T.OrthographicCamera(-3.3,3.3,1.83,-1.83,.1,30);camera.position.set(0,7,8);camera.lookAt(0,.3,0);
 renderer.render(scene,camera);icon=renderer.domElement.toDataURL();model.dispose();renderer.dispose();renderer.forceContextLoss();return icon;
}
