import {PetMotion} from '../src/pet-motion';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Element,type Piece} from '../src/game';
import {bossHealth,poolBlocks} from '../src/boss';
const block=(anchor:number)=>Array.from({length:16},(_,i)=>anchor+i%4+Math.floor(i/4)*8);
const single:Piece={tile:'lava',shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0]]}};
function readyGame(random:()=>number=Math.random,completed:()=>boolean=()=>false){
 const g=new Game(random,completed);
 for(const [i,element] of (['water','lava'] as Element[]).entries())g.pets.push(new PetMotion(56+i,element,g.board,()=>{}));
 return g;
}
function fixture(){const g=readyGame(()=>.1,()=>true);for(const c of block(18))g.board[c]='water';return g;}
test('bosses require a settled solid 3x3 pool, with an opposing pet',()=>{
 const g=readyGame(()=>.1,()=>true);for(const c of [18,19,20,26,27,28,34,35,36])g.board[c]='water';assert.equal(g.trySpawnBoss(true),false);g.board[18]=null;assert.equal(g.trySpawnBoss(),false);g.board[18]='water';assert.equal(g.trySpawnBoss(),true);
 assert.equal(g.boss!.element,'water');assert.equal(g.boss!.maxTiles,9);assert.equal(g.boss!.x,g.boss!.cell%8+.5);assert.equal(g.pets.length,2);
 assert.deepEqual(poolBlocks(new Set([6,7,8,9,14,15,16,17,22,23,24,25,30,31,32,33])),[]);
});
test('one boss per element including dying bosses, with a new disconnected pool eligible afterward',()=>{
 const g=readyGame();for(const c of [...block(0),...block(36)])g.board[c]='water';g.trySpawnBoss();assert.equal(g.bosses.length,1);
 const first=g.boss!;g.clearCells([...first.remaining]);assert.ok(first.deathRemaining);assert.equal(g.trySpawnBoss(),false);
 g.updateBoss(3.1);assert.equal(g.bosses.length,0);assert.equal(g.trySpawnBoss(true),false);assert.equal(g.trySpawnBoss(),true);assert.equal(g.bosses.length,1);
});
test('water and lava bosses coexist and keep separate territory',()=>{
 const g=readyGame();for(const c of block(0))g.board[c]='water';for(const c of block(36))g.board[c]='lava';g.trySpawnBoss();assert.equal(g.bosses.length,2);
 assert.equal(new Set(g.bosses.map(b=>b.element)).size,2);g.dealInventory();assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);
 const lava=g.bosses.find(b=>b.element==='lava')!;g.clearCells([...g.bosses.find(b=>b.element==='water')!.remaining]);assert.equal(lava.deathRemaining,0);
});
test('growth happens immediately once per placement without locking the next placement',()=>{
 const g=fixture();g.trySpawnBoss();g.inventory=[single,single,single];assert.equal(g.place(0,63),true);assert.equal(g.board[9],null);assert.equal(g.boss!.maxTiles,32);
 assert.equal(g.place(1,62),true);assert.equal(g.shapeMoves,2);assert.ok(g.boss!.remaining.size>16);
});
test('dying bosses keep exactly four liquid tiles until animation ends then emit stone',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;g.clearCells([...b.remaining]);assert.equal(b.remaining.size,4);assert.ok(b.deathRemaining);
 for(const c of b.remaining)assert.equal(g.board[c],'water');assert.deepEqual(g.clearCells([...b.remaining]),[]);
 g.updateBoss(2.7);for(const c of b.remaining)assert.equal(g.board[c],'water');assert.equal(g.bossesDefeated,0);
 g.updateBoss(.5);assert.equal(g.bosses.length,0);assert.equal(g.bossesDefeated,1);for(const c of b.remaining)assert.equal(g.board[c],'stone');assert.equal(g.bossStoneEvents.length,4);
});
test('partial pool damage lowers health against its peak; no 2x2 patch begins death',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;g.clearCells([18]);assert.equal(b.maxTiles,16);assert.equal(b.remaining.size,15);assert.equal(b.deathRemaining,0);
 g.clearCells([...b.remaining].filter(c=>c%8%2===0));assert.ok(b.deathRemaining);
});
test('single-element boss refills counter it; ordinary hands resume once it dies',()=>{
 for(const element of ['water','lava'] as Element[]){const g=fixture();for(const c of block(18))g.board[c]=element;g.trySpawnBoss();g.dealInventory();assert.ok(g.inventory.every(p=>p?.tile===(element==='water'?'lava':'water')));g.clearCells([...g.boss!.remaining]);g.updateBoss(3.1);g.dealInventory();assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);}
});
test('restart removes bosses, death holds and pending visuals; death delays game over',()=>{
 const g=fixture();g.trySpawnBoss();g.clearCells([...g.boss!.remaining]);g.inventory=[];assert.equal(g.finishIfBlocked(false),false);g.restart();assert.equal(g.bossesDying,false);assert.equal(g.bosses.length,0);assert.equal(g.bossGrowthEvents.length,0);assert.equal(g.bossLiquidEvents.length,0);
});

