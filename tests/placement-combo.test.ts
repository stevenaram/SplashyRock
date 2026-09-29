import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {PetMotion} from '../src/pet-motion';
import {Aftermath} from '../src/aftermath';
import {StoneReactions,SandSweeps} from '../src/reactions';
const piece={tile:'lava' as const,shape:{id:'one',name:'one',width:1,height:1,cells:[[0,0] as const]}};
function stone(g:Game,run:number,time:number,depth=1){g.board[26]='water';g.board[28]='lava';g.board[27]=null;assert.ok(g.formStone(27,depth,run,time));}
test('later pet waves increase multiplier while simultaneous stones are grouped',()=>{
 const g=new Game();stone(g,g.comboRun,0);g.clearCells([27]);stone(g,g.comboRun,100);assert.equal(g.combo,1);
 g.clearCells([27]);stone(g,g.comboRun,2000);g.clearCells([27]);assert.equal(g.combo,2);
 stone(g,g.comboRun,4000);g.clearCells([27]);assert.equal(g.combo,3);assert.equal(g.chainPoints,120);
 assert.equal(g.score,360);assert.equal(g.finishChain(),0);assert.equal(g.score,360);assert.equal(g.finishChain(),0);
});
test('only a successful shape placement interrupts the combo and stale aftermath earns base score',()=>{
 const g=new Game(),old=g.comboRun;stone(g,old,0);stone(g,old,1000);g.inventory=[piece];
 assert.equal(g.place(0,27),false);assert.equal(g.comboRun,old);
 assert.equal(g.place(0,0),true);assert.equal(g.score,81);assert.equal(g.combo,0);
 stone(g,old,2000,4);g.clearCells([27],old);assert.equal(g.combo,0);assert.equal(g.chainPoints,0);
 stone(g,g.comboRun,2500);assert.equal(g.combo,1);assert.equal(g.chainPoints,20);
});
test('egg placement does not interrupt the current shape combo',()=>{
 const g=new Game();stone(g,g.comboRun,0);const run=g.comboRun;
 g.inventory=[{tile:'pet',shape:piece.shape}];g.place(0,0);assert.equal(g.comboRun,run);assert.equal(g.combo,1);
});
test('queued abilities keep the originating placement id through later queues and cancellation',()=>{
 const b=Array(64).fill(null),runs:number[]=[];const p=new PetMotion(0,'lava',b,(c,run)=>{runs.push(run!);b[c]='lava';},()=>0);
 p.queueAbility(7);p.queueAbility(8);assert.ok(p.hasAbilityFor(7));p.update(4);
 assert.deepEqual(runs,[7,8]);assert.equal(p.hasAbilityFor(7),false);
 p.queueAbility(9);p.cancelAbilities();assert.equal(p.hasAbilityFor(9),false);
});
test('pet reaction ownership flows through delayed stone and both sweep phases',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const g=new Game();g.inventory=[piece];g.place(0,0);const old=g.comboRun;
 let reactions:StoneReactions;const sweeps=new SandSweeps(g,(_c,_o,_p,d,owner)=>reactions.schedule(d+1,owner),()=>{});
 reactions=new StoneReactions(g,(_c,owner)=>sweeps.schedule(owner));
 g.onPetPlacement=run=>{const a=new Aftermath(()=>{},run);reactions.schedule(1,a);a.release();};
 g.board[26]='water';g.plantPetTile(28,'lava',old);
 g.inventory=[piece];g.place(0,7);const score=g.score;
 t.mock.timers.tick(500);assert.equal(g.combo,0);t.mock.timers.tick(500);t.mock.timers.tick(280);
 assert.equal(g.chainPoints,0);assert.equal(g.score-score,50);reactions.dispose();sweeps.dispose();
});

test('live combo pays the running total and never awards it twice',()=>{
 const g=new Game();
 for(let i=0;i<50;i++){stone(g,g.comboRun,Math.floor(i*7/50)*1000);assert.equal(g.score,g.chainPoints*g.combo);}
 assert.equal(g.combo,7);assert.equal(g.chainPoints,1000);assert.equal(g.score,7000);
 for(let i=0;i<450;i++){stone(g,g.comboRun,7000+Math.floor(i*6/450)*1000);assert.equal(g.score,g.chainPoints*g.combo);}
 assert.equal(g.combo,13);assert.equal(g.chainPoints,10000);assert.equal(g.score,130000);
 assert.equal(g.finishChain(),0);assert.equal(g.score,130000);
 g.finishChain();assert.equal(g.score,130000);
 g.restart();stone(g,g.comboRun,0);stone(g,g.comboRun,1000);assert.equal(g.score,80);
});
test('live multiplied clears unlock eggs before the chain ends',()=>{
 const g=new Game();g.score=4890;
 stone(g,g.comboRun,0);stone(g,g.comboRun,1000);assert.equal(g.score,4970);
 g.board[26]='water';g.clearCells([26,27]);
 assert.equal(g.score,5010);assert.equal(g.earnedEggs,1);assert.ok(g.inventory.some(p=>p?.tile==='pet'));
 assert.equal(g.combo,2);assert.equal(g.finishChain(),0);assert.equal(g.score,5010);
});
