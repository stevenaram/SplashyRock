import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {Aftermath} from '../src/aftermath';
import {BossSpawnQueue} from '../src/boss-spawns';
import {StoneReactions,SandSweeps} from '../src/reactions';
function fixture(){const g=new Game();for(const c of [0,1,2,8,9,10,16,17,18])g.board[c]='water';g.pets.push(new PetMotion(63,'lava',g.board,()=>{}));return g;}
test('new placements do not extend an existing boss spawn fence',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=fixture(),q=new BossSpawnQueue(g),old=new Aftermath(()=>{}),later=new Aftermath(()=>{});
 q.update([old]);old.release();t.mock.timers.tick(250);q.update([old,later]);assert.equal(g.bosses.length,0);
 old.retain();t.mock.timers.tick(500);q.update([old,later]);assert.equal(g.bosses.length,0);
 old.release();t.mock.timers.tick(500);q.update([later]);assert.equal(g.bosses.length,1);assert.equal(later.finished,false);later.cancel();
});
test('destroyed qualifying area cancels its queue; a later area takes a new snapshot',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=fixture(),q=new BossSpawnQueue(g),a=new Aftermath(()=>{}),b=new Aftermath(()=>{});
 q.update([a]);g.board[0]=null;q.update([a]);a.cancel();g.board[0]='water';q.update([b]);assert.equal(g.bosses.length,0);
 b.release();t.mock.timers.tick(500);q.update([]);assert.equal(g.bosses.length,1);
});
test('unowned pet reactions retain their fence through stone burial and neighbor clearing',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=fixture(),q=new BossSpawnQueue(g);
 let reactions:StoneReactions;const sweeps=new SandSweeps(g,(_c,_o,_p,d,owner)=>reactions.schedule(d+1,owner),()=>{});
 reactions=new StoneReactions(g,(_c,owner)=>sweeps.schedule(owner));
 g.board[58]='water';g.board[60]='lava';reactions.schedule();const fence=reactions.activeAftermaths;q.update(fence);
 t.mock.timers.tick(500);q.update(sweeps.activeAftermaths);assert.equal(g.bosses.length,0);
 t.mock.timers.tick(500);q.update(sweeps.activeAftermaths);assert.equal(g.bosses.length,0);
 t.mock.timers.tick(280);q.update([]);assert.equal(g.bosses.length,0);
 t.mock.timers.tick(500);q.update([]);assert.equal(g.bosses.length,1);reactions.dispose();sweeps.dispose();
});
