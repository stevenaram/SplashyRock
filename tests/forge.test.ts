import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {REWARD_GOALS,MAX_PETS} from '../src/egg-goals';
import {PET_GOALS} from '../src/progression';
const forge:Piece={tile:'forge',shape:{id:'forge',name:'Forge',width:3,height:1,cells:[[0,0],[1,0],[2,0]]}};
const single=(tile:Piece['tile']):Piece=>({tile,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}});
function place(g:Game,p:Piece,c:number){g.inventory=[p,null,null];return g.place(0,c);}
test('rewards cap at 16 eggs and continue the same curve for eight stacked forges',()=>{
 const g=new Game();g.score=REWARD_GOALS.at(-1)!;assert.equal(g.claimEggRewards(),24);
 assert.equal(g.inventory.find(p=>p?.tile==='pet')?.eggCount,16);assert.equal(g.inventory.find(p=>p?.tile==='forge')?.eggCount,8);
 assert.equal(REWARD_GOALS[15],262326);assert.equal(REWARD_GOALS[16],317792);assert.equal(g.claimEggRewards(),0);assert.equal(PET_GOALS.at(-1),MAX_PETS);
});
test('forge needs three empty cells, cannot overlap another footprint or wrap an edge',()=>{
 const g=new Game();assert.equal(g.canPlace(forge,24),false);g.board[26]='bush';assert.equal(g.canPlace(forge,27),false);g.board[26]=null;
 assert.ok(place(g,forge,27));assert.equal(g.canPlace(forge,29),false);assert.equal(g.board[27],'forge');assert.equal(g.board[26],null);
 assert.equal(g.canPlace(single('water'),26),false);assert.equal(g.canPlace(single('lava'),28),false);assert.equal(g.canPlace(single('bush'),26),false);
 const tall={...single('lava'),shape:{id:'tall',name:'Tall',width:1,height:3,cells:[[0,0],[0,1],[0,2]] as [number,number][]}};
 assert.ok(g.canPlace(tall,26));assert.ok(place(g,tall,26));assert.equal(g.board[18],'lava');assert.equal(g.board[26],'lava');assert.equal(g.board[34],'lava');
});
test('forge produces two per normal shape, stops at ten, pauses without both inputs',()=>{
 const g=new Game();place(g,forge,27);place(g,single('lava'),26);assert.equal(g.forges.get(27)?.bricks,0);
 place(g,single('water'),28);assert.equal(g.forges.get(27)?.bricks,2);
 place(g,single('pet'),0);assert.equal(g.forges.get(27)?.bricks,2);
 place(g,forge,43);assert.equal(g.forges.get(27)?.bricks,2);
 for(let c=0;c<5;c++)place(g,single('water'),c);assert.equal(g.forges.get(27)?.bricks,10);assert.equal(g.forges.get(27)?.cycles,5);
 g.clearCells([26]);place(g,single('water'),7);assert.equal(g.forges.get(27)?.bricks,10);
});
test('center survives clears and revive; pets obey basin restrictions without producing bricks',()=>{
 const g=new Game();place(g,forge,27);assert.deepEqual(g.clearCells([27]),[]);assert.equal(g.board[27],'forge');
 assert.equal(g.plantPetTile(26,'water'),false);assert.equal(g.plantPetTile(28,'lava'),false);
 assert.ok(g.plantPetTile(26,'lava'));assert.ok(g.plantPetTile(28,'water'));assert.equal(g.forges.get(27)?.bricks,0);
 g.over=true;assert.ok(!g.beginRevive().includes(27));assert.equal(g.board[27],'forge');g.finishRevive();g.restart();assert.equal(g.forges.size,0);assert.ok(g.board.every(t=>t===null));
});
test('all eight forges fit as separate footprints and stored stacks consume one at a time',()=>{
 const g=new Game();g.inventory=[{...forge,eggCount:8},null,null];
 for(let i=0;i<8;i++){assert.ok(g.place(0,i*8+3));assert.equal(g.forges.size,i+1);if(i<7)assert.equal(g.inventory[0]?.eggCount,7-i);}
 assert.equal(g.canPlace(forge,1),false);assert.equal(g.canPlace(single('pet'),3),false);
});
test('forge-only inventory can finish its hand, but it does not rescue an unplaceable normal shape',()=>{
 const g=new Game();g.inventory=[forge];assert.ok(g.hasLegalMove());assert.ok(g.place(0,27));assert.ok(g.inventory.every(p=>p&&p.tile!=='forge'));
 g.board.fill('water');g.board[0]=g.board[1]=g.board[2]=null;g.inventory=[forge,{tile:'lava',shape:{id:'square',name:'Square',width:2,height:2,cells:[[0,0],[1,0],[0,1],[1,1]]}}];assert.equal(g.hasLegalMove(),false);
});
test('boss waves respect both forge basin types and cannot cover the permanent center',async()=>{
 const {PetMotion}=await import('../src/pet-motion');
 const g=new Game(()=>.1,()=>true);place(g,forge,27);
 g.pets.push(new PetMotion(63,'lava',g.board,()=>{}));
 for(const c of [2,3,4,10,11,12,18,19,20])g.board[c]='water';g.boardChange++;assert.ok(g.trySpawnBoss());
 place(g,single('water'),56);g.updateBoss(1.5);
 assert.equal(g.board[26],null);assert.equal(g.board[27],'forge');assert.equal(g.board[28],'water');assert.equal(g.forges.get(27)?.bricks,0);
});
test('first eight milestones are eggs, then exactly eight forge/egg pairs',async()=>{
 const {REWARD_TYPES,EGG_GOALS,earnedEggs}=await import('../src/egg-goals');
 assert.deepEqual(REWARD_TYPES.slice(0,8),Array(8).fill('pet'));
 assert.deepEqual(REWARD_TYPES.slice(8),Array.from({length:16},(_,i)=>i%2?'pet':'forge'));
 const g=new Game();
 for(let i=0;i<24;i++){
  g.score=REWARD_GOALS[i];assert.equal(g.claimEggRewards(),1);
  const eggs=REWARD_TYPES.slice(0,i+1).filter(t=>t==='pet').length;
  assert.equal(g.inventory.find(p=>p?.tile==='pet')?.eggCount??0,eggs);
  assert.equal(g.inventory.find(p=>p?.tile==='forge')?.eggCount??0,i+1-eggs);
  assert.equal(earnedEggs(g.score),eggs);
 }
 assert.equal(EGG_GOALS[8],REWARD_GOALS[9]);assert.equal(EGG_GOALS.at(-1),REWARD_GOALS[23]);
});
test('forge sandbox seeds eight hatched pets, first forge, and the next egg milestone',async()=>{
 const {seedForgeTest}=await import('../src/forge-test');
 const g=new Game();let rendered=0;
 seedForgeTest(g,{addPiece:()=>rendered++,syncBoard:()=>{}} as unknown as import('../src/world').World);
 assert.equal(g.pets.length,8);assert.equal(rendered,8);assert.ok(g.pets.every(p=>p.hatchRemaining===0&&p.queued===0));
 assert.equal(g.pets.filter(p=>p.element==='water').length,4);assert.equal(g.pets.filter(p=>p.element==='lava').length,4);
 assert.equal(g.score,REWARD_GOALS[8]);assert.equal(g.rewardsDealt,9);assert.equal(g.inventory[1]?.tile,'forge');
 g.score=REWARD_GOALS[9];g.claimEggRewards();assert.equal(g.inventory.find(p=>p?.tile==='pet')?.eggCount,1);
 g.restart();seedForgeTest(g,{addPiece:()=>{},syncBoard:()=>{}} as unknown as import('../src/world').World);assert.equal(g.pets.length,8);
});
test('forge lava resists direct water contact while ordinary lava still forms obsidian',()=>{
 const g=new Game();place(g,forge,27);g.board[26]='lava';g.board[18]='water';g.board[17]='lava';
 g.reconcileObsidian();assert.equal(g.board[26],'lava');assert.equal(g.board[17],'obsidian');
});
test('forge liquids cannot supply stone or berry blast neighbors, but external liquids can',()=>{
 const g=new Game();place(g,forge,27);g.board[26]='lava';g.board[28]='water';g.board[16]='water';
 assert.equal(g.canFormStone(18),false);assert.equal(g.formLeafStone(36,'lava'),false);
 g.board[10]='lava';g.board[19]='water';assert.equal(g.canFormStone(18),true);
 g.board[44]='water';assert.equal(g.formLeafStone(36,'lava'),true);
});

