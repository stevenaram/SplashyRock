import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Aftermath} from '../src/aftermath';
import {Game} from '../src/game';
import {StoneReactions,SandSweeps} from '../src/reactions';
test('overlapping placements complete independently, after their own reactions and final animation',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=new Game(),done:string[]=[];
 const a=new Aftermath(()=>done.push('a')),b=new Aftermath(()=>done.push('b'));
 let reactions:StoneReactions;
 const sweeps=new SandSweeps(g,(_cells,_origin,_phase,depth,owner)=>reactions.schedule(depth+1,owner),()=>{});
 reactions=new StoneReactions(g,(_cell,owner)=>sweeps.schedule(owner));
 g.board[26]='water';g.board[28]='lava';reactions.schedule(1,a);a.release();
 t.mock.timers.tick(200);g.board[2]='water';g.board[4]='lava';reactions.schedule(1,b);b.release();
 t.mock.timers.tick(300);t.mock.timers.tick(200);t.mock.timers.tick(300);t.mock.timers.tick(200);t.mock.timers.tick(80);t.mock.timers.tick(200);
 assert.deepEqual(done,[]);t.mock.timers.tick(300);assert.deepEqual(done,['a']);t.mock.timers.tick(200);assert.deepEqual(done,['a','b']);reactions.dispose();sweeps.dispose();
});
test('an unrelated placement with no reactions finishes while an earlier chain continues',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const done:string[]=[],a=new Aftermath(()=>done.push('a')),b=new Aftermath(()=>done.push('b'));
 a.retain();a.release();b.release();t.mock.timers.tick(500);assert.deepEqual(done,['b']);a.release();t.mock.timers.tick(500);assert.deepEqual(done,['b','a']);
});
test('descendant work extends its own ticket and replay cancels pending rewards',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let done=0;const a=new Aftermath(()=>done++);a.release();t.mock.timers.tick(250);a.retain();t.mock.timers.tick(500);assert.equal(done,0);a.release();a.cancel();t.mock.timers.tick(1000);assert.equal(done,0);
});
