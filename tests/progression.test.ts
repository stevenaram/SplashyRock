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
test('wallet spends exactly twenty gems once and cannot overspend or accept invalid amounts',()=>{
 const storage=memory(),p=new Progression(storage),g=new Game();g.maxCombo=8;p.observe(g,normal);
 assert.equal(p.spend(REVIVE_COST),true);assert.equal(p.gems,1);assert.equal(p.spend(REVIVE_COST),false);assert.equal(p.spend(-10),false);assert.equal(p.spend(.5),false);
 assert.equal(new Progression(storage).gems,1);
});
test('corrupt or blocked storage does not break progression',()=>{
 const storage=memory();storage.setItem(PROGRESS_KEY,'not json');const p=new Progression(storage);assert.equal(p.gems,0);
 const blocked=new Progression({getItem(){throw Error();},setItem(){throw Error();}});const g=new Game();g.maxCombo=2;blocked.observe(g,normal);assert.equal(blocked.gems,3);assert.equal(blocked.observe(g,normal).length,0);
});
test('test gems fund revives without modifying persistent wallets',()=>{
 const p=new Progression();assert.equal(p.addTestGems(20),true);assert.equal(p.gems,20);assert.equal(p.spend(REVIVE_COST),true);assert.equal(p.gems,0);
 for(const amount of [0,-1,1.5,NaN,Infinity,1000001])assert.equal(p.addTestGems(amount),false);
 const saved=new Progression(memory());assert.equal(saved.addTestGems(100),false);assert.equal(saved.gems,0);
});

test('boss summons and simultaneous fights pay once; deaths count after animation across runs',()=>{
 const storage=memory(),p=new Progression(storage),g=new Game();
 const spawn=()=>{
  g.pets.push(new PetMotion(56,'water',g.board,()=>{}),new PetMotion(57,'lava',g.board,()=>{}));
  for(let i=0;i<9;i++){g.board[i%3+Math.floor(i/3)*8]='water';g.board[36+i%3+Math.floor(i/3)*8]='lava';}
  g.boardChange++;g.trySpawnBoss();
 };
 spawn();let awards=p.observe(g,normal);
 for(const id of ['boss-summon-water','boss-summon-lava','boss-dual'])assert.ok(awards.some(a=>a.id===id));
 assert.equal(p.observe(g,normal).length,0);
 g.clearCells([...g.bosses.find(b=>b.element==='water')!.remaining]);
 assert.ok(!p.observe(g,normal).some(a=>a.id==='boss-defeat-water-1'));
 g.updateBoss(3.1);assert.ok(p.observe(g,normal).some(a=>a.id==='boss-defeat-water-1'));
 for(let run=0;run<4;run++){
  g.restart();spawn();p.observe(g,normal);
  g.clearCells([...g.bosses.find(b=>b.element==='water')!.remaining]);g.updateBoss(3.1);awards=p.observe(g,normal);
 }
 assert.ok(awards.some(a=>a.id==='boss-defeat-water-5'));
 const reload=new Progression(storage);assert.equal(reload.gems,p.gems);
 const next=reload.active().find(a=>a.family==='boss-water')!;assert.equal(next.target,10);assert.equal(next.progress,5);
 assert.equal(reload.observe(g,normal).filter(a=>a.id.startsWith('boss-')).length,0);
});
test('score achievements catch up on score-only updates and never combine separate runs',()=>{
 const storage=memory(),p=new Progression(storage),g=new Game();p.observe(g,normal);
 g.score=50000;assert.deepEqual(p.observe(g,normal).map(a=>a.id),['score-50000']);
 g.restart();g.score=60000;assert.equal(p.observe(g,normal).length,0);
 g.score=2000000;const awards=p.observe(g,normal).filter(a=>a.family==='score');
 assert.deepEqual(awards.map(a=>a.target),[100000,250000,500000,1000000,2000000]);
 const reload=new Progression(storage);assert.equal(reload.observe(g,normal).length,0);
 assert.equal(reload.active().find(a=>a.family==='score')!.target,5000000);
});
test('legacy saves retain wallet and awards while new boss fields default safely',()=>{
 const storage=memory();storage.setItem(PROGRESS_KEY,JSON.stringify({gems:42,completed:['pet-1'],petBest:1,first:'lava'}));
 const p=new Progression(storage);assert.equal(p.gems,42);assert.ok(p.completed().some(a=>a.id==='pet-1'));
 assert.equal(p.active().find(a=>a.family==='boss-water')!.progress,0);
 const g=new Game();g.bossAchievementEvents.push({kind:'defeat',element:'water'});
 assert.equal(p.observe(g,{...normal,suppressed:true}).length,0);
 assert.equal(p.observe(g,normal).length,0);
});
test('feature milestones persist across runs, pay once, and show only the next goal per track',()=>{
 const storage=memory(),p=new Progression(storage),g=new Game();
 g.featureAchievementEvents={'berries-grown':40,'obsidian-cleared':10};
 const awards=p.observe(g,normal);assert.deepEqual(awards.map(a=>a.id),['berries-grown-4','berries-grown-40','obsidian-cleared-1','obsidian-cleared-10']);
 assert.equal(p.gems,16);assert.deepEqual(g.featureAchievementEvents,{});assert.deepEqual(p.observe(g,normal),[]);
 g.restart();const restored=new Progression(storage);
 assert.equal(restored.gems,16);assert.equal(restored.active().filter(a=>a.family==='berries-grown').length,1);
 assert.equal(restored.active().find(a=>a.family==='berries-grown')!.progress,40);
 g.featureAchievementEvents={'berries-grown':160};assert.deepEqual(restored.observe(g,normal).map(a=>a.id),['berries-grown-200']);
 assert.equal(restored.gems,26);
});
test('old saves retain gems and completions while initializing feature counters safely',()=>{
 const storage=memory();storage.setItem(PROGRESS_KEY,JSON.stringify({gems:200,completed:['pet-1'],petBest:1,features:{'berries-grown':-99,'obsidian-cleared':'bad'}}));
 const p=new Progression(storage);assert.equal(p.gems,200);assert.ok(p.completed().some(a=>a.id==='pet-1'));
 assert.equal(p.active().find(a=>a.family==='berries-grown')!.progress,0);
 assert.equal(p.active().find(a=>a.family==='obsidian-cleared')!.progress,0);
});
test('suppressed feature events are consumed without leaking into future rewards',()=>{
 const p=new Progression(memory()),g=new Game();g.featureAchievementEvents={'obsidian-cleared':100};
 assert.deepEqual(p.observe(g,{...normal,suppressed:true}),[]);assert.deepEqual(p.observe(g,normal),[]);assert.equal(p.gems,0);
});
test('legacy pet achievements above 16 retire without taking away earned gems',()=>{
 const storage=memory();storage.setItem(PROGRESS_KEY,JSON.stringify({gems:320,petBest:64,completed:Array.from({length:64},(_,i)=>`pet-${i+1}`)}));
 const p=new Progression(storage);assert.equal(p.gems,320);assert.ok(!p.active().some(a=>a.family==='pets'));
 const saved=JSON.parse(storage.getItem(PROGRESS_KEY)!);assert.equal(saved.petBest,16);assert.equal(saved.completed.filter((id:string)=>id.startsWith('pet-')).length,16);
});
