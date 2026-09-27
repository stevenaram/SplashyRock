import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PetMotion} from '../src/pet-motion';
import {Game,type Tile} from '../src/game';
const board=()=>Array<Tile|null>(64).fill(null);
test('pet wanders continuously at linear speed without abilities or trails',()=>{
 const b=board();let planted=0;const p=new PetMotion(27,'lava',b,()=>planted++,()=>0);
 p.update(.2);const x=p.x,y=p.y;p.update(.2);assert.ok(Math.abs((p.x-3)-2*(x-3))<1e-8);assert.ok(Math.abs((p.y-3)-2*(y-3))<1e-8);
 p.update(30);assert.ok(p.completed>3);assert.equal(planted,0);assert.ok(b.every(t=>t===null));assert.equal(p.busy,false);
});
for(const element of ['water','lava'] as const)test(`${element} avoids opposite tiles AND opposite neighbor sand while allowing own elements`,()=>{
 const b=board();b[2]=element==='lava'?'water':'lava';b[8]=element;const p=new PetMotion(0,element,b,()=>{},()=>0);p.update(.1);assert.equal(p.next,8);
 for(let i=0;i<500;i++){p.update(.1);assert.notEqual(p.cell,1);assert.notEqual(p.cell,2);assert.notEqual(p.cell,3);assert.notEqual(p.cell,10);}
});
test('ready ability finishes the already selected step before charging and planting',()=>{
 const b=board(),planted:number[]=[];const p=new PetMotion(27,'lava',b,c=>{b[c]='lava';planted.push(c);},()=>0);
 p.update(.2);const destination=p.next!;p.queueAbility();assert.equal(p.next,destination);p.update(.1);assert.equal(planted.length,0);
 while(p.completed===0)p.update(.01);assert.equal(p.cell,destination);assert.equal(planted.length,0);
 p.update(.31);assert.deepEqual(planted,[destination]);assert.equal(p.queued,0);
});
test('ability on own element seeks nearest reachable sand; multiple abilities are preserved',()=>{
 const b=Array<Tile|null>(64).fill('lava');b[2]=null;b[18]=null;const planted:number[]=[];
 const p=new PetMotion(0,'lava',b,c=>{b[c]='lava';planted.push(c);},()=>0);p.queueAbility();p.queueAbility();p.update(15);
 assert.deepEqual(planted,[2,18]);assert.equal(p.queued,0);
});
test('no target retains an ability without keeping game over waiting indefinitely',()=>{
 const b=Array<Tile|null>(64).fill('lava');const p=new PetMotion(0,'lava',b,()=>assert.fail(),()=>0);p.queueAbility();p.update(.1);
 // Can be moving, but the current move is not a reason to wait forever.
 p.update(5);assert.equal(p.queued,1);assert.equal(p.busy,false);
});
test('changed destination retreats without planting onto unsafe neighbor sand',()=>{
 const b=board();let planted=0;const p=new PetMotion(0,'water',b,()=>planted++,()=>0);p.update(.4);assert.equal(p.next,1);b[2]='lava';p.queueAbility();p.update(.2);assert.ok(p.x<.34);assert.equal(planted,0);
});
test('a newly filled cell during charge does not consume or overwrite the ability',()=>{
 const b=board();const p=new PetMotion(27,'water',b,c=>{b[c]='water';return true;},()=>0);p.queueAbility();p.update(.1);b[27]='water';p.update(.25);assert.equal(p.queued,1);p.update(5);assert.equal(p.queued,0);
});
test('pet placement itself does not grant an ability; planting does not grant another one',()=>{
 const g=new Game(()=>.2);const shape={id:'single',name:'single',width:1,height:1,cells:[[0,0] as const]};g.inventory=[{tile:'pet',petElement:'water',shape},null,null];g.place(0,27);assert.equal(g.pet?.queued,0);g.pet!.queueAbility();g.pet!.update(.35);assert.equal(g.board[27],'water');assert.equal(g.pet?.queued,0);assert.deepEqual(g.petTileEvents,[27]);g.restart();assert.equal(g.pet,null);
});

test('swimming follows the actual liquid under the pet and switches at tile boundaries',()=>{
 for(const element of ['water','lava'] as const){const b=board(),p=new PetMotion(0,element,b,()=>{},()=>0);assert.equal(p.onOwnLiquid,false);b[1]=element;p.x=.49;assert.equal(p.onOwnLiquid,false);p.x=.51;assert.equal(p.onOwnLiquid,true);b[1]=element==='water'?'lava':'water';assert.equal(p.onOwnLiquid,false);b[1]=null;assert.equal(p.onOwnLiquid,false);}
});
