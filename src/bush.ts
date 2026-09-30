import type {Tile} from './game';
export type BushPhase='healthy'|'ablaze';
export interface BushState {phase:BushPhase;berries:number;reserved:number;berryTurn?:number;blastTurn?:number}
export const edgeNeighbors=(c:number)=>[c%8?c-1:-1,c%8<7?c+1:-1,c-8,c+8].filter(n=>n>=0&&n<64);
export const watered=(board:readonly(Tile|null)[],c:number)=>edgeNeighbors(c).some(n=>board[n]==='water');
export const heated=(board:readonly(Tile|null)[],bushes:ReadonlyMap<number,BushState>,c:number)=>edgeNeighbors(c).some(n=>board[n]==='lava'||(bushes.get(n)?.phase==='ablaze'&&!watered(board,n)));
// Snapshot all fire before applying this placement; new flames cannot cascade.
export function bushTurn(board:readonly(Tile|null)[],bushes:ReadonlyMap<number,BushState>){
 const next=new Map<number,BushPhase>(),burnout:number[]=[];
 for(const [c,b] of bushes){
  if(watered(board,c))next.set(c,'healthy');
  else if(b.phase==='ablaze')burnout.push(c);
  else next.set(c,edgeNeighbors(c).some(n=>board[n]==='lava')?'ablaze':'healthy');
 }
 return {next,burnout};
}
