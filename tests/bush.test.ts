import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {SandSweeps} from '../src/reactions';
const single={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
const put=(g:Game,tile:Piece['tile'],cell:number)=>{g.inventory=[{tile,shape:single},null,null];assert.ok(g.place(0,cell));};
const bush=(g:Game,c:number,berries=0)=>{g.board[c]='bush';g.bushes.set(c,{phase:'healthy',berries,reserved:0});};
const pets=(g:Game,n:number)=>{for(let i=0;i<n;i++){put(g,'pet',48+i);g.pet!.hatchRemaining=0;}};
test('burnout waits for collapse, then its fiery cross ignites adjacent bushes at impact',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const g=new Game(()=>.2);g.board[8]='lava';[9,10,11,18].forEach(c=>bush(g,c));g.reconcileBushes();
 const sweeps=new SandSweeps(g,()=>{},()=>{});g.onLeafStone=()=>sweeps.schedule();
 put(g,'water',63);assert.equal(g.board[9],'bush');assert.equal(g.bushes.get(10)!.phase,'healthy');assert.equal(g.bushesBusy,true);
 g.updateBushBurnouts(.71);assert.equal(g.board[9],'bush');g.updateBushBurnouts(.02);assert.equal(g.board[9],'stone');assert.equal(g.fireStones.has(9),true);
 t.mock.timers.tick(500);assert.equal(g.board[9],null);assert.equal(g.bushes.get(10)!.phase,'healthy');
 t.mock.timers.tick(280);assert.equal(g.board[8],null);assert.equal(g.bushes.get(10)!.phase,'ablaze');assert.equal(g.bushes.get(11)!.phase,'healthy');assert.equal(g.bushes.get(18)!.phase,'healthy');
 sweeps.dispose();
});
test('water extinguishes fire, then replenishes berries despite adjacent lava',()=>{
 const g=new Game();[9,10].forEach(c=>bush(g,c));g.board[8]='lava';g.reconcileBushes();put(g,'water',1);
 assert.equal(g.bushes.get(9)!.phase,'healthy');assert.equal(g.bushes.get(9)!.berries,0);assert.equal(g.bushes.get(10)!.phase,'healthy');
 put(g,'water',62);assert.equal(g.bushes.get(9)!.berries,4);
 g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,4);
 g.bushes.get(9)!.berries=2;put(g,'water',63);assert.equal(g.bushes.get(9)!.berries,4);assert.equal(g.board[8],'lava');
});
test('water refills to four only on normal placements; dry berries persist',()=>{
 const g=new Game();bush(g,9);g.board[8]='water';put(g,'lava',63);assert.equal(g.bushes.get(9)!.berries,4);
 g.bushes.get(9)!.berries=1;put(g,'pet',48);g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,1);
 g.board[8]=null;put(g,'water',62);assert.equal(g.bushes.get(9)!.berries,1);
 g.board[8]='water';put(g,'water',61);assert.equal(g.bushes.get(9)!.berries,4);
 for(const c of [60,59,58])put(g,'water',c);assert.equal(g.bushes.get(9)!.berries,4);
 g.board[8]='lava';g.reconcileBushes();assert.equal(g.bushes.get(9)!.berries,0);
});
test('each berry reserves one pet; eating consumes it instead of planting; cancellation releases claims',()=>{
 const g=new Game(()=>.3);pets(g,6);bush(g,27,4);g.queuePetActions();assert.equal(g.bushes.get(27)!.reserved,4);assert.ok(g.pets.every(p=>p.queued===1));
 for(let i=0;i<40;i++)g.pets.forEach(p=>p.update(.1));
 assert.equal(g.pets.reduce((n,p)=>n+p.snacksEaten,0),4);assert.equal(g.bushes.get(27)!.berries,0);assert.equal(g.bushes.get(27)!.reserved,0);assert.equal(g.pets.reduce((n,p)=>n+p.abilitiesUsed,0),2);
 g.bushes.get(27)!.berries=4;g.queuePetActions();g.pets.forEach(p=>p.cancelAbilities());assert.equal(g.bushes.get(27)!.reserved,0);
});
test('bushes unlock at four hatched pets and alternate with original boss inventories',()=>{
 const g=new Game(()=>.3);pets(g,3);g.dealInventory();assert.ok(g.inventory.every(p=>p?.tile!=='bush'));pets(g,1);g.dealInventory();assert.deepEqual(new Set(g.inventory.map(p=>p?.tile)),new Set(['water','lava','bush']));
 for(const c of [0,1,2,8,9,10,16,17,18])g.board[c]='water';g.trySpawnBoss();assert.ok(g.bosses.length);g.dealInventory();assert.deepEqual(g.inventory.map(p=>p?.tile),['lava','lava','lava']);
 g.dealInventory();assert.deepEqual(g.inventory.map(p=>p?.tile),['lava','lava','bush']);
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
 const g=new Game();pets(g,4);for(let i=0;i<200;i++){g.dealInventory();const p=g.inventory.find(p=>p?.tile==='bush');assert.equal(!!p,i%2===0);if(p)assert.ok(p.shape.cells.length<=3);}
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

test('non-bush hands retain board-majority element rules and alternating hands reset each run',()=>{
 const g=new Game(()=>.3);pets(g,4);g.board[0]='water';
 g.dealInventory();assert.deepEqual(g.inventory.map(p=>p?.tile),['lava','water','bush']);
 g.dealInventory();assert.equal(g.inventory.filter(p=>p?.tile==='lava').length,2);assert.equal(g.inventory.filter(p=>p?.tile==='water').length,1);
 g.dealInventory();assert.ok(g.inventory.some(p=>p?.tile==='bush'));
 g.restart();pets(g,4);g.dealInventory();assert.ok(g.inventory.some(p=>p?.tile==='bush'));
});
test('pet water refills an unwatered bush once per shape placement, sharing the initial refill budget',()=>{
 const g=new Game();bush(g,27);put(g,'water',63);
 assert.equal(g.bushes.get(27)!.berries,0);
 g.plantPetTile(26,'water');assert.equal(g.bushes.get(27)!.berries,4);
 g.bushes.get(27)!.berries=1;g.plantPetTile(28,'water');assert.equal(g.bushes.get(27)!.berries,1);
 put(g,'water',62);assert.equal(g.bushes.get(27)!.berries,4);
 g.bushes.get(27)!.berries=2;g.plantPetTile(19,'water');assert.equal(g.bushes.get(27)!.berries,2);
});
test('egg placement and an old queued pet action cannot reset the current berry refill allowance',()=>{
 const g=new Game();bush(g,27);g.board[26]='water';put(g,'water',63);const oldRun=g.comboRun;
 put(g,'water',62);g.bushes.get(27)!.berries=0;put(g,'pet',48);
 g.plantPetTile(28,'water',oldRun);assert.equal(g.bushes.get(27)!.berries,0);
});
test('pet water extinguishes a burning bush but berries still wait for the next shape',()=>{
 const g=new Game();bush(g,27);g.board[26]='lava';g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'ablaze');
 g.plantPetTile(28,'water');assert.equal(g.bushes.get(27)!.phase,'healthy');assert.equal(g.bushes.get(27)!.berries,0);
 g.plantPetTile(19,'water');assert.equal(g.bushes.get(27)!.berries,0);
 put(g,'water',63);assert.equal(g.bushes.get(27)!.berries,4);
});
test('pet-water replenishment never assigns extra snacks or pet abilities',()=>{
 const g=new Game(()=>.2);pets(g,2);bush(g,27);put(g,'water',63);g.queuePetActions();
 const queued=g.pets.map(p=>p.queued),eaten=g.pets.map(p=>p.snacksEaten);
 g.plantPetTile(26,'water');
 assert.equal(g.bushes.get(27)!.berries,4);assert.equal(g.bushes.get(27)!.reserved,0);
 assert.deepEqual(g.pets.map(p=>p.queued),queued);assert.deepEqual(g.pets.map(p=>p.snacksEaten),eaten);
 assert.deepEqual(g.berryEaten,[]);
});

test('rapid placements do not duplicate or restart an in-progress burnout',()=>{
 const g=new Game();bush(g,9);g.board[8]='lava';g.reconcileBushes();let held=0,blasts=0;g.onBushBurnout=()=>{held++;return()=>held--;};g.onLeafStone=()=>blasts++;
 put(g,'water',63);g.updateBushBurnouts(.4);put(g,'water',62);assert.equal(held,1);g.updateBushBurnouts(.33);assert.equal(blasts,1);assert.equal(held,0);
});
test('a fiery cross ignites even watered bushes until the next normal placement',()=>{
 const g=new Game();bush(g,27,4);g.board[26]='water';g.igniteBlastBushes([27]);g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'ablaze');assert.equal(g.bushes.get(27)!.berries,0);
 put(g,'water',63);assert.equal(g.bushes.get(27)!.phase,'healthy');assert.equal(g.bushes.get(27)!.berries,0);
});
for(const source of ['pet','shape'] as const)test(`${source} water cannot extinguish a burnout already committed by a shape placement`,()=>{
 const g=new Game();bush(g,27);g.board[26]='lava';g.reconcileBushes();put(g,'water',63);
 assert.equal(g.bushesBusy,true);g.updateBushBurnouts(.3);if(source==='pet')g.plantPetTile(28,'water');else put(g,'water',28);
 assert.equal(g.bushes.get(27)!.phase,'ablaze');g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'ablaze');
 g.updateBushBurnouts(.43);assert.equal(g.board[27],'stone');assert.equal(g.fireStones.has(27),true);
});

for(const staggered of [false,true])test(`water-cooled bushes stay extinguished after both neighbors clear (${staggered?'staggered':'simultaneous'})`,()=>{
 const g=new Game();bush(g,27);g.board[26]='lava';g.reconcileBushes();
 g.plantPetTile(28,'water');assert.equal(g.bushes.get(27)!.phase,'healthy');
 if(staggered){g.clearCells([28]);g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'ablaze');g.clearCells([26]);}
 else g.clearCells([26,28]);
 g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'healthy');assert.equal(g.bushes.get(27)!.berries,0);
 put(g,'water',63);assert.equal(g.bushesBusy,false);assert.equal(g.board[27],'bush');
});
test('blast fire remains valid without lava even on a previously watered bush',()=>{
 const g=new Game();bush(g,27);g.board[26]='water';g.reconcileBushes();g.clearCells([26]);
 g.igniteBlastBushes([27]);g.reconcileBushes();assert.equal(g.bushes.get(27)!.phase,'ablaze');
});
