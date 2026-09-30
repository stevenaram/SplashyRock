import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {planPetLandings} from '../src/pet-placement-plan';
const piece:Piece={tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}};
const add=(g:Game,c:number,e:'water'|'lava')=>{const p=new PetMotion(c,e,g.board,cell=>{g.board[cell]=e;return true;},()=>0,undefined,()=>g.pets);g.pets.push(p);return p;};
test('matching pets use the inner ring and opposite pets have safe distinct outer targets',()=>{
 const g=new Game();add(g,0,'water');add(g,7,'water');add(g,56,'lava');add(g,63,'lava');
 const plan=planPetLandings(g,piece,27);assert.equal(plan.length,4);assert.equal(new Set(plan.map(p=>p.cell)).size,4);
 const d=(a:number,b:number)=>Math.abs(a%8-b%8)+Math.abs(Math.floor(a/8)-Math.floor(b/8));
 for(const p of plan){assert.equal(g.board[p.cell],null);if(p.element==='water')assert.equal(d(p.cell,27),1);else{assert.ok(d(p.cell,27)>=2);for(const w of plan.filter(p=>p.element==='water'))assert.ok(d(p.cell,w.cell)>1);}}
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
test('blocked planned destinations fall back without losing the queued action',()=>{
 const g=new Game(),p=add(g,0,'water');p.queueAbility(4,28);g.board[28]='lava';p.update(.01);assert.notEqual(p.next,28);assert.equal(p.queued,1);
});

test('busy pets retain a second planned destination until their earlier jump completes',()=>{
 const g=new Game(),p=add(g,0,'water');p.queueAbility(1,1);p.update(.1);p.queueAbility(2,28);
 p.update(.45);assert.equal(g.board[1],'water');assert.equal(p.plannedLanding,28);
 p.update(2);assert.equal(g.board[28],'water');assert.equal(p.abilitiesUsed,2);assert.equal(p.queued,0);
});
