import {BOAT_TOTAL_BRICKS,BOAT_WALL_BRICKS,BOAT_HULL_BRICKS} from './boat';
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
export function forgeTestControls(game:Game,world:World,reset:()=>void,render:()=>void,progressChanged:()=>void=()=>{}){
 const panel=document.createElement('details');panel.id='boss-test';panel.open=true;
 panel.innerHTML='<summary>Boat & forge sandbox</summary><p>Eight pets ready (four lava, four water). Place the forge, then lava in its left basin and water in its right basin. Each shape produces 2 bricks, up to 10.</p><div><button data-action="reset">Reset forge test</button><button data-action="singles">Single-tile shapes</button><button data-action="fuel">Fill placed basins</button><button data-action="stock">Stock all forges</button><button data-action="ready">Ready-to-build setup</button></div><p class="forge-status" aria-live="polite"></p><small>Permanent centers survive clears. Pets carry one brick per shape placement before looking for berries.</small>';
 panel.querySelector('[data-action="reset"]')!.addEventListener('click',reset);
 panel.querySelector('[data-action="singles"]')!.addEventListener('click',()=>{const rewards=game.inventory.filter(p=>p?.tile==='forge'||p?.tile==='pet');game.inventory=[...(['lava','water','bush'] as const).map(tile=>({tile,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]}})),...rewards];render();});
 panel.querySelector('[data-action="fuel"]')!.addEventListener('click',()=>{for(const c of game.forges.keys()){game.board[c-1]='lava';game.board[c+1]='water';game.versions[c-1]++;game.versions[c+1]++;}game.boardChange++;world.syncBoard(game.board,false);render();});
 const controls=document.createElement('div');controls.className='boat-test-controls';
 controls.innerHTML=`<label>Boat bricks <input aria-label="Boat bricks" type="number" min="0" max="${BOAT_TOTAL_BRICKS}" value="0"></label><button data-boat="apply">Set progress</button><div><button data-boat="0">Empty</button><button data-boat="${BOAT_HULL_BRICKS}">Hull shell</button><button data-boat="${BOAT_WALL_BRICKS}">Ship fittings</button><button data-boat="${BOAT_TOTAL_BRICKS-1}">Last brick</button><button data-boat="${BOAT_TOTAL_BRICKS}">Launch & play</button></div>`;
 panel.append(controls);
 controls.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-boat]');if(!button)return;const input=controls.querySelector('input')!;const count=button.dataset.boat==='apply'?Number(input.value):Number(button.dataset.boat);if(!Number.isFinite(count))return;game.setBoatProgress(count);input.value=String(game.boat.count);world.syncBoard(game.board,false);progressChanged();world.onPetChange();render();});
 panel.querySelector('[data-action="stock"]')!.addEventListener('click',()=>{for(const f of game.forges.values())f.bricks=10;render();});
 panel.querySelector('[data-action="ready"]')!.addEventListener('click',()=>{
  if(!game.forges.size){const forge:Piece={tile:'forge',shape:{id:'forge',name:'Forge',width:3,height:1,cells:[[0,0],[1,0],[2,0]]}};game.inventory=[forge];if(game.canPlace(forge,27))game.place(0,27);}
  for(const [c,f] of game.forges){game.board[c-1]='lava';game.board[c+1]='water';game.versions[c-1]++;game.versions[c+1]++;f.bricks=10;}
  game.boardChange++;world.syncBoard(game.board,false);(panel.querySelector('[data-action="singles"]') as HTMLButtonElement).click();render();
 });
 let previous='';const timer=setInterval(()=>{const label=`Boat: ${game.boat.count.toLocaleString()} / ${BOAT_TOTAL_BRICKS.toLocaleString()} · `+([...game.forges.values()].map((f,i)=>`Forge ${i+1}: ${f.bricks}/10 bricks`).join(' · ')||'Drag the forge from the inventory to begin.');if(label!==previous){panel.querySelector('.forge-status')!.textContent=label;previous=label;}},250);
 document.body.append(panel);return()=>{clearInterval(timer);panel.remove();};
}
