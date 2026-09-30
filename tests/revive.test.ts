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
test('revive is unavailable in a live run, or a won run, but can overwrite empty sand',()=>{
 const g=new Game();g.board[27]='water';assert.deepEqual(g.beginRevive(),[]);g.over=true;g.won=true;assert.deepEqual(g.beginRevive(),[]);g.won=false;g.board.fill(null);assert.deepEqual(g.beginRevive(),[27,28,35,36]);
});
