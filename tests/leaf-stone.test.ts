import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {SandSweeps} from '../src/reactions';
test('leaf stone clears its cross liquids and obsidian but preserves bushes and diagonal cells',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=new Game();g.board[26]='water';g.board[28]='lava';g.board[19]='obsidian';g.board[35]='bush';g.bushes.set(35,{phase:'healthy',berries:3,reserved:0});g.board[18]='lava';
 assert.equal(g.formLeafStone(27,'lava'),true);const s=new SandSweeps(g,()=>{},()=>{});s.schedule();
 t.mock.timers.tick(500);assert.equal(g.board[27],null);assert.equal(g.board[26],'water');
 t.mock.timers.tick(280);for(const c of [19,26,28])assert.equal(g.board[c],null);assert.equal(g.board[35],'bush');assert.equal(g.bushes.get(35)!.berries,3);assert.equal(g.board[18],'lava');assert.equal(s.busy,false);s.dispose();
});
