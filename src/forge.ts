import {obsidianMaterial} from './obsidian-material';
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
// Production peaks quickly, then releases pressure over a long, smooth tail.
export function forgeProductionHeat(seconds:number){
 if(seconds>=3.2)return 0;
 return Math.pow(Math.max(0,1-seconds/3.2),1.4);
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

 // Layered cast-metal armor: chunky silhouette with small inset seams and bolts.
 const edge=palette('#c1c6c6','#7b8790','#424b59'),soot=palette('#45414c','#2c2934','#1d1b26');
 for(const side of [-1,1]){
  box(group,side*.80,.52,-.35,.16,.64,1.05,iron);
  box(group,side*.88,.53,-.35,.045,.40,.76,purple);
  box(group,side*.885,.75,-.35,.05,.045,.84,edge);
  for(const z of [-.68,-.05]){
   box(group,side*.89,.52,z,.055,.43,.07,bronze);
   for(const y of [.34,.70])box(group,side*.925,y,z,.045,.065,.065,edge);
  }
  // Ribbed feed couplings join the basin rails to the central casting.
  box(group,side*1.02,.38,-.36,.40,.20,.28,iron);
  for(const x of [.90,1.05,1.20])box(group,side*x,.40,-.36,.045,.25,.34,edge);
  box(group,side*.70,.19,.80,.28,.23,.28,iron);
  box(group,side*.70,.32,.80,.30,.045,.30,edge);
 }
 // Back pressure manifold and chimney collar; all within the original footprint.
 box(group,0,.65,-.86,1.54,.26,.15,soot);
 for(let i=0;i<7;i++)box(group,-.60+i*.20,.81,-.86,.075,.09,.19,edge);
 box(group,.47,1.01,-.65,.33,.10,.32,iron);
 const gauge=new T.Mesh(new T.CylinderGeometry(.13,.13,.055,12),edge);gauge.position.set(.47,1.09,-.65);group.add(gauge);
 box(group,.47,1.125,-.65,.17,.016,.025,soot);
 box(group,.47,1.14,-.65,.025,.018,.11,bronze);
 for(const x of [-.60,.60])for(const z of [-.73,-.20])box(group,x,1.00,z,.075,.055,.075,edge);
 // Front brick chute has visible rails, inset grooves, and a reinforced lip.
 for(const x of [-.53,.53]){box(group,x,.34,.59,.065,.12,.68,iron);box(group,x,.41,.59,.065,.025,.68,edge);}
 box(group,0,.22,.94,1.33,.14,.10,iron);box(group,0,.30,.97,1.35,.035,.06,edge);
 for(const x of [-.46,0,.46])box(group,x,.25,1.001,.065,.065,.018,bronze);

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
  const brick=new T.Group();brick.position.set(0,.45+i*.185,.54+(i%2?-.025:.025));
  box(brick,0,0,0,1.20,.178125,.57,obsidianMaterial());
  brick.visible=false;group.add(brick);bricks.push(brick);
 }
 const chimney=box(group,-.5,1.1,-.67,.25,.35,.25,iron);box(group,-.5,1.29,-.67,.32,.055,.32,metal);box(group,-.5,1.13,-.67,.29,.055,.29,bronze);box(group,-.5,1.325,-.67,.20,.018,.20,soot);
 const steam=Array.from({length:4},()=>{const puff=new T.Mesh(new T.IcosahedronGeometry(.12,0),new T.MeshBasicMaterial({color:'#85898c',transparent:true,opacity:0,depthWrite:false}));group.add(puff);return puff;});
 const waterSteam=Array.from({length:5},()=>{const puff=new T.Mesh(new T.IcosahedronGeometry(.20,1),new T.MeshBasicMaterial({color:'#e4f5ef',transparent:true,opacity:0,depthWrite:false}));puff.name='forge-water-steam';puff.visible=false;group.add(puff);return puff;});
 const makeParticles=(name:string,count:number,geometry:T.BufferGeometry,color:string)=>{
  const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}),count);mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;group.add(mesh);return mesh;
 };
 const smoke=makeParticles('forge-production-smoke',54,new T.IcosahedronGeometry(.18,1),'#ffffff');
 const bubbles=makeParticles('forge-boiling-bubbles',28,new T.IcosahedronGeometry(.065,1),'#d7ffff');
 const sparks=makeParticles('forge-lava-sparks',96,new T.OctahedronGeometry(.055),'#ff6338');
 const halo=new T.Mesh(new T.PlaneGeometry(7,5),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{strength:{value:0}},vertexShader:`varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 uvp;uniform float strength;void main(){float d=length((uvp-.5)*2.);float a=pow(max(0.,1.-d),2.);gl_FragColor=vec4(1.,.08,.015,a*strength*.48);}`}));
 halo.rotation.x=-Math.PI/2;halo.position.set(-1,.38,0);group.add(halo);
 const fuelHints=[-2,2].map(x=>{
  const hint=new T.Group();hint.position.set(x,.48,0);hint.visible=false;
  const color=x<0?'#ffad65':'#9aebf2',material=new T.MeshBasicMaterial({color,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false});
  const ring=new T.Mesh(new T.RingGeometry(.40,.445,32),material);ring.rotation.x=-Math.PI/2;hint.add(ring);
  const shape=new T.Shape();shape.moveTo(0,.32);
  if(x>0){shape.bezierCurveTo(-.10,.12,-.23,-.02,-.21,-.16);shape.bezierCurveTo(-.19,-.37,.22,-.37,.22,-.13);shape.bezierCurveTo(.20,.04,.06,.16,0,.32);}
  else{shape.bezierCurveTo(.02,.07,-.21,.12,-.20,-.12);shape.bezierCurveTo(-.22,-.36,.23,-.36,.23,-.12);shape.lineTo(.15,.13);shape.lineTo(.08,-.01);shape.lineTo(0,.32);}
  const glyph=new T.Mesh(new T.ShapeGeometry(shape),material);glyph.rotation.x=-Math.PI/2;hint.add(glyph);
  const badge=new T.Mesh(new T.CircleGeometry(.50,32),new T.MeshBasicMaterial({color:'#183442',transparent:true,opacity:.82,side:T.DoubleSide,depthWrite:false}));badge.rotation.x=-Math.PI/2;badge.position.y=-.015;hint.add(badge);group.add(hint);return hint;
 });
 const paintedMaterials=new Set<T.Material>();group.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])paintedMaterials.add(m);});
 gears.forEach(g=>batchPainted(g));
 const glowParts=group.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&o.material===glow);batchPainted(group,[...pistons,...steam,...glowParts]);
 return{group,pistons,gears,bricks,glow,steam,waterSteam,chimney,fuelHints,smoke,bubbles,sparks,halo,dispose:()=>{disposeGroup(group);paintedMaterials.forEach(m=>m.dispose());}};
}
export class ForgeField{
 readonly group=new T.Group();
 constructor(private readonly produced:(cell:number)=>void=()=>{},private readonly heat:(cell:number,value:number)=>void=()=>{}){}
 private particle=new T.Object3D();
 private views=new Map<number,{model:ReturnType<typeof createForge>;age:number;count:number;cycles:number;production:number;mechanism:number}>();
 update(game:Game,dt:number,reduced:boolean){
  for(const [c,v] of this.views)if(!game.forges.has(c)){this.heat(c-1,0);v.model.dispose();this.views.delete(c);}
  for(const [c,f] of game.forges){
   let v=this.views.get(c);if(!v){const model=createForge();model.group.position.set(gridWorld(c%8),.06,gridWorld(Math.floor(c/8)));this.group.add(model.group);v={model,age:0,count:0,cycles:0,production:10,mechanism:0};this.views.set(c,v);}
   if(v.cycles!==f.cycles){this.produced(c);v.production=0;v.cycles=f.cycles;}v.count=f.bricks;v.age+=dt;v.production+=dt;
   const active=game.board[c-1]==='lava'&&game.board[c+1]==='water'&&f.bricks<10,working=active||v.production<3.2;
   if(working&&!reduced)v.mechanism+=dt*(.25+forgeProductionHeat(v.production)*1.75);
   const burst=reduced?0:forgeProductionHeat(v.production);
   this.heat(c-1,game.board[c-1]==='lava'?.3+burst*.7:0);
   const m=v.model;m.fuelHints.forEach((hint,i)=>{hint.visible=game.board[c+(i?1:-1)]!==(i?'water':'lava');hint.scale.setScalar(reduced?1:1+Math.sin(v.age*2.6)*.07);hint.position.y=.48+(reduced?0:Math.sin(v.age*2.6)*.025);});m.glow.color.set(game.board[c-1]==='lava'&&game.board[c+1]==='water'?'#b76238':'#50434b').lerp(new T.Color('#ff391e'),burst);
   m.pistons.forEach((p,i)=>p.position.y=.7+(working&&!reduced?Math.sin(v.mechanism*9+i*Math.PI)*(.025+burst*.14):0));
   m.gears.forEach((g,i)=>g.rotation.x=v.mechanism*(i?-1:1)*1.8);
   m.bricks.forEach((b,i)=>{b.visible=i<f.bricks;b.scale.setScalar(1);b.position.y=.45+i*.185;});
   m.halo.material.uniforms.strength.value=burst;
   m.steam.forEach((p,i)=>{const t=(v.age*.55+i*.25)%1;p.visible=working&&!reduced;p.position.set(-.5+Math.sin(i+t*4)*.06,1.4+t*.7,-.67);p.scale.setScalar(.6+t);p.material.opacity=Math.sin(t*Math.PI)*(.16+burst*.35);});
   m.waterSteam.forEach((p,i)=>{const t=(v.age*.65+i*.2)%1;p.visible=game.board[c+1]==='water'&&!reduced&&(i<4||burst>.05);p.position.set(2+Math.sin(i*2.4)*.53+Math.sin(t*3+i)*.08,.14+t*(.75+burst*1.1),Math.cos(i*2.4)*.5);p.scale.setScalar(.35+t*(.9+burst*.4));p.material.opacity=Math.sin(t*Math.PI)*(.22+burst*.35);});
   // Batched particles keep eight simultaneous forges affordable on phones.
   for(const [mesh,count] of [[m.smoke,54],[m.bubbles,28],[m.sparks,96]] as const){
    mesh.visible=!reduced&&burst>.002;
    if(!mesh.visible)continue;
    mesh.material.opacity=(mesh===m.smoke?.48:.9)*Math.min(1,burst*2);
    for(let i=0;i<count;i++){
     const t=(v.age*(mesh===m.smoke?.55:1.65)+i*.618034)%1,a=i*2.39996;
     const radius=.15+(i%7)*.095,fade=Math.sin(t*Math.PI),p=this.particle;
     if(mesh===m.smoke){
      const chimney=i<28;mesh.setColorAt(i,new T.Color(chimney?(i%2?'#85898c':'#96999b'):'#b9c5c6'));
      p.position.set((chimney?-.5:2)+Math.cos(a)*radius+t*.22, (chimney?1.38:.2)+t*(1.5+burst*.8), (chimney?-.67:0)+Math.sin(a)*radius+t*.12);
      p.scale.setScalar(fade*(.45+t*1.9)*(.5+burst));
     }else{
      const water=mesh===m.bubbles;
      p.position.set((water?2:-2)+Math.cos(a)*radius*(1+t*.25),.13+Math.sin(t*Math.PI)*(.15+burst*(water?.32:.7)),Math.sin(a)*radius*(1+t*.25));
      p.scale.set(water?fade:fade*.7,water?fade*.65:fade*(1+burst*2),water?fade:fade*.7);
     }
     p.rotation.set(a+t,a,t*2);p.updateMatrix();mesh.setMatrixAt(i,p.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   }
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
