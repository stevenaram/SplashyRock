import type {Game,Piece,Element} from './game';
import type {World} from './world';
export function seedBushTest(game:Game,world:World){
 const shape={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
 for(let i=0;i<4;i++){
  const egg:Piece={tile:'pet',petElement:(i%2?'water':'lava') as Element,shape};
  game.inventory[0]=egg;game.place(0,48+i*2);game.pet!.hatchRemaining=0;world.addPiece(48+i*2,egg);
 }
 game.moves=0;game.score=13923;game.rewardsDealt=4;
 game.board[8]='lava';game.board[38]='water';
 for(const c of [9,10,11,12,30,37,39,46]){game.board[c]='bush';game.bushes.set(c,{phase:'healthy',berries:[30,37,39,46].includes(c)?4:0,reserved:0});}
 game.reconcileBushes();game.boardChange++;world.syncBoard(game.board,false);game.dealInventory();
}
export function bushTestControls(reset:()=>void,singles:()=>void){
 const panel=document.createElement('details');panel.id='boss-test';panel.open=true;
 panel.innerHTML='<summary>Bush sandbox</summary><p>Four pets ready. The upper hedge burns one square per move; the watered garden feeds pets.</p><div><button class="bush-reset">Reset garden</button><button class="bush-singles">Single tiles</button></div><small>Only shape placements advance fire and refill berries. Sandbox progress is not saved.</small>';
 panel.querySelector('.bush-reset')!.addEventListener('click',reset);panel.querySelector('.bush-singles')!.addEventListener('click',singles);document.body.append(panel);return()=>panel.remove();
}
