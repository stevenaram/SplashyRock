import {footprint,type Game,type Piece,type Element} from './game';
import type {PetMotion} from './pet-motion';
export interface PetLanding {cell:number;element:Element;pet:PetMotion}
const neighbors=(c:number)=>[c%8>0?c-1:-1,c%8<7?c+1:-1,c-8,c+8].filter(n=>n>=0&&n<64);
// Stable tile ordering while hovering; nearest available pets are assigned only
// when the plan is committed. Abilities can pack opposing elements together.
export function planPetLandings(game:Game,piece:Piece,anchor:number):PetLanding[]{
 if(piece.tile==='pet'||game.over||!game.canPlace(piece,anchor))return [];
 const board=[...game.board],shape=new Set(footprint(piece,anchor).map(([x,y])=>y*8+x));
 for(const c of shape)board[c]=piece.tile;
 const blocked=new Set(game.bossReservedCells);
 for(const boss of game.bosses)if(!boss.deathRemaining)for(const c of boss.remaining)for(const n of neighbors(c))if(board[n]===null)blocked.add(n);
 for(const pet of game.pets){if(pet.leaping&&pet.next!==null)blocked.add(pet.next);if(pet.plannedLanding!==undefined)blocked.add(pet.plannedLanding);}
 const distance=(c:number)=>Math.min(...[...shape].map(s=>Math.abs(s%8-c%8)+Math.abs(Math.floor(s/8)-Math.floor(c/8))));
 const plan:PetLanding[]=[];
 for(const element of [piece.tile,piece.tile==='water'?'lava':'water'] as Element[]){
  const pets=game.pets.filter(p=>p.element===element);
  const candidates=Array.from({length:64},(_,c)=>c).filter(c=>board[c]===null&&!blocked.has(c)).sort((a,b)=>distance(a)-distance(b)||a-b);
  for(const cell of candidates){
   if(!pets.length)break;
   const pet=pets.reduce((a,b)=>Math.hypot(a.x-cell%8,a.y-Math.floor(cell/8))<=Math.hypot(b.x-cell%8,b.y-Math.floor(cell/8))?a:b);
   pets.splice(pets.indexOf(pet),1);plan.push({cell,element,pet});board[cell]=element;blocked.add(cell);
  }
 }
 return plan;
}
