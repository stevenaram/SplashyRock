import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Element,type Piece} from '../src/game';
import {poolBlocks} from '../src/boss';
const block=(anchor:number)=>Array.from({length:16},(_,i)=>anchor+i%4+Math.floor(i/4)*8);
const single:Piece={tile:'lava',shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0]]}};
function fixture(){const g=new Game(()=>.1,()=>true);for(const c of block(18))g.board[c]='water';return g;}
test('bosses require a settled solid 4x4 pool, without a pet requirement',()=>{
 const g=fixture();assert.equal(g.trySpawnBoss(true),false);g.board[18]=null;assert.equal(g.trySpawnBoss(),false);g.board[18]='water';assert.equal(g.trySpawnBoss(),true);
 assert.equal(g.boss!.element,'water');assert.equal(g.boss!.maxTiles,16);assert.equal(g.boss!.x,g.boss!.cell%8+.5);assert.equal(g.pets.length,0);
 assert.deepEqual(poolBlocks(new Set([6,7,8,9,14,15,16,17,22,23,24,25,30,31,32,33])),[]);
});
test('one boss per element including dying bosses, with a new disconnected pool eligible afterward',()=>{
 const g=new Game();for(const c of [...block(0),...block(36)])g.board[c]='water';g.trySpawnBoss();assert.equal(g.bosses.length,1);
 const first=g.boss!;g.clearCells([...first.remaining]);assert.ok(first.deathRemaining);assert.equal(g.trySpawnBoss(),false);
 g.updateBoss(1.2);assert.equal(g.bosses.length,0);assert.equal(g.trySpawnBoss(true),false);assert.equal(g.trySpawnBoss(),true);assert.equal(g.bosses.length,1);
});
test('water and lava bosses coexist and keep separate territory',()=>{
 const g=new Game();for(const c of block(0))g.board[c]='water';for(const c of block(36))g.board[c]='lava';g.trySpawnBoss();assert.equal(g.bosses.length,2);
 assert.equal(new Set(g.bosses.map(b=>b.element)).size,2);g.dealInventory();assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);
 const lava=g.bosses.find(b=>b.element==='lava')!;g.clearCells([...g.bosses.find(b=>b.element==='water')!.remaining]);assert.equal(lava.deathRemaining,0);
});
test('growth happens immediately once per placement without locking the next placement',()=>{
 const g=fixture();g.trySpawnBoss();g.inventory=[single,single,single];assert.equal(g.place(0,63),true);assert.equal(g.board[9],'water');assert.equal(g.boss!.maxTiles,36);
 assert.equal(g.place(1,62),true);assert.equal(g.shapeMoves,2);assert.ok(g.boss!.remaining.size>36);
});
test('dying bosses keep exactly four liquid tiles until animation ends then emit stone',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;g.clearCells([...b.remaining]);assert.equal(b.remaining.size,4);assert.ok(b.deathRemaining);
 for(const c of b.remaining)assert.equal(g.board[c],'water');assert.deepEqual(g.clearCells([...b.remaining]),[]);
 g.updateBoss(.7);for(const c of b.remaining)assert.equal(g.board[c],'water');assert.equal(g.bossesDefeated,0);
 g.updateBoss(.5);assert.equal(g.bosses.length,0);assert.equal(g.bossesDefeated,1);for(const c of b.remaining)assert.equal(g.board[c],'stone');assert.equal(g.bossStoneEvents.length,4);
});
test('partial pool damage lowers health against its peak; no 2x2 patch begins death',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;g.clearCells([18]);assert.equal(b.maxTiles,16);assert.equal(b.remaining.size,15);assert.equal(b.deathRemaining,0);
 g.clearCells([...b.remaining].filter(c=>c%8%2===0));assert.ok(b.deathRemaining);
});
test('single-element boss refills counter it; ordinary hands resume once it dies',()=>{
 for(const element of ['water','lava'] as Element[]){const g=fixture();for(const c of block(18))g.board[c]=element;g.trySpawnBoss();g.dealInventory();assert.ok(g.inventory.every(p=>p?.tile===(element==='water'?'lava':'water')));g.clearCells([...g.boss!.remaining]);g.updateBoss(1.2);g.dealInventory();assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);}
});
test('restart removes bosses, death holds and pending visuals; death delays game over',()=>{
 const g=fixture();g.trySpawnBoss();g.clearCells([...g.boss!.remaining]);g.inventory=[];assert.equal(g.finishIfBlocked(false),false);g.restart();assert.equal(g.bossesDying,false);assert.equal(g.bosses.length,0);assert.equal(g.bossGrowthEvents.length,0);assert.equal(g.bossLiquidEvents.length,0);
});

test('a settled pet-created 4x4 can spawn a boss, while a pending aftermath cannot',()=>{
 const g=fixture();g.board[18]=null;assert.equal(g.trySpawnBoss(),false);assert.equal(g.plantPetTile(18,'water'),true);
 assert.equal(g.trySpawnBoss(true),false);assert.equal(g.trySpawnBoss(false),true);
});
test('death hold does not double-count cleared tiles and ignores unrelated sweeps',()=>{
 const g=fixture();g.trySpawnBoss();const b=g.boss!;const removed=g.clearCells([...b.remaining]);assert.equal(removed.length,12);assert.equal(g.tilesCleared,12);
 assert.equal(g.clearCells([...b.remaining]).length,0);g.updateBoss(1.2);g.clearCells([...b.remaining]);assert.equal(g.tilesCleared,16);
});

test('recent clears survive rapid boss growth and the first growth after aftermath settles',()=>{
 const g=fixture();g.trySpawnBoss();g.clearCells([18]);g.settleExpansionProtection(true);
 g.inventory=[single,single,single];assert.equal(g.place(0,63),true);assert.equal(g.board[18],null);
 g.settleExpansionProtection(false);assert.equal(g.place(1,62),true);assert.equal(g.board[18],null);
 g.clearCells([63]);assert.equal(g.place(2,63),true);assert.equal(g.board[18],'water');
 g.restart();for(const c of block(18))g.board[c]='water';g.trySpawnBoss();g.inventory=[single];g.place(0,63);assert.equal(g.board[9],'water');
});
