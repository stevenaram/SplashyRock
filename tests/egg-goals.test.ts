import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EGG_GOALS,earnedEggs,MAX_PETS} from '../src/egg-goals';
import {PetMotion} from '../src/pet-motion';
import {Game,type Piece} from '../src/game';
const shape={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
const egg:Piece={tile:'pet',petElement:'water',shape};
function deal(g:Game){g.inventory=[{tile:'water',shape},null,null];g.board[0]=null;g.place(0,0);g.board[0]=null;}
test('egg milestones grow the incremental requirement by 1.2 with exact early targets',()=>{
 assert.deepEqual(EGG_GOALS.slice(0,5),[5000,11000,18200,26840,37208]);assert.equal(EGG_GOALS.length,64);
 EGG_GOALS.forEach((goal,i)=>{assert.ok(Number.isSafeInteger(goal));if(i)assert.ok(goal>EGG_GOALS[i-1]);});
 assert.equal(earnedEggs(4999),0);assert.equal(earnedEggs(5000),1);assert.equal(earnedEggs(26840),4);assert.equal(earnedEggs(Number.MAX_SAFE_INTEGER),64);
});
test('large score jumps immediately preserve every egg without replacing shapes',()=>{
 const g=new Game(()=>.2),original=[...g.inventory];g.score=26840;
 assert.equal(g.claimEggRewards(),4);assert.equal(g.inventory.length,7);
 assert.deepEqual(g.inventory.slice(0,3),original);assert.equal(g.rewardsDealt,4);
 assert.equal(g.claimEggRewards(),0);assert.equal(g.inventory.filter(p=>p?.tile==='pet').length,4);
});
test('five pets keep independent abilities and can plant five tiles',()=>{
 const g=new Game(()=>.2);for(const cell of [0,7,27,56,63]){g.inventory=[egg,null,null];assert.ok(g.place(0,cell));}
 assert.equal(g.pets.length,5);g.pets.forEach(p=>{p.update(1.8);assert.equal(p.queued,0);p.queueAbility();});g.pets.forEach(p=>p.update(.1));g.pets.forEach(p=>p.update(.401));
 assert.equal(g.board.filter(Boolean).length,5);assert.ok(g.pets.every(p=>p.queued===0));
});
test('competing pets never overwrite each other and retain an ability until they find another cell',()=>{
 const g=new Game(()=>.2);for(let i=0;i<2;i++){const pet=new PetMotion(27,'water',g.board,c=>g.plantPetTile(c,'water'),()=>.2,()=>g.boardChange);pet.startHatch();g.pets.push(pet);}
 g.pets.forEach(p=>{p.update(1.8);p.queueAbility();});g.pets.forEach(p=>p.update(.1));g.pets.forEach(p=>p.update(.401));assert.equal(g.board.filter(Boolean).length,1);assert.equal(g.pets[1].queued,1);
 for(let i=0;i<200;i++)g.pets.forEach(p=>p.update(.05));assert.equal(g.board.filter(Boolean).length,2);assert.ok(g.pets.every(p=>p.queued===0));
});
test('victory requires all 64 eggs to hatch, caps further eggs, and restart resets the entire collection',()=>{
 const g=new Game();for(let i=0;i<MAX_PETS;i++){g.inventory=[egg,null,null];assert.ok(g.place(0,i));}
 assert.equal(g.finishIfWon(),false);assert.equal(g.canPlace(egg,0),false);g.pets.forEach(p=>p.update(1.8));assert.equal(g.finishIfWon(),true);assert.equal(g.over,true);
 g.restart();assert.equal(g.won,false);assert.equal(g.pets.length,0);assert.equal(g.rewardsDealt,0);assert.equal(g.earnedEggs,0);
});
