import {footprint,type Game,type Piece,type Element} from './game';
import type {PetMotion} from './pet-motion';
import {isPureSand} from './pet-sand';
export interface PetLanding {cell:number;element:Element;pet:PetMotion}
export function planPetLandings(game:Game,piece:Piece,anchor:number):PetLanding[]{
 if(piece.tile==='pet'||game.over||!game.canPlace(piece,anchor))return [];
 const board=[...game.board],shape=footprint(piece,anchor).map(([x,y])=>y*8+x);
 for(const c of shape)board[c]=piece.tile;
 const distance=(c:number)=>Math.min(...shape.map(s=>Math.abs(s%8-c%8)+Math.abs(Math.floor(s/8)-Math.floor(c/8))));
 // Tile selection depends only on the board, anchor and pet counts, never on
 // wandering positions. Assign the nearest pet after selecting each destination.
 const candidates=Array.from({length:64},(_,c)=>c).filter(c=>isPureSand(board,c)).sort((a,b)=>distance(a)-distance(b)||a-b);
 if(!candidates.length)return [];
 const pools={water:game.pets.filter(p=>p.element==='water'),lava:game.pets.filter(p=>p.element==='lava')};
 const plan:PetLanding[]=[];let element:Element=piece.tile;
 while(pools.water.length||pools.lava.length){
  if(!pools[element].length)element=element==='water'?'lava':'water';
  const cell=candidates[plan.length%candidates.length],pets=pools[element];
  const pet=pets.reduce((a,b)=>Math.hypot(a.x-cell%8,a.y-Math.floor(cell/8))<=Math.hypot(b.x-cell%8,b.y-Math.floor(cell/8))?a:b);
  pets.splice(pets.indexOf(pet),1);plan.push({cell,element,pet});element=element==='water'?'lava':'water';
 }
 return plan;
}
