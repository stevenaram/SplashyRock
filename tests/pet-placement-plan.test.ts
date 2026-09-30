import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {isPureSand} from '../src/pet-sand';
import {planPetLandings} from '../src/pet-placement-plan';
const piece:Piece={tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}};
const add=(g:Game,c:number,e:'water'|'lava')=>{const p=new PetMotion(c,e,g.board,cell=>{g.board[cell]=e;return true;},()=>0,undefined,()=>g.pets);g.pets.push(p);return p;};
test('pure sand destinations alternate elements and stay stable when pets wander',()=>{
 const g=new Game();add(g,0,'water');add(g,7,'water');add(g,56,'lava');add(g,63,'lava');
 const plan=planPetLandings(g,piece,27);assert.equal(plan.length,4);assert.equal(new Set(plan.map(p=>p.cell)).size,4);
 const future=[...g.board];future[27]='water';
 for(const p of plan)assert.ok(isPureSand(future,p.cell));
 assert.deepEqual(plan.map(p=>p.element),['water','lava','water','lava']);
 g.pets.forEach(p=>{p.x=7-p.x;p.y=7-p.y;});
 planPetLandings(g,piece,36);
 assert.deepEqual(planPetLandings(g,piece,27).map(p=>p.cell),plan.map(p=>p.cell));
});
test('plans include busy pets but exclude blocked boards and eggs without changing game state',()=>{
 const g=new Game(),busy=add(g,0,'water');busy.queueAbility();add(g,7,'lava');
 assert.ok(planPetLandings(g,piece,27).some(p=>p.pet===busy));
 assert.deepEqual(planPetLandings(g,{...piece,tile:'pet'},27),[]);
 g.board[27]='lava';assert.deepEqual(planPetLandings(g,piece,27),[]);
});
test('committed destinations override nearest wandering targets and consume once',()=>{
 const g=new Game(),p=add(g,0,'water');p.queueAbility(4,28);p.update(.01);assert.equal(p.next,28);
 p.update(1.5);assert.equal(g.board[28],'water');assert.equal(p.abilitiesUsed,1);assert.equal(p.plannedLanding,undefined);
 p.queueAbility(5,29);p.cancelAbilities();assert.equal(p.plannedLanding,undefined);
});
test('blocked planned destinations wait without choosing an unshown fallback',()=>{
 const g=new Game(),p=add(g,0,'water');p.queueAbility(4,28);g.board[28]='lava';p.update(.01);assert.notEqual(p.next,28);assert.equal(p.leaping,false);assert.equal(p.queued,1);
});

test('busy pets retain a second planned destination until their earlier jump completes',()=>{
 const g=new Game(),p=add(g,0,'water');p.queueAbility(1,1);p.update(.1);p.queueAbility(2,28);
 p.update(.45);assert.equal(g.board[1],'water');assert.equal(p.plannedLanding,28);
 p.update(2);assert.equal(g.board[28],'water');assert.equal(p.abilitiesUsed,2);assert.equal(p.queued,0);
});

test('seven pets stack on the only pure sand destination; none trigger when it is unavailable',()=>{
 const g=new Game();g.board.fill('stone');g.board[0]=null;g.board[63]=null;
 for(let i=0;i<7;i++)add(g,i,i%2?'water':'lava');
 const plan=planPetLandings(g,piece,0);assert.equal(plan.length,7);assert.ok(plan.every(p=>p.cell===63));
 g.board[62]='water';assert.deepEqual(planPetLandings(g,piece,0),[]);
});
test('multiple pets sharing a destination wait and use only that tile after it clears',()=>{
 const g=new Game(),a=add(g,0,'water'),b=add(g,7,'lava');a.queueAbility(1,27);b.queueAbility(1,27);
 a.update(.1);b.update(.1);assert.ok(a.leaping);assert.equal(b.leaping,false);
 a.update(2);b.update(2);assert.equal(g.board[27],'water');assert.equal(b.queued,1);
 g.board[27]=null;b.update(2);assert.equal(g.board[27],'lava');assert.equal(b.queued,0);
});
