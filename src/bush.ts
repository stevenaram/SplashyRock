import type {Tile} from './game';
export type BushPhase='healthy'|'smoldering'|'ablaze';
export interface BushState {phase:BushPhase;berries:number;reserved:number}
export const edgeNeighbors=(c:number)=>[c%8?c-1:-1,c%8<7?c+1:-1,c-8,c+8].filter(n=>n>=0&&n<64);
export const watered=(board:readonly(Tile|null)[],c:number)=>edgeNeighbors(c).some(n=>board[n]==='water');
// One immutable phase snapshot per normal placement prevents cascading spread.
export function bushTurn(board:readonly(Tile|null)[],bushes:ReadonlyMap<number,BushState>){
 const phases=new Map([...bushes].map(([c,b])=>[c,b.phase]));
 const ignite=new Set<number>(),burnout:number[]=[];
 for(const [c,phase] of phases){
  if(phase==='ablaze')burnout.push(c);
  if(phase==='smoldering'&&!watered(board,c))for(const n of edgeNeighbors(c))if(phases.get(n)==='healthy'&&!watered(board,n))ignite.add(n);
 }
 const next=new Map<number,BushPhase>();
 for(const [c,phase] of phases)if(phase!=='ablaze')next.set(c,watered(board,c)?'healthy':phase==='smoldering'?'ablaze':ignite.has(c)?'smoldering':'healthy');
 return {next,burnout};
}
