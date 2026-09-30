import {SHIP_PARTS} from '../src/ship-details';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoatProgress,BOAT_BLUEPRINT,BOAT_TOTAL_BRICKS,BOAT_WALL_BRICKS} from '../src/boat';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
const advance=(g:Game,seconds=12)=>{for(let t=0;t<seconds;t+=.05)for(const p of g.pets)p.update(.05);};
function fixture(pets=1,bricks=2){const g=new Game(()=>.3,()=>true);g.board[27]='forge';g.forges.set(27,{bricks,cycles:1});for(let i=0;i<pets;i++)g.pets.push(new PetMotion(48+i,i%2?'water':'lava',g.board,()=>true,()=>.3,()=>g.boardChange,()=>g.pets));return g;}
test('1,985 deliveries build a single-thickness hull, every fitting, and a flush full deck',()=>{
 assert.equal(BOAT_TOTAL_BRICKS,1985);assert.equal(new Set(BOAT_BLUEPRINT.flatMap(b=>b.detail===undefined?[]:[b.detail])).size,SHIP_PARTS.length);assert.ok(BOAT_BLUEPRINT.slice(0,BOAT_WALL_BRICKS).every(b=>!b.deck));assert.ok(BOAT_BLUEPRINT.slice(BOAT_WALL_BRICKS).every(b=>b.deck));
 assert.ok(BOAT_BLUEPRINT.filter(b=>b.detail===undefined&&!b.deck).every(b=>b.depth===.64));
 assert.ok(BOAT_BLUEPRINT.filter(b=>b.deck).every(b=>b.y+b.height/2<0&&b.width===2&&b.depth===2));
 for(let c=0;c<64;c++)assert.equal(BOAT_BLUEPRINT.filter(b=>b.cell===c).length,1);
 for(const b of BOAT_BLUEPRINT.filter(b=>!b.deck))assert.ok(Math.abs(b.x)>8||Math.abs(b.z)>8);
});
test('construction reservations cannot duplicate work, release holes, and only count delivered bricks',()=>{
 const b=new BoatProgress(),a=b.reserve()!,c=b.reserve()!;assert.notEqual(a,c);assert.equal(b.count,0);assert.ok(b.deliver(c));assert.equal(b.deliver(c),false);b.release(a);assert.equal(b.reserve(),a);assert.ok(b.deliver(a));assert.equal(b.count,2);b.setProgress(BOAT_TOTAL_BRICKS+5);assert.ok(b.complete);assert.equal(b.reserve(),null);b.reset();assert.equal(b.count,0);
});
test('pets reserve available bricks ahead of berries, consume exactly one and return without a blast target',()=>{
 const g=fixture(3,2);g.board[40]='bush';g.bushes.set(40,{phase:'healthy',berries:4,reserved:0});let holds=0;
 g.queuePetActions(()=>{holds++;return()=>holds--;});assert.equal(g.bushes.get(40)!.reserved,1);
 advance(g);assert.equal(g.boat.count,2);assert.equal(g.forges.get(27)!.bricks,0);assert.equal(g.bushes.get(40)!.berries,3);assert.equal(holds,0);
 for(const p of g.pets){assert.equal(p.queued,0);assert.equal(p.carryingBrick,false);assert.ok(p.x>=0&&p.x<=7&&p.y>=0&&p.y<=7);assert.equal(p.altitude,0);}
});
test('queued placements cannot reserve more bricks than stock; cancellation refunds carried bricks and frees slots',()=>{
 const g=fixture(2,2);g.queuePetActions();g.queuePetActions();advance(g,.9);g.pets.forEach(p=>p.cancelAbilities());advance(g);assert.equal(g.boat.count,0);assert.equal(g.forges.get(27)!.bricks,2);g.queuePetActions();advance(g);assert.equal(g.boat.count,2);assert.equal(g.forges.get(27)!.bricks,0);
});
test('completed deliveries make bush-safe shard stones using opposite shoreline, not berry achievements',()=>{
 const g=fixture();g.board[1]='water';let stones=0;g.onLeafStone=(c)=>{stones++;assert.ok(g.shardStones.has(c));assert.ok(g.leafStones.has(c));};g.queuePetActions();advance(g);assert.equal(g.boat.count,1);assert.equal(stones,1);assert.equal(g.featureAchievementEvents['berry-blast'],undefined);
});
test('building the last brick wins only after the pet returns, resets cleanly, and does not occupy board cells',()=>{
 const g=fixture();g.boat.setProgress(BOAT_TOTAL_BRICKS-1);const board=[...g.board];g.queuePetActions();assert.equal(g.finishIfWon(),false);advance(g);assert.ok(g.finishIfWon());assert.deepEqual(g.board,board);g.restart();assert.equal(g.won,false);assert.equal(g.boat.count,0);assert.equal(g.forges.size,0);
});
test('multiple forges supply independent stock without double-assigning construction slots',()=>{
 const g=fixture(8,2);g.board[43]='forge';g.forges.set(43,{bricks:3,cycles:1});let holds=0;
 g.queuePetActions(()=>{holds++;return()=>holds--;});advance(g);
 assert.equal(g.boat.count,5);assert.equal(g.forges.get(27)!.bricks,0);assert.equal(g.forges.get(43)!.bricks,0);assert.equal(holds,0);
});
test('revive-style cancellation after delivery keeps built work and does not refund that brick',()=>{
 const g=fixture(1,1);g.queuePetActions();for(let i=0;i<200&&!g.boat.count;i++)g.pets[0].update(.05);
 assert.equal(g.boat.count,1);g.pets[0].cancelAbilities();advance(g);assert.equal(g.forges.get(27)!.bricks,0);assert.equal(g.boat.count,1);assert.equal(g.pets[0].altitude,0);
});
test('launch is one-shot and gameplay continues on the sailing ship',()=>{
 const g=fixture();g.setBoatProgress(BOAT_TOTAL_BRICKS);assert.ok(g.finishIfWon());
 g.inventory=[{tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}}];assert.equal(g.over,false);assert.equal(g.finishIfWon(),false);assert.equal(g.place(0,0),true);
 g.setBoatProgress(1);assert.equal(g.over,false);assert.equal(g.won,false);
});
