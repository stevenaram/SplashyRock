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
