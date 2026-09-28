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
test('ready ability immediately leaps from its current visual position and plants on landing',()=>{
 const b=board(),planted:number[]=[];const p=new PetMotion(27,'lava',b,c=>{b[c]='lava';planted.push(c);},()=>0);
 p.update(.2);const x=p.x,y=p.y;p.queueAbility();p.update(.1);
 assert.equal(p.leaping,true);assert.equal(planted.length,0);assert.ok(Math.hypot(p.x-x,p.y-y)<1);
 p.update(.399);assert.equal(planted.length,0);p.update(.0011);
 assert.equal(planted.length,1);assert.equal(p.queued,0);assert.equal(p.leaping,false);
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
 const g=new Game(()=>.2);const shape={id:'single',name:'single',width:1,height:1,cells:[[0,0] as const]};g.inventory=[{tile:'pet',petElement:'water',shape},null,null];g.place(0,27);assert.equal(g.pet?.queued,0);g.pet!.queueAbility();g.pet!.update(.35);assert.equal(g.board[27],null);g.pet!.update(2);assert.equal(g.board[27],'water');assert.equal(g.pet?.queued,0);assert.deepEqual(g.petTileEvents,[27]);g.restart();assert.equal(g.pet,null);
});

test('swimming follows the actual liquid under the pet and switches at tile boundaries',()=>{
 for(const element of ['water','lava'] as const){const b=board(),p=new PetMotion(0,element,b,()=>{},()=>0);assert.equal(p.onOwnLiquid,false);b[1]=element;p.x=.49;assert.equal(p.onOwnLiquid,false);p.x=.51;assert.equal(p.onOwnLiquid,true);b[1]=element==='water'?'lava':'water';assert.equal(p.onOwnLiquid,false);b[1]=null;assert.equal(p.onOwnLiquid,false);}
});

test('hatching holds multiple earned abilities without walking or planting and drains them only after emergence',()=>{
 const b=board(),drops:number[]=[];const pet=new PetMotion(27,'lava',b,c=>{b[c]='lava';drops.push(c);},()=>0);pet.startHatch();pet.queueAbility();pet.update(.6);pet.queueAbility();pet.update(.6);pet.queueAbility();pet.update(.5);
 assert.equal(pet.cell,27);assert.equal(pet.completed,0);assert.equal(pet.queued,3);assert.deepEqual(drops,[]);assert.ok(pet.busy);
 pet.update(.7);assert.equal(drops.length,1);pet.update(15);assert.equal(drops.length,3);assert.equal(pet.queued,0);
});
test('an egg with no following placements hatches into a wandering pet without planting',()=>{
 const b=board();const pet=new PetMotion(27,'water',b,()=>assert.fail('egg earned an ability'),()=>0);pet.startHatch();pet.update(20);assert.equal(pet.hatchRemaining,0);assert.ok(pet.completed>0);assert.equal(pet.queued,0);
});

for(const element of ['lava','water'] as const){
 test(`${element} escapes opposite liquid and its shoreline at unchanged linear speed`,()=>{
  const b=board(),opposite=element==='lava'?'water':'lava';b[27]=opposite;
  const p=new PetMotion(27,element,b,()=>assert.fail('escape must not plant'),()=>0);
  p.update(.2);assert.equal(p.next,26);assert.ok(Math.abs(p.x-(3-.2*1.7/2))<1e-8);
  p.update(.2);assert.ok(Math.abs(p.x-(3-.4*1.7/2))<1e-8);
  p.update(2);assert.equal(p.cell,25);assert.equal(p.completed,2);
 });
 test(`${element} escapes a multi-tile hostile patch, preserving its queued ability`,()=>{
  const b=Array<Tile|null>(64).fill(element==='lava'?'water':'lava');b[0]=element;
  const p=new PetMotion(27,element,b,()=>assert.fail(),()=>0);p.queueAbility();
  assert.equal(p.busy,false);p.update(7.1);assert.equal(p.cell,0);assert.equal(p.queued,1);assert.equal(p.busy,false);
 });
}
test('escape reroutes after board changes without teleporting, accelerating or crossing stone',()=>{
 const b=board();b[27]='water';const p=new PetMotion(27,'lava',b,()=>{},()=>0);
 p.update(.4);const x=p.x;b[26]='stone';p.update(.2);assert.ok(Math.abs(p.x-x-.2*1.7/2)<1e-8);
 p.update(4);assert.notEqual(p.cell,26);assert.ok(p.completed>0);
});
test('a surrounded pet waits safely and resumes escaping when a route opens',()=>{
 const b=Array<Tile|null>(64).fill('water');let version=0;
 const p=new PetMotion(27,'lava',b,()=>{},()=>0,()=>version);p.queueAbility();p.update(10);
 assert.equal(p.cell,27);assert.equal(p.busy,false);
 b[26]='lava';version++;p.update(1.18);assert.equal(p.cell,26);
});
test('an invalidated landing does not overwrite liquid or spend the queued ability',()=>{
 const b=board();let planted=0;const p=new PetMotion(27,'lava',b,()=>planted++,()=>0);
 p.queueAbility();p.update(.1);b[27]='water';p.update(.401);
 assert.equal(p.queued,1);assert.equal(planted,0);assert.equal(b[27],'water');
 p.update(.8);assert.equal(planted,1);assert.equal(p.queued,0);
});

