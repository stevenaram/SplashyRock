import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {SHAPES} from '../src/shapes';
const single=SHAPES.find(s=>s.id==='single')!;
const egg:Piece={tile:'pet',shape:single};
test('threshold-crossing placement immediately fills its vacated slot with an egg',()=>{
 const g=new Game(()=>.2);g.score=2999;g.inventory[0]={tile:'water',shape:single};const other=g.inventory[1];
 assert.ok(g.place(0,0));assert.equal(g.inventory[0]?.tile,'pet');assert.equal(g.inventory[1],other);assert.equal(g.rewardsDealt,1);
});
test('chain, stone and clearing rewards deliver eggs immediately, without duplicates',()=>{
 for(const kind of ['chain','stone','clear']){
  const g=new Game();g.score=2990;
  if(kind==='chain'){g.combo=2;g.chainPoints=20;g.finishChain();}
  if(kind==='stone'){g.board[0]='water';g.board[2]='lava';g.formStone(1);}
  if(kind==='clear'){g.board[0]='water';g.clearCells([0]);}
  assert.equal(g.inventory.length,4);assert.equal(g.inventory[3]?.tile,'pet');assert.equal(g.claimEggRewards(),0);
 }
});
test('egg placement is empty-board cosmetic, costs no points and queues no ability',()=>{
 const g=new Game();g.inventory=[egg,{tile:'water',shape:single},null];g.board[9]='lava';
 assert.equal(g.place(0,9),false);const before=[...g.board];assert.ok(g.place(0,27));
 assert.deepEqual(g.board,before);assert.equal(g.score,0);assert.equal(g.pet?.queued,0);assert.equal(g.pet?.hatchRemaining,1.8);
});
test('second placed egg hatches opposite the first, independent of inventory order; later eggs random',()=>{
 for(const random of [()=>.2,()=>.8]){
  const g=new Game(random);g.inventory=[egg,egg,egg];g.place(2,27);g.place(0,28);g.place(1,29);
  assert.notEqual(g.pets[0].element,g.pets[1].element);assert.equal(g.pets[0].element,g.pets[2].element);
  g.restart();assert.equal(g.pets.length,0);assert.equal(g.rewardsDealt,0);
 }
});
test('fresh trays counter the water/lava majority, with both elements always present',()=>{
 for(const [water,lava,stone,expected] of [[5,2,0,'lava'],[2,5,0,'water'],[2,2,0,'water'],[2,0,5,'lava']] as const){
  const g=new Game(()=>.2);g.board.fill(null);let c=1;
  for(let i=0;i<water;i++)g.board[c++]='water';for(let i=0;i<lava;i++)g.board[c++]='lava';for(let i=0;i<stone;i++)g.board[c++]='stone';
  // An egg consumes the final slot without changing the board composition.
  g.inventory=[egg,null,null];g.place(0,0);
  assert.equal(g.inventory.filter(p=>p?.tile===expected).length,2);assert.equal(new Set(g.inventory.map(p=>p?.tile)).size,2);
 }
});
test('game over waits for pending reactions and reachable pet abilities, then stays ended',()=>{
 const g=new Game(()=>.2);g.inventory=[egg,null,null];g.place(0,0);g.pet!.update(1.8);
 g.inventory=[{tile:'water',shape:SHAPES.find(s=>s.width===3&&s.height===3)!}];
 g.board.fill('lava');g.board[0]=null;g.pet!.queueAbility();
 assert.equal(g.finishIfBlocked(true),false);assert.equal(g.finishIfBlocked(false),false);
 g.pet!.update(.7);assert.equal(g.finishIfBlocked(false),true);
 g.board.fill(null);assert.equal(g.finishIfBlocked(false),true);assert.equal(g.place(0,27),false);
 const completed=g.pet!.completed;g.pet!.update(5);assert.ok(g.pet!.completed>completed);
});
