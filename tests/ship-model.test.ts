import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOAT_BLUEPRINT,BOAT_WALL_BRICKS,BOAT_TOTAL_BRICKS} from '../src/boat';
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