test('forges accept existing matching fuel in either or both basins and preserve it',()=>{
 for(const [left,right] of [[null,null],['lava',null],[null,'water'],['lava','water']] as const){
  const g=new Game();g.board[26]=left;g.board[28]=right;
  assert.ok(g.canPlace(forge,27));assert.ok(g.pieceFits(forge));assert.ok(place(g,forge,27));
  assert.equal(g.board[26],left);assert.equal(g.board[28],right);assert.equal(g.board[27],'forge');
  assert.equal(g.forges.get(27)!.bricks,0);assert.equal(g.shapeMoves,0);
  assert.ok(place(g,single('water'),0));assert.equal(g.forges.get(27)!.bricks,left&&right?2:0);
 }
});
test('forge placement rejects wrong basin elements and occupied centers, including other forge basins',()=>{
 for(const cell of [26,27,28])for(const tile of ['water','lava','bush','stone','obsidian','forge'] as const){
  if((cell===26&&tile==='lava')||(cell===28&&tile==='water'))continue;
  const g=new Game();g.board[cell]=tile;const before=[...g.board];assert.equal(g.canPlace(forge,27),false);assert.equal(place(g,forge,27),false);assert.deepEqual(g.board,before);
 }
 const g=new Game();assert.ok(place(g,forge,27));g.board[28]='water';assert.equal(g.canPlace(forge,29),false);
 g.board[26]='lava';assert.equal(g.canPlace(forge,25),false);
});
test('a buildable neighbor center accepts the forge and stops the would-be stone reaction',()=>{
 const g=new Game();g.board[26]='lava';g.board[28]='water';assert.ok(g.canFormStone(27));
 assert.ok(place(g,forge,27));assert.equal(g.formStone(27),false);assert.deepEqual(g.board.slice(26,29),['lava','forge','water']);
 const edge=new Game();edge.board[0]='water';assert.equal(edge.canPlace(forge,0),false);assert.equal(edge.canPlace(forge,7),false);
});
test('matching normal shapes can refill full basins without allowing wrong elements or center overlap',()=>{
 const g=new Game();place(g,forge,27);place(g,single('lava'),26);place(g,single('water'),28);
 const before=g.shapeMoves;assert.ok(place(g,single('lava'),26));assert.equal(g.shapeMoves,before+1);assert.equal(g.board[26],'lava');assert.ok(g.forges.get(27)!.bricks>=4);
 assert.ok(g.canPlace(single('water'),28));assert.equal(g.canPlace(single('lava'),28),false);assert.equal(g.canPlace(single('water'),26),false);assert.equal(g.canPlace(single('lava'),27),false);
 const tall={...single('water'),shape:{id:'tall',name:'Tall',width:1,height:3,cells:[[0,0],[0,1],[0,2]] as [number,number][]}};assert.ok(g.canPlace(tall,28));g.board[20]='bush';assert.equal(g.canPlace(tall,28),false);
});
test('forge slams before clearing only its outer edge neighbors without consuming fuel',()=>{
 const g=new Game();g.board[26]='lava';g.board[28]='water';
 const ring=[18,19,20,25,29,34,35,36];ring.forEach(c=>g.board[c]='bush');g.board[17]='bush';
 let pending=0,blasts=0;g.onForgeBlastPending=()=>{pending++;return()=>{pending--;};};g.onForgeBlast=()=>blasts++;
 assert.ok(place(g,forge,27));assert.equal(pending,1);g.updateForgeBlasts(.2);assert.equal(blasts,0);assert.equal(g.board[19],'bush');
 g.updateForgeBlasts(.12);assert.equal(blasts,1);assert.equal(pending,0);ring.forEach(c=>assert.equal(g.board[c],null));
 assert.equal(g.board[17],'bush');assert.equal(g.board[26],'lava');assert.equal(g.board[28],'water');assert.equal(g.board[27],'forge');
 g.board[19]='obsidian';place(g,single('water'),63);assert.equal(g.forges.get(27)!.bricks,2);g.updateForgeBlasts(0);assert.equal(blasts,2);assert.equal(g.board[19],null);
 g.forges.get(27)!.bricks=10;place(g,single('water'),62);g.updateForgeBlasts(1);assert.equal(blasts,2);
});
test('restarting cancels a pending forge impact',()=>{const g=new Game();place(g,forge,27);assert.ok(g.forgesBusy);g.restart();assert.equal(g.forgesBusy,false);assert.equal(g.updateForgeBlasts(1),false);});
