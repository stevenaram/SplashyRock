import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EGG_GOALS,earnedEggs,MAX_PETS} from '../src/egg-goals';
import {PetMotion} from '../src/pet-motion';
import {Game,type Piece} from '../src/game';
const shape={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
const egg:Piece={tile:'pet',petElement:'water',shape};
function deal(g:Game){g.inventory=[{tile:'water',shape},null,null];g.board[0]=null;g.place(0,0);g.board[0]=null;}
test('egg milestones grow the incremental requirement by 1.1 from a 3000-score first egg',()=>{
 assert.deepEqual(EGG_GOALS.slice(0,5),[3000, 6300, 9930, 13923, 18315]);assert.equal(EGG_GOALS.length,64);assert.equal(EGG_GOALS[63],13343747);
 assert.equal(earnedEggs(13343746),63);assert.equal(earnedEggs(13343747),64);
 EGG_GOALS.forEach((goal,i)=>{assert.ok(Number.isSafeInteger(goal));if(i)assert.ok(goal>EGG_GOALS[i-1]);});
 assert.equal(earnedEggs(2999),0);assert.equal(earnedEggs(3000),1);assert.equal(earnedEggs(EGG_GOALS[3]),4);assert.equal(earnedEggs(Number.MAX_SAFE_INTEGER),64);
});
test('large score jumps immediately preserve every egg without replacing shapes',()=>{
 const g=new Game(()=>.2),original=[...g.inventory];g.score=EGG_GOALS[3];
 assert.equal(g.claimEggRewards(),4);assert.equal(g.inventory.length,4);
 assert.deepEqual(g.inventory.slice(0,3),original);assert.equal(g.rewardsDealt,4);assert.equal(g.inventory[3]?.eggCount,4);
 assert.equal(g.claimEggRewards(),0);assert.equal(g.inventory.filter(p=>p?.tile==='pet').length,1);
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

test('stacked eggs consume one per placement and additional rewards join the same slot',()=>{
 const g=new Game(()=>.2);g.score=EGG_GOALS[2];g.claimEggRewards();
 const slot=g.inventory.findIndex(p=>p?.tile==='pet');
 g.board[0]='water';assert.equal(g.place(slot,0),false);assert.equal(g.inventory[slot]?.eggCount,3);g.board[0]=null;
 assert.ok(g.place(slot,0));assert.equal(g.inventory[slot]?.eggCount,2);assert.equal(g.pets.length,1);
 g.score=EGG_GOALS[3];g.claimEggRewards();assert.equal(g.inventory[slot]?.eggCount,3);assert.equal(g.inventory.length,4);
 for(const remaining of [2,1,0]){assert.ok(g.place(slot,7));assert.equal(g.inventory[slot]?.eggCount??0,remaining);}
 assert.equal(g.pets.length,4);assert.notEqual(g.pets[0].element,g.pets[1].element);assert.ok(g.pets.every(p=>p.queued===0));
});
test('the final egg in a stack refills an otherwise exhausted inventory',()=>{
 const g=new Game();g.inventory=[{tile:'pet',shape,eggCount:2},null,null];
 g.place(0,0);assert.equal(g.inventory[0]?.eggCount,1);assert.equal(g.inventory[1],null);
 g.place(0,1);assert.equal(g.inventory.length,3);assert.ok(g.inventory.every(p=>p&&p.tile!=='pet'));
});

test('eggs do not prevent game over and can still hatch afterward without refilling or reviving',()=>{
 const g=new Game();g.inventory=[{...egg,eggCount:2},null,null];
 assert.equal(g.hasLegalMove(),false);assert.equal(g.finishIfBlocked(false),true);
 assert.equal(g.place(0,0),true);assert.equal(g.inventory[0]?.eggCount,1);assert.equal(g.over,true);
 assert.equal(g.place(0,1),true);assert.ok(g.inventory.every(p=>p===null));
 g.pets.forEach(p=>p.update(2));assert.equal(g.pets.length,2);assert.ok(g.pets.every(p=>p.hatchRemaining===0&&p.queued===0));assert.equal(g.over,true);assert.ok(g.board.every(t=>t===null));
});
test('an egg cannot rescue blocked shapes or be placed onto a full board after losing',()=>{
 const g=new Game();g.board.fill('water');g.board[0]=null;
 const large={tile:'lava' as const,shape:{id:'square',name:'Square',width:2,height:2,cells:[[0,0],[1,0],[0,1],[1,1]] as [number,number][]}};
 g.inventory=[large,egg];assert.equal(g.hasLegalMove(),false);assert.equal(g.finishIfBlocked(false),true);assert.equal(g.place(0,0),false);assert.equal(g.place(1,0),true);
 g.inventory=[egg];g.board[0]='water';assert.equal(g.place(0,0),false);
});
