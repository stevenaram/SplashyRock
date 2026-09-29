import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';
import { StoneReactions, SandSweeps, STONE_BURY_MS, NEIGHBOR_SWEEP_MS } from '../src/reactions';
import { SHAPES } from '../src/shapes';
const single=SHAPES.find(s=>s.id==='single')!;

test('stone clears before its orthogonal neighbors; diagonals survive and scoring counts actual clears',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game();
 game.board[27]='stone';for(const cell of [19,26,28,35,18])game.board[cell]='water';
 const phases:string[]=[];const sweeps=new SandSweeps(game,(_,__,phase)=>phases.push(phase),()=>{});
 sweeps.schedule();sweeps.schedule();assert.equal(sweeps.busy,true);
 t.mock.timers.tick(STONE_BURY_MS-1);assert.equal(game.board[27],'stone');
 t.mock.timers.tick(1);assert.equal(game.board[27],null);assert.equal(game.board[26],'water');assert.equal(game.score,10);assert.equal(sweeps.busy,true);
 t.mock.timers.tick(NEIGHBOR_SWEEP_MS-1);assert.equal(game.board[26],'water');
 t.mock.timers.tick(1);for(const cell of [19,26,28,35])assert.equal(game.board[cell],null);
 assert.equal(game.board[18],'water');assert.equal(game.score,50);assert.deepEqual(phases,['stone','neighbors']);assert.equal(sweeps.busy,false);sweeps.dispose();
});
test('edge sweeps do not wrap rows and overlapping sweeps never double-score',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game();game.board[7]='stone';game.board[15]='stone';game.board[8]='lava';game.board[6]='water';game.board[14]='water';
 const sweeps=new SandSweeps(game,()=>{},()=>{});sweeps.schedule();t.mock.timers.tick(500);t.mock.timers.tick(280);
 assert.equal(game.board[8],'lava');assert.equal(game.score,40);sweeps.dispose();
});
test('a blocked board is not game over while a sweep can make room',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game();game.board.fill('water');game.board[27]='stone';game.inventory=[{tile:'water',shape:single},null,null];
 const sweeps=new SandSweeps(game,()=>{},()=>{});sweeps.schedule();assert.equal(game.hasLegalMove(),false);assert.equal(game.finishIfBlocked(sweeps.busy),false);
 t.mock.timers.tick(500);t.mock.timers.tick(280);assert.equal(game.hasLegalMove(),true);assert.equal(game.finishIfBlocked(sweeps.busy),false);sweeps.dispose();
});
test('no legal inventory placement ends the run; one remaining playable piece keeps it alive',()=>{
 const game=new Game();game.board.fill('water');game.inventory=[{tile:'lava',shape:single},null,null];assert.equal(game.finishIfBlocked(false),true);assert.equal(game.place(0,0),false);
 game.restart();game.board.fill('lava');game.board[0]=null;game.inventory=[{tile:'water',shape:SHAPES.find(s=>s.id==='cross')!},{tile:'lava',shape:single},null];assert.equal(game.hasLegalMove(),true);assert.equal(game.finishIfBlocked(false),false);
});
test('restart cancels old timers, clears score and board, and deals a mixed tray',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game();game.board[27]='stone';game.score=120;
 const sweeps=new SandSweeps(game,()=>assert.fail('stale effect'),()=>{});sweeps.schedule();sweeps.dispose();game.restart();t.mock.timers.tick(2000);
 assert.equal(game.score,0);assert.equal(game.over,false);assert.ok(game.board.every(v=>v===null));assert.equal(new Set(game.inventory.map(p=>p!.tile)).size,2);
});
test('placement, stone creation and sweeping award deterministic points',()=>{
 const game=new Game();game.inventory[0]={tile:'water',shape:single};game.place(0,26);assert.equal(game.score,1);
 game.board[28]='lava';game.formStone(27);assert.equal(game.score,21);
 game.clearCells([27,27]);assert.equal(game.score,31);
});


test('a neighbor cleared by a sand sweep reacts automatically without another placement',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game(),formed:number[]=[];
 game.board[27]='stone';game.board[28]='water';game.board[20]='water';game.board[29]='lava';
 const settle=()=>reactions.schedule();
 const sweeps=new SandSweeps(game,()=>{},settle);
 const reactions=new StoneReactions(game,cell=>{formed.push(cell);sweeps.schedule();},settle);
 sweeps.schedule();settle();
 t.mock.timers.tick(500); // Initial stone is buried.
 t.mock.timers.tick(280); // Its neighbor 28 becomes empty between water and lava.
 assert.equal(game.board[28],null);assert.equal(game.canFormStone(28),true);assert.equal(reactions.busy,true);
 t.mock.timers.tick(499);assert.equal(game.board[28],null);
 t.mock.timers.tick(1);assert.equal(game.board[28],'stone');assert.ok(formed.includes(28));
 // Keep resolving with no player input: there must be no stranded candidates.
 for(let i=0;i<30;i++)t.mock.timers.tick(100);
 assert.equal(game.stoneCandidates().length,0);assert.equal(reactions.busy,false);assert.equal(sweeps.busy,false);
 reactions.dispose();sweeps.dispose();
});


test('successive reaction waves multiply the entire chain exactly once',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const game=new Game(),depths:number[]=[];
 game.board[26]='water';game.board[28]='lava';game.board[20]='water';game.board[29]='lava';game.board[21]='water';
 const settle=()=>{reactions.schedule();if(!reactions.busy&&!sweeps.busy)game.finishChain();};
 const sweeps=new SandSweeps(game,(_,__,___,depth)=>reactions.schedule(depth+1),settle);
 const reactions=new StoneReactions(game,cell=>{depths.push(game.stoneDepth[cell]);sweeps.schedule();},settle);
 reactions.schedule();
 for(let i=0;i<50;i++)t.mock.timers.tick(100);
 assert.deepEqual(depths,[1,2]);
 // Two creations (40), two stones and four elemental clears (60), doubled.
 assert.equal(game.score,200);assert.equal(game.combo,0);assert.equal(game.chainPoints,0);
 assert.equal(game.finishChain(),0);assert.equal(game.score,200);
 reactions.dispose();sweeps.dispose();
});
test('simultaneous stones stay at x1; placement points and previous score are not multiplied',()=>{
 const game=new Game();game.score=100;
 game.board[26]='water';game.board[28]='lava';game.board[10]='water';game.board[12]='lava';
 game.formStone(27);game.formStone(11);assert.equal(game.combo,1);
 game.inventory[0]={tile:'water',shape:single};game.place(0,0);
 game.clearCells([27,11]);assert.equal(game.finishChain(),0);assert.equal(game.score,161);
 for(const depth of [1,2,3,4]){game.board[27]=null;game.formStone(27,depth);}
 game.clearCells([27]);assert.equal(game.combo,4);assert.equal(game.score,521);assert.equal(game.finishChain(),0);
 assert.equal(game.score,521);
 game.restart();assert.equal(game.combo,0);assert.equal(game.chainPoints,0);assert.ok(game.stoneDepth.every(d=>d===0));
});