test('pets reserve distinct wandering destinations and can follow a departing pet',()=>{
 const b=board(),pets:PetMotion[]=[];
 const add=(cell:number)=>{const p=new PetMotion(cell,'lava',b,()=>{},()=>0,()=>0,()=>pets);pets.push(p);return p;};
 const first=add(0),second=add(2),follower=add(8);
 first.update(.1);assert.equal(first.next,1);
 second.update(.1);assert.notEqual(second.next,1);
 follower.update(.1);assert.equal(follower.next,0);
 const destinations=pets.map(p=>p.next??p.cell);assert.equal(new Set(destinations).size,pets.length);
});
test('hatching and charging pets hold their tiles against incoming pets',()=>{
 const b=board(),pets:PetMotion[]=[];
 const hatching=new PetMotion(1,'lava',b,()=>{},()=>0,()=>0,()=>pets);pets.push(hatching);hatching.startHatch();
 const walker=new PetMotion(0,'lava',b,()=>{},()=>0,()=>0,()=>pets);pets.push(walker);
 walker.update(.1);assert.notEqual(walker.next,1);
 hatching.hatchRemaining=0;hatching.queueAbility();hatching.update(.1);assert.equal(hatching.leaping,true);
 assert.notEqual(walker.next,hatching.cell);
});
test('equally nearest ability destinations vary with randomness',()=>{
 const destinations=new Set<number>();
 for(const random of [()=>0,()=>.3,()=>.6,()=>.99]){
  const b=Array<Tile|null>(64).fill('lava');for(const c of [19,26,28,35])b[c]=null;
  const p=new PetMotion(27,'lava',b,()=>{},random);p.queueAbility();p.update(.1);
  assert.ok([19,26,28,35].includes(p.next!));destinations.add(p.next!);
 }
 assert.ok(destinations.size>=3);
});
test('ability routing invalidates a cached choice when another pet reserves it',()=>{
 const b=Array<Tile|null>(64).fill('lava');b[1]=null;b[8]=null;const pets:PetMotion[]=[];
 const p=new PetMotion(0,'lava',b,()=>{},()=>0,()=>0,()=>pets);pets.push(p);p.queueAbility();assert.equal(p.busy,true);
 const other=new PetMotion(2,'lava',b,()=>{},()=>0,()=>0,()=>pets);pets.push(other);other.next=1;
 p.update(.1);assert.equal(p.next,8);
});
test('crowded wandering keeps all next destinations unique over many updates',()=>{
 const b=board(),pets:PetMotion[]=[];let seed=19;
 const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<24;i++)pets.push(new PetMotion(i,'water',b,()=>{},random,()=>0,()=>pets));
 for(let step=0;step<600;step++){
  for(const p of pets)p.update(1/30);
  const reserved=pets.map(p=>p.next??p.cell);
  assert.equal(new Set(reserved).size,pets.length);
 }
 assert.ok(pets.every(p=>p.completed>0));
});

test('leap duration uses a consistent travel speed bounded by stone appearance and clearing',()=>{
 for(const [target,duration] of [[0,.5],[5,10/15],[63,1.28]]){
  const b=Array<Tile|null>(64).fill('lava');b[target]=null;let placed=0;
  const p=new PetMotion(0,'lava',b,()=>{placed++;},()=>0);p.queueAbility();
  p.update(duration-.001);assert.equal(placed,0);assert.equal(p.leaping,true);
  p.update(.0011);assert.equal(placed,1);assert.equal(p.cell,target);assert.equal(p.queued,0);
 }
});
test('queued leaps keep distinct reserved destinations and all earned actions',()=>{
 const b=Array<Tile|null>(64).fill('lava');for(const c of [1,8,9,2,16,18])b[c]=null;
 const pets:PetMotion[]=[];let drops=0;
 for(const c of [0,10])pets.push(new PetMotion(c,'lava',b,n=>{assert.equal(b[n],null);b[n]='lava';drops++;return true;},()=>0,undefined,()=>pets));
 for(const p of pets){p.queueAbility();p.queueAbility();p.queueAbility();}
 for(let i=0;i<300;i++){
  for(const p of pets)p.update(.02);
  if(pets.every(p=>p.leaping))assert.notEqual(pets[0].next,pets[1].next);
 }
 assert.equal(drops,6);assert.ok(pets.every(p=>p.queued===0));
});
