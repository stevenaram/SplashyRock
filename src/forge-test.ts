import {REWARD_GOALS} from './egg-goals';
import type {Game,Piece} from './game';
import type {World} from './world';
export function seedForgeTest(game:Game,world:World){
 const shape={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
 for(let i=0;i<8;i++){
  const egg:Piece={tile:'pet',petElement:i%2?'water':'lava',shape};
  const cell=48+i;game.inventory=[egg,null,null];game.place(0,cell);game.pet!.hatchRemaining=0;world.addPiece(cell,egg);
 }
 game.moves=0;game.score=REWARD_GOALS[8];game.rewardsDealt=8;game.claimEggRewards();
 const forge=game.inventory.find(p=>p?.tile==='forge')!;
 game.inventory=[{tile:'lava',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}},forge,{tile:'water',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}}] as Piece[];
 world.syncBoard(game.board,false);
}
export function forgeTestControls(game:Game,world:World,reset:()=>void,render:()=>void){
 const panel=document.createElement('details');panel.id='boss-test';panel.open=true;
 panel.innerHTML='<summary>Obsidian forge sandbox</summary><p>Eight pets ready (four lava, four water). Place the forge, then lava in its left basin and water in its right basin. Each shape produces 2 bricks, up to 10.</p><div><button data-action="reset">Reset forge test</button><button data-action="singles">Single-tile shapes</button><button data-action="fuel">Fill placed basins</button></div><p class="forge-status" aria-live="polite"></p><small>Permanent centers survive clears. Bricks stay stored in the forge.</small>';
 panel.querySelector('[data-action="reset"]')!.addEventListener('click',reset);
 panel.querySelector('[data-action="singles"]')!.addEventListener('click',()=>{const rewards=game.inventory.filter(p=>p?.tile==='forge'||p?.tile==='pet');game.inventory=[...(['lava','water','bush'] as const).map(tile=>({tile,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]}})),...rewards];render();});
 panel.querySelector('[data-action="fuel"]')!.addEventListener('click',()=>{for(const c of game.forges.keys()){game.board[c-1]='lava';game.board[c+1]='water';game.versions[c-1]++;game.versions[c+1]++;}game.boardChange++;world.syncBoard(game.board,false);render();});
 let previous='';const timer=setInterval(()=>{const label=[...game.forges.values()].map((f,i)=>`Forge ${i+1}: ${f.bricks}/10 bricks`).join(' · ')||'Drag the forge from the inventory to begin.';if(label!==previous){panel.querySelector('.forge-status')!.textContent=label;previous=label;}},250);
 document.body.append(panel);return()=>{clearInterval(timer);panel.remove();};
}
