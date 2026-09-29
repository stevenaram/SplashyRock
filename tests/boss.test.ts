import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Element} from '../src/game';
import {poolSquares} from '../src/boss';
function fixture(){
 const g=new Game(()=>.1,()=>true);
 for(const [i,element] of (['lava','water','lava'] as Element[]).entries()){
  g.inventory[0]={tile:'pet',petElement:element,shape:{id:'egg',name:'Egg',width:1,height:1,cells:[[0,0]]}};
  g.place(0,48+i);g.pet!.hatchRemaining=0;
 }
 for(const c of [18,19,20,26,27,28])g.board[c]='water';return g;
}
test('boss waits for actual hatches and a same-element 2x2 pool',()=>{
 const g=fixture();g.pet!.hatchRemaining=1;assert.equal(g.trySpawnBoss(),false);g.pet!.hatchRemaining=0;
 assert.equal(g.trySpawnBoss(),true);assert.equal(g.boss!.element,'water');assert.equal(g.boss!.x,g.boss!.cell%8+.5);
 assert.deepEqual(poolSquares(new Set([7,8,15,16])),[]);
});
test('pool loss staggers boss; destroying every 2x2 defeats it even with remaining tiles',()=>{
 const g=fixture();g.trySpawnBoss();g.clearCells([18]);assert.ok(g.boss);assert.equal(g.boss.hits,1);
 g.clearCells([20]);assert.equal(g.boss,null);assert.equal(g.bossesDefeated,1);assert.equal(g.bossStoneEvents.length,4);
 assert.ok(g.bossStoneEvents.every(c=>g.board[c]==='stone'));assert.equal(g.trySpawnBoss(),false);
});
test('each shape expands exactly one layer, never overwrites tiles, and eggs do not expand it',()=>{
 const g=fixture();g.trySpawnBoss();g.board[9]='lava';const before=new Set(g.boss!.pool);
 g.inventory[0]={tile:'lava',shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0]]}};g.place(0,63);
 assert.equal(g.boss!.remaining.size,before.size);assert.equal(g.resolveBossGrowth(true),false);assert.equal(g.resolveBossGrowth(false),true);
 assert.equal(g.board[9],'lava');assert.equal(g.board[10],'water');assert.equal(g.board[2],null);
 assert.ok(g.boss!.remaining.size>before.size);
 const size=g.boss!.remaining.size;g.inventory[0]={tile:'pet',shape:{id:'egg',name:'egg',width:1,height:1,cells:[[0,0]]}};g.place(0,60);assert.equal(g.boss!.remaining.size,size);
});
test('helpful pets plant reaction-enabling tiles instead of damaging boss directly',()=>{
 const g=fixture();g.trySpawnBoss();const pet=g.pets[0];pet.queueAbility();pet.update(.01);assert.equal(pet.attacking,false);pet.update(3);
 assert.equal(g.petTileEvents.length,1);assert.ok(g.stoneCandidates().length>0);assert.equal(g.boss!.hits,0);
});
test('boss wanders only between valid square centers and relocates after losing footing',()=>{
 const g=fixture();g.trySpawnBoss();const initial=g.boss!.cell;g.updateBoss(2);g.updateBoss(2);assert.notEqual(g.boss!.cell,initial);
 assert.ok(poolSquares(g.boss!.remaining).includes(g.boss!.cell));g.clearCells([18]);g.updateBoss(.1);assert.equal(g.boss!.cell,19);
 g.restart();assert.equal(g.boss,null);assert.equal(g.bossGrowthEvents.length,0);
});
test('empty or thin pools defer spawn and game over never spawns a boss',()=>{
 const g=fixture();g.board.fill(null);g.board[0]=g.board[1]='water';assert.equal(g.trySpawnBoss(),false);g.board[8]=g.board[9]='water';g.over=true;assert.equal(g.trySpawnBoss(),false);
});

test('sandbox-style dealing follows current elemental balance even with stone present',()=>{
 const g=fixture();g.board[0]='stone';g.dealInventory();assert.equal(g.inventory.filter(p=>p?.tile==='lava').length,2);assert.equal(g.inventory.filter(p=>p?.tile==='water').length,1);
 g.board.fill(null);g.board[0]='lava';g.board[1]='stone';g.board[2]='stone';g.dealInventory();assert.equal(g.inventory.filter(p=>p?.tile==='water').length,2);
});
test('queued growth resolves once per shape and is discarded if that boss is defeated',()=>{
 const g=fixture();g.trySpawnBoss();for(const cell of [60,61]){g.inventory[0]={tile:'lava',shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0]]}};g.place(0,cell);}
 assert.equal(g.resolveBossGrowth(false),true);assert.equal(g.hasPendingBossGrowth,true);assert.equal(g.resolveBossGrowth(false),true);assert.equal(g.resolveBossGrowth(false),false);
 g.inventory[0]={tile:'lava',shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0]]}};g.place(0,62);g.clearCells([...g.boss!.remaining]);assert.equal(g.resolveBossGrowth(false),false);
});

test('boss refills are entirely opposite-element and normal mixed hands return after defeat',()=>{
 for(const element of ['water','lava'] as Element[]){
  const g=fixture();g.trySpawnBoss();g.boss!.element=element;
  g.inventory=[{tile:'pet',shape:{id:'egg',name:'egg',width:1,height:1,cells:[[0,0]]}},null,null];
  assert.equal(g.place(0,60),true);
  assert.equal(g.inventory.length,3);assert.ok(g.inventory.every(p=>p?.tile===(element==='water'?'lava':'water')));
  g.clearCells([...g.boss!.remaining]);assert.equal(g.boss,null);g.dealInventory();
  assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);
 }
});
