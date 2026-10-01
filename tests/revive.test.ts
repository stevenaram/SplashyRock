import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {SandSweeps} from '../src/reactions';
test('revive replaces only the center 2×2 tiles, keeps inventory and pets, and does not queue abilities',()=>{
 const g=new Game();g.board[27]='lava';g.board[28]='water';g.over=true;g.score=123;
 const inventory=[...g.inventory],pet=new PetMotion(0,'lava',g.board,()=>{});g.pets.push(pet);
 const cells=g.beginRevive();assert.deepEqual(new Set(cells),new Set([27,28,35,36]));
 assert.ok(cells.every(c=>g.board[c]==='stone'));assert.deepEqual(g.inventory,inventory);assert.equal(g.score,123);assert.equal(pet.queued,0);assert.equal(g.over,true);
 assert.deepEqual(g.beginRevive(),[]);g.finishRevive();assert.equal(g.over,false);
});
test('revive clears only its central blast area with existing animation timing and no score or quest farming',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=new Game();g.board.fill('lava');g.over=true;g.score=500;g.tilesCleared=12;
 assert.equal(g.beginRevive().length,4);const sweeps=new SandSweeps(g,()=>{},()=>{});sweeps.schedule();
 t.mock.timers.tick(500);assert.equal(g.board.filter(Boolean).length,60);assert.equal(sweeps.busy,true);
 t.mock.timers.tick(280);assert.equal(sweeps.busy,false);assert.equal(g.board.filter(Boolean).length,52);
 const cleared=[19,20,26,27,28,29,34,35,36,37,43,44];assert.deepEqual(g.board.flatMap((v,i)=>v===null?[i]:[]),cleared);assert.equal(g.score,500);assert.equal(g.tilesCleared,12);assert.equal(g.maxCombo,0);
 g.finishRevive();assert.equal(g.over,false);
});
test('revive remains available after losing while sailing, and can overwrite empty sand',()=>{
 const g=new Game();g.board[27]='water';assert.deepEqual(g.beginRevive(),[]);g.won=true;assert.deepEqual(g.beginRevive(),[]);g.over=true;g.board.fill(null);assert.deepEqual(g.beginRevive(),[27,28,35,36]);g.finishRevive();assert.equal(g.over,false);assert.equal(g.won,true);
});
test('revive expands once when any shape still fails, even if another shape fits',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=new Game();g.board.fill('lava');g.over=true;
 const single={tile:'water' as const,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]}};
 const long={tile:'lava' as const,shape:{id:'long',name:'Long',width:5,height:1,cells:Array.from({length:5},(_,x)=>[x,0] as const)}};
 g.inventory=[single,long];const inventory=[...g.inventory];g.beginRevive();const sweeps=new SandSweeps(g,()=>{},()=>{});sweeps.schedule();t.mock.timers.tick(500);t.mock.timers.tick(280);
 assert.equal(sweeps.busy,false);assert.ok(g.pieceFits(single));assert.equal(g.pieceFits(long),false);
 const extra=g.expandReviveIfNeeded();assert.equal(extra.length,16);assert.ok(extra.every(c=>g.board[c]==='stone'));assert.equal(g.reviving,true);
 assert.deepEqual(g.expandReviveIfNeeded(),[]);sweeps.schedule();t.mock.timers.tick(500);t.mock.timers.tick(280);
 assert.ok(g.pieceFits(long));g.finishRevive();assert.equal(g.over,false);assert.deepEqual(g.inventory,inventory);assert.equal(g.score,0);
});
test('no expanded revive when all shapes fit, or when only eggs remain',()=>{
 const g=new Game();g.over=true;g.beginRevive();g.inventory=[{tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}}];assert.deepEqual(g.expandReviveIfNeeded(),[]);
 g.board.fill('lava');g.inventory=[{tile:'pet',shape:{id:'egg',name:'Egg',width:1,height:1,cells:[[0,0]]}}];assert.deepEqual(g.expandReviveIfNeeded(),[]);
});
test('expanded revive preserves permanent forge centers',()=>{
 const g=new Game();g.board.fill('lava');g.over=true;g.beginRevive();g.board[18]='forge';g.forges.set(18,{bricks:4,cycles:2});
 g.inventory=[{tile:'water',shape:{id:'long',name:'Long',width:5,height:1,cells:Array.from({length:5},(_,x)=>[x,0] as const)}}];
 const extra=g.expandReviveIfNeeded();assert.equal(extra.length,15);assert.equal(g.board[18],'forge');assert.equal(g.forges.get(18)!.bricks,4);
});
