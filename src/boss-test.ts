import type {Game,Element,Piece} from './game';
import type {World} from './world';
export function seedBossTest(game:Game,world:World,element:Element|'both'){
 const poolElement:Element=element==='both'?'water':element;
 const opposite:Element=poolElement==='water'?'lava':'water';

 for(const [i,petElement] of [opposite,poolElement,opposite].entries()){
  const egg:Piece={tile:'pet',petElement,shape:{id:'pet-egg',name:'Mystery Egg',width:1,height:1,cells:[[0,0]]}};
  game.inventory[0]=egg;game.place(0,48+i*2);game.pet!.hatchRemaining=0;world.addPiece(48+i*2,egg);
 }
 game.moves=0;game.score=18200;game.rewardsDealt=3;
 if(element==='both'){for(let i=0;i<16;i++){game.board[i%4+Math.floor(i/4)*8]='water';game.board[36+i%4+Math.floor(i/4)*8]='lava';}}
 else for(const cell of [18,19,20,21,26,27,28,29,34,35,36,37,42,43,44,45])game.board[cell]=element;
 game.boardChange++;world.syncBoard(game.board,false);game.trySpawnBoss();game.dealInventory();
}
export function bossTestControls(reset:(element:Element|'both')=>void,attack:()=>void){
 const panel=document.createElement('details');panel.id='boss-test';panel.open=true;
 panel.innerHTML='<summary>Boss test</summary><p>Place shapes to fight, or preview pet support below.</p><div><button data-element="water">Water boss</button><button data-element="lava">Lava boss</button></div><button data-element="both" style="width:100%;margin-top:6px">Both bosses</button><button id="boss-test-attack">Test pet support</button><small>Test progress is not saved.</small>';
 panel.querySelectorAll<HTMLButtonElement>('[data-element]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.element as Element|'both')));
 panel.querySelector('#boss-test-attack')!.addEventListener('click',attack);document.body.append(panel);
 return ()=>panel.remove();
}
