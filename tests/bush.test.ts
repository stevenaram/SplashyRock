import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
const single={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
const put=(g:Game,tile:Piece['tile'],cell:number)=>{g.inventory=[{tile,shape:single},null,null];assert.ok(g.place(0,cell));};
const bush=(g:Game,c:number,berries=0)=>{g.board[c]='bush';g.bushes.set(c,{phase:'healthy',berries,reserved:0});};
const pets=(g:Game,n:number)=>{for(let i=0;i<n;i++){put(g,'pet',48+i);g.pet!.hatchRemaining=0;}};
test('fire propagates one edge per placement and burning bushes clear themselves next turn',()=>{
 const g=new Game(()=>.2);g.board[8]='lava';[9,10,11,18].forEach(c=>bush(g,c));g.reconcileBushes();
 assert.equal(g.bushes.get(9)!.phase,'ablaze');
 put(g,'water',63);assert.equal(g.board[9],null);assert.equal(g.bushes.get(10)!.phase,'ablaze');assert.equal(g.bushes.get(11)!.phase,'healthy');assert.equal(g.bushes.get(18)!.phase,'healthy');
 put(g,'water',62);assert.equal(g.board[10],null);assert.equal(g.board[8],'lava');assert.equal(g.bushes.get(11)!.phase,'ablaze');
});
test('water extinguishes fire, then replenishes berries despite adjacent lava',()=>{
 const g=new Game();[9,10].forEach(c=>bush(g,c));g.board[8]='lava';g.reconcileBushes();put(g,'water',1);
 assert.equal(g.bushes.get(9)!.phase,'healthy');assert.equal(g.bushes.get(9)!.berries,0);assert.equal(g.bushes.get(10)!.phase,'healthy');
 put(g,'water',62);assert.equal(g.bushes.get(9)!.berries,1);
 g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,1);
 put(g,'water',63);assert.equal(g.bushes.get(9)!.berries,2);assert.equal(g.board[8],'lava');
});
test('water refills exactly one berry per normal placement, capped at four; dry berries persist',()=>{
 const g=new Game();bush(g,9);g.board[8]='water';put(g,'lava',63);assert.equal(g.bushes.get(9)!.berries,1);
 put(g,'pet',48);g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,1);
 g.board[8]=null;put(g,'water',62);assert.equal(g.bushes.get(9)!.berries,1);
 g.board[8]='water';put(g,'water',61);assert.equal(g.bushes.get(9)!.berries,2);
 for(const c of [60,59,58])put(g,'water',c);assert.equal(g.bushes.get(9)!.berries,4);
 g.board[8]='lava';g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,0);
});
test('each berry reserves one pet; eating consumes it instead of planting; cancellation releases claims',()=>{
 const g=new Game(()=>.3);pets(g,6);bush(g,27,4);g.queuePetActions();assert.equal(g.bushes.get(27)!.reserved,4);assert.ok(g.pets.every(p=>p.queued===1));
 for(let i=0;i<40;i++)g.pets.forEach(p=>p.update(.1));
 assert.equal(g.pets.reduce((n,p)=>n+p.snacksEaten,0),4);assert.equal(g.bushes.get(27)!.berries,0);assert.equal(g.bushes.get(27)!.reserved,0);assert.equal(g.pets.reduce((n,p)=>n+p.abilitiesUsed,0),2);
 g.bushes.get(27)!.berries=4;g.queuePetActions();g.pets.forEach(p=>p.cancelAbilities());assert.equal(g.bushes.get(27)!.reserved,0);
});
test('bush unlock requires four hatched pets; every new hand includes bush and both elements',()=>{
 const g=new Game(()=>.3);pets(g,3);g.dealInventory();assert.ok(g.inventory.every(p=>p?.tile!=='bush'));pets(g,1);g.dealInventory();assert.deepEqual(new Set(g.inventory.map(p=>p?.tile)),new Set(['water','lava','bush']));
 for(const c of [0,1,2,8,9,10,16,17,18])g.board[c]='water';g.trySpawnBoss();assert.ok(g.bosses.length);g.dealInventory();assert.deepEqual(g.inventory.map(p=>p?.tile),['lava','lava','bush']);
});
test('game over treats every bush phase as occupied, including burning bushes awaiting another placement',()=>{
 for(const phase of ['healthy','ablaze'] as const){
  const g=new Game();for(let c=0;c<64;c++){bush(g,c);g.bushes.get(c)!.phase=phase;}
  g.inventory=[{tile:'water',shape:single},{tile:'lava',shape:single},{tile:'bush',shape:single}];
  assert.equal(g.hasLegalMove(),false);assert.equal(g.finishIfBlocked(false),true);
 }
});
test('a fitting bush shape keeps the run alive when neither liquid shape fits',()=>{
 const g=new Game();g.board.fill('water');g.board[27]=null;
 const large={id:'square',name:'Square',width:2,height:2,cells:[[0,0],[1,0],[0,1],[1,1]] as const};
 g.inventory=[{tile:'water',shape:large},{tile:'lava',shape:large},{tile:'bush',shape:single}];
 assert.equal(g.hasLegalMove(),true);assert.equal(g.finishIfBlocked(false),false);
});

test('bush shapes always have at most three squares',()=>{
 const g=new Game();pets(g,4);for(let i=0;i<200;i++){g.dealInventory();const p=g.inventory.find(p=>p?.tile==='bush')!;assert.ok(p.shape.cells.length<=3);}
});
for(const element of ['lava','water'] as const)test(`${element} pet eats for one second then creates a leaf stone on opposite neighbor sand`,()=>{
 const g=new Game(()=>0);g.inventory=[{tile:'pet',petElement:element,shape:single}];g.place(0,48);const p=g.pet!;p.hatchRemaining=0;
 bush(g,48,1);g.board[50]=element==='lava'?'water':'lava';let held=0,done=0;
 g.queuePetActions(()=>{held++;return()=>{held--;done++;};});p.update(.5);
 assert.equal(p.feeding,1);assert.equal(p.queued,1);assert.equal(g.bushes.get(48)!.berries,0);assert.equal(held,1);
 p.update(.99);assert.equal(p.leaping,false);assert.equal(g.leafStones.size,0);assert.equal(p.hasAbilityFor(g.comboRun),true);
 p.update(.02);assert.equal(p.leaping,true);assert.equal(p.next,49);
 p.update(.6);assert.equal(g.board[49],'stone');assert.equal(g.leafStones.has(49),true);assert.equal(held,0);assert.equal(done,1);assert.equal(p.abilitiesUsed,0);
});
test('missing berry or missing landing space completes the distraction without leaving queued aftermath',()=>{
 for(const remove of [true,false]){const g=new Game(()=>0);pets(g,1);bush(g,48,1);let held=0;g.queuePetActions(()=>{held++;return()=>held--;});if(remove)g.bushes.get(48)!.berries=0;
 g.pet!.update(4);assert.equal(held,0);assert.equal(g.pet!.queued,0);assert.equal(g.leafStones.size,0);}
});
test('pets can walk through bushes, including bushes beside the opposite element',()=>{
 const g=new Game(()=>0);pets(g,1);for(let c=0;c<64;c++)bush(g,c);g.board[0]='water';const p=g.pet!;p.update(10);assert.ok(p.completed>2);
});