test('a settled pet-created 3x3 can spawn a boss, while a pending aftermath cannot',()=>{
 const g=readyGame();for(const c of [19,20,26,27,28,34,35,36])g.board[c]='water';assert.equal(g.trySpawnBoss(),false);assert.equal(g.plantPetTile(18,'water'),true);
 assert.equal(g.trySpawnBoss(true),false);assert.equal(g.trySpawnBoss(false),true);
});
test('death hold does not double-count cleared tiles and ignores unrelated sweeps',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;const removed=g.clearCells([...b.remaining]);assert.equal(removed.length,12);assert.equal(g.tilesCleared,12);
 assert.equal(g.clearCells([...b.remaining]).length,0);g.updateBoss(3.1);g.clearCells([...b.remaining]);assert.equal(g.tilesCleared,16);
});

test('full boss surges can refill recently cleared cells of either checkerboard color',()=>{
 const g=fixture();g.trySpawnBoss();g.inventory=[single,single,single];
 g.clearCells([18,19]);assert.equal(g.place(0,63),true);
 assert.equal(g.board[18],'water');assert.equal(g.board[19],'water');
 assert.equal(g.board[63],'lava');assert.equal(g.board[0],null);
 assert.equal(g.place(1,62),true);assert.equal(g.board[4],'water');assert.equal(g.board[62],'lava');
});

test('splitting a pool removes detached tiles from health and cannot rescue a stranded boss',()=>{
 const g=readyGame(()=>0,()=>true);
 const home=[0,1,2,8,9,10,16,17,18],island=[6,7,14,15];
 for(const c of [...home,...island,11,12,13])g.board[c]='water';g.trySpawnBoss();const b=g.boss!;
 assert.equal(b.maxTiles,16);g.clearCells([12]);assert.equal(b.remaining.size,10);assert.equal(b.maxTiles,16);
 assert.ok(island.every(c=>!b.remaining.has(c)&&g.board[c]==='water'));
 g.clearCells([1,9,17]);assert.ok(b.deathRemaining);assert.ok(island.every(c=>g.board[c]==='water'));
});
test('detached pools cannot expand for the boss, but reconnecting them restores connected health',()=>{
 const g=readyGame(()=>0,()=>true);for(const c of [0,1,2,8,9,10,16,17,18,11,12,13,6,7,14,15])g.board[c]='water';g.trySpawnBoss();const b=g.boss!;
 g.clearCells([12]);g.inventory=[single];g.place(0,63);
 assert.equal(g.board[23],null); // Only adjacent to the detached island.
 assert.equal(g.board[12],'water');assert.ok(b.remaining.has(15));
 g.plantPetTile(12,'water');g.updateBoss(.01);assert.ok(b.remaining.has(15));
});

