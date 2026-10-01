import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOAT_BLUEPRINT,BOAT_WALL_BRICKS,BOAT_TOTAL_BRICKS,BOAT_HULL_BRICKS,BOAT_FRAME_BRICKS,APRON_TRIANGLES,BOAT_CURVE,boatDeliveryTarget,hullDeliverySections} from '../src/boat';
import {createShipHull} from '../src/ship-hull';
import {SHIP_PARTS} from '../src/ship-details';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
test('the final 64 deliveries cover the grid once, beneath gameplay and its grid lines',()=>{
 assert.equal(BOAT_TOTAL_BRICKS-BOAT_WALL_BRICKS,64);
 const floor=BOAT_BLUEPRINT.slice(BOAT_WALL_BRICKS);
 assert.deepEqual(floor.map(b=>b.cell),Array.from({length:64},(_,i)=>i));
 assert.ok(floor.every(b=>b.width===2&&b.depth===2&&b.y+b.height/2<0));
});
test('hull panels share exact endpoints around the entire closed shell',()=>{
 const hull=createShipHull(),p=hull.geometry.attributes.position;
 for(let i=0;i<256;i++){
  const next=((i+1)%256)*24;
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(p.getComponent(i*24+1,axis)-p.getComponent(next,axis))<.00001);
 }
 assert.ok(SHIP_PARTS.some(p=>p.y>4));
 hull.geometry.dispose();hull.material.dispose();
});
test('sailing keeps pet abilities, shape placement, and subsequent loss/revive functional',()=>{
 const g=new Game(()=>.3,()=>true);g.boat.setProgress(BOAT_TOTAL_BRICKS);
 g.pets.push(new PetMotion(63,'lava',g.board,(c,r)=>g.plantPetTile(c,'lava',r),()=>.3,()=>g.boardChange,()=>g.pets));
 assert.ok(g.finishIfWon());assert.equal(g.over,false);assert.equal(g.finishIfWon(),false);
 g.inventory=[{tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}}];
 assert.ok(g.place(0,0));assert.equal(g.board[0],'water');
 g.queuePetActions();for(let t=0;t<12;t+=.05)g.pets[0].update(.05);
 assert.ok(g.board.includes('lava'));assert.equal(g.won,true);
 g.over=true;assert.equal(g.beginRevive().length,4);g.finishRevive();assert.equal(g.over,false);assert.equal(g.won,true);
 g.restart();assert.equal(g.won,false);assert.equal(g.boat.count,0);
});
test('every hull delivery targets the center of its own revealed perimeter section',()=>{
 const covered:number[]=[];
 for(let id=BOAT_FRAME_BRICKS;id<BOAT_HULL_BRICKS;id++){
  const {start,end}=hullDeliverySections(id);for(let i=start;i<end;i++)covered.push(i);
  const t=(start+end)/512,p=BOAT_CURVE.getPointAt(t),n=BOAT_CURVE.getTangentAt(t),target=boatDeliveryTarget(id);
  assert.ok(Math.abs((target.x-3.5)*2-(p.x+n.z*.28))<1e-8);
  assert.ok(Math.abs((target.y-3.5)*2-(p.z-n.x*.28))<1e-8);
  assert.ok(Math.abs(target.height-1.32)<1e-8);
 }
 assert.deepEqual(covered,Array.from({length:256},(_,i)=>i));
});
test('brick deliveries actually reach their world-space target before constructing hull, fittings, or deck',()=>{
 const fitting=BOAT_BLUEPRINT.findIndex(b=>b.detail!==undefined&&SHIP_PARTS[b.detail].rx===Math.PI/2);
 for(const id of [0,Math.floor(BOAT_HULL_BRICKS/2),fitting,BOAT_WALL_BRICKS]){
  const g=new Game(()=>.3,()=>true);g.board[27]='forge';g.forges.set(27,{bricks:1,cycles:1});g.boat.setProgress(id);
  const p=new PetMotion(63,'lava',g.board,()=>true,()=>.3,()=>g.boardChange,()=>g.pets);g.pets.push(p);
  let landed=false;const deliver=g.boat.deliver.bind(g.boat),target=boatDeliveryTarget(id);
  g.boat.deliver=(job)=>{assert.equal(job,id);assert.equal(p.x,target.x);assert.equal(p.y,target.y);assert.equal(p.altitude,target.height);assert.equal(p.building,true);landed=true;return deliver(job);};
  g.queuePetActions();for(let t=0;t<15&&!landed;t+=.025)p.update(.025);assert.ok(landed);
 }
 const b=BOAT_BLUEPRINT[fitting],part=b.part!;
 assert.ok(Math.abs(boatDeliveryTarget(fitting).height-(part.y+part.depth/2))<1e-8);
});

test('construction frames the perimeter before plating, with no large milestone reveal',()=>{
 assert.ok(BOAT_BLUEPRINT.slice(0,BOAT_FRAME_BRICKS).every(b=>b.frame));
 assert.ok(BOAT_BLUEPRINT.slice(BOAT_FRAME_BRICKS,BOAT_HULL_BRICKS).every(b=>!b.frame&&b.apron===undefined&&b.detail===undefined));
 const parts=BOAT_BLUEPRINT.filter(b=>b.part);
 // Every job has unique physical geometry, not multiple bricks funding the same part.
 assert.equal(new Set(parts.map(b=>JSON.stringify(b.part))).size,parts.length);
 for(const b of parts){const d=[b.width,b.height,b.depth].sort((a,b)=>b-a);assert.ok(Math.min(...d)>.005);assert.ok(d[0]*d[1]<1.1);}
 for(let detail=0;detail<SHIP_PARTS.length;detail++){
  const p=SHIP_PARTS[detail],volume=parts.filter(b=>b.detail===detail).reduce((sum,b)=>sum+b.width*b.height*b.depth,0);
  assert.ok(Math.abs(volume-p.width*p.height*p.depth)<1e-8,'split fittings preserve the finished model');
 }
 assert.equal(BOAT_BLUEPRINT.filter(b=>b.apron!==undefined).length,APRON_TRIANGLES.length);
 const area=APRON_TRIANGLES.map(t=>t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).length()/2);
 assert.ok(Math.max(...area)<2);assert.ok(area.every(a=>a>0));
});
