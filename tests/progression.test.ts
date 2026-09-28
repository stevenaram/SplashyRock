import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {Progression,PROGRESS_KEY,largestConnection} from '../src/progression';
import {REVIVE_COST} from '../src/gems';
const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
const normal={calm:true,allowCleanBoard:false};
test('pet quests credit actual hatches, pay once, and persist wallet and next goals',()=>{
 const storage=memory(),p=new Progression(storage,()=>0),g=new Game();
 const pet=new PetMotion(27,'water',g.board,()=>{});pet.startHatch();g.pets.push(pet);
 assert.equal(p.observe(g,normal).length,0);pet.update(1.8);
 assert.deepEqual(p.observe(g,normal).map(a=>a.id),['pet-1']);assert.equal(p.gems,5);
 assert.equal(p.observe(g,normal).length,0);
 const reload=new Progression(storage,()=>.9);assert.equal(reload.gems,5);assert.equal(reload.active().find(a=>a.family==='pets')!.target,2);
 g.restart();g.pets.push(new PetMotion(27,'lava',g.board,()=>{}));assert.equal(reload.observe(g,normal).length,0);
});
test('combo milestones catch up once while only the next target is listed',()=>{
 const p=new Progression(memory()),g=new Game();g.maxCombo=5;
 const awards=p.observe(g,normal);assert.deepEqual(awards.map(a=>a.id),['combo-2','combo-3','combo-4','combo-5']);assert.equal(p.gems,12);
 assert.equal(p.active().filter(a=>a.family==='combo').length,1);assert.equal(p.active().find(a=>a.family==='combo')!.target,6);
 assert.equal(p.observe(g,normal).length,0);
});
test('connections are orthogonal and do not wrap rows or join diagonal groups',()=>{
 const g=new Game();g.board[7]='water';g.board[8]='water';g.board[17]='water';
 assert.equal(largestConnection(g.board,'water'),1);g.board[16]='water';assert.equal(largestConnection(g.board,'water'),3);
});
test('connection quests alternate and require a qualifying new connection while active',()=>{
 const storage=memory(),p=new Progression(storage,()=>0),g=new Game();
 for(let c=0;c<8;c++)g.board[c]='water';for(let c=24;c<32;c++)g.board[c]='lava';g.boardChange++;
 assert.deepEqual(p.observe(g,normal).map(a=>a.id),['network-0']);assert.match(p.active().find(a=>a.family==='network')!.description,/8 lava/);
 assert.equal(p.observe(g,normal).length,0);
 g.board[50]='water';g.boardChange++;assert.equal(p.observe(g,normal).length,0);
 g.board[40]='lava';g.boardChange++;assert.equal(p.observe(g,normal).length,0); // unrelated new lava
 g.board[32]='lava';g.boardChange++;assert.deepEqual(p.observe(g,normal).map(a=>a.id),['network-1']);
 assert.match(new Progression(storage,()=>.9).active().find(a=>a.family==='network')!.description,/16 water/);
});
test('clean-board achievement excludes tutorial, idle empty boards, and revive effects',()=>{
 const p=new Progression(memory()),g=new Game();
 assert.equal(p.observe(g,{calm:true,allowCleanBoard:true}).length,0);
 g.board[0]='lava';g.clearCells([0]);
 assert.equal(p.observe(g,normal).length,0);
 assert.equal(p.observe(g,{calm:false,allowCleanBoard:true}).length,0);
 assert.equal(p.observe(g,{calm:true,allowCleanBoard:true,suppressed:true}).length,0);
 assert.deepEqual(p.observe(g,{calm:true,allowCleanBoard:true}).map(a=>a.id),['clean-slate']);
 assert.equal(p.gems,10);assert.equal(p.observe(g,{calm:true,allowCleanBoard:true}).length,0);
});
test('wallet spends exactly ten gems once and cannot overspend or accept invalid amounts',()=>{
 const storage=memory(),p=new Progression(storage),g=new Game();g.maxCombo=5;p.observe(g,normal);
 assert.equal(p.spend(REVIVE_COST),true);assert.equal(p.gems,2);assert.equal(p.spend(REVIVE_COST),false);assert.equal(p.spend(-10),false);assert.equal(p.spend(.5),false);
 assert.equal(new Progression(storage).gems,2);
});
test('corrupt or blocked storage does not break progression',()=>{
 const storage=memory();storage.setItem(PROGRESS_KEY,'not json');const p=new Progression(storage);assert.equal(p.gems,0);
 const blocked=new Progression({getItem(){throw Error();},setItem(){throw Error();}});const g=new Game();g.maxCombo=2;blocked.observe(g,normal);assert.equal(blocked.gems,3);assert.equal(blocked.observe(g,normal).length,0);
});