test('death never converts a detached same-element pool to stone',()=>{
 const g=readyGame(()=>0,()=>true);const detached=[6,7,14,15];
 for(const c of [0,1,2,8,9,10,16,17,18,11,12,13,...detached])g.board[c]='water';
 g.trySpawnBoss();g.clearCells([12]);const b=g.boss!;g.clearCells([...b.remaining]);
 assert.ok(b.deathRemaining);g.updateBoss(3.1);
 for(const c of detached)assert.equal(g.board[c],'water');
 assert.ok(g.bossStoneEvents.every(c=>!detached.includes(c)));
});

test('each full surge fills every empty cardinal neighbor but no diagonal corners, exactly one layer',()=>{
 for(const element of ['water','lava'] as Element[]){
  const g=fixture();for(const c of block(18))g.board[c]=element;g.trySpawnBoss();g.inventory=[single,single,single];
  for(const [turn,anchor] of [63,62].entries()){
   const before=new Set(g.boss!.remaining),expected:number[]=[];g.bossGrowthEvents.length=0;
   for(let cell=0;cell<64;cell++)if(cell!==anchor&&g.board[cell]===null&&[...before].some(c=>Math.abs(c%8-cell%8)+Math.abs(Math.floor(c/8)-Math.floor(cell/8))===1))expected.push(cell);
   assert.equal(g.place(turn,anchor),true);
   assert.deepEqual(g.bossGrowthEvents.map(e=>e.cell).sort((a,b)=>a-b),expected);
   if(turn===0){assert.equal(g.board[9],null);assert.equal(g.board[54],null);assert.equal(g.board[0],null);}
  }
 }
});

test('boss payout counts repeated actual tile damage, excludes detached tiles and pays once',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;
 g.clearCells([18]);assert.equal(b.damageTaken,1);
 g.plantPetTile(18,'water');g.updateBoss(.01);g.clearCells([18]);assert.equal(b.damageTaken,2);
 g.board[0]='water';g.clearCells([0]);assert.equal(b.damageTaken,2);
 g.clearCells([...b.remaining]);assert.equal(b.damageTaken,17);assert.ok(b.deathRemaining);
 const before=g.score;g.updateBoss(2.9);assert.equal(g.score,before);assert.equal(g.bossRewards.length,0);
 g.updateBoss(.2);assert.equal(g.score-before,1350);assert.equal(g.bossRewards[0].score,1350);
 g.updateBoss(5);assert.equal(g.score-before,1350);assert.equal(g.bossRewards.length,1);
 g.restart();assert.equal(g.bossRewards.length,0);
});
test('revive damage does not inflate a boss reward',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;g.reviving=true;g.clearCells([18]);assert.equal(b.damageTaken,0);
});

test('boss health reserves the last four tiles and scales against peak minus four',()=>{
 const state={remaining:new Set(Array.from({length:16},(_,i)=>i)),maxTiles:16,deathRemaining:0};
 assert.deepEqual(bossHealth(state),{current:12,max:12,fraction:1});
 state.remaining=new Set(Array.from({length:10},(_,i)=>i));assert.equal(bossHealth(state).fraction,.5);
 state.remaining=new Set([0,1,8,9]);assert.equal(bossHealth(state).current,0);
 state.remaining=new Set([0,1]);assert.equal(bossHealth(state).fraction,0);
 state.maxTiles=4;assert.ok(Number.isFinite(bossHealth(state).fraction));
 state.deathRemaining=3;assert.equal(bossHealth(state).current,0);
});

test('each boss needs a hatched opposite-element pet and rechecks existing pools after hatching',()=>{
 for(const element of ['water','lava'] as Element[]){
  const g=new Game();for(const c of [18,19,20,26,27,28,34,35,36])g.board[c]=element;
  assert.equal(g.trySpawnBoss(),false);
  g.pets.push(new PetMotion(56,element,g.board,()=>{}));assert.equal(g.trySpawnBoss(),false);
  const opposite=new PetMotion(57,element==='water'?'lava':'water',g.board,()=>{});opposite.startHatch();g.pets.push(opposite);
  assert.equal(g.trySpawnBoss(),false);opposite.hatchRemaining=0;
  assert.equal(g.trySpawnBoss(true),false);assert.equal(g.trySpawnBoss(),true);assert.equal(g.boss!.element,element);
 }
});
