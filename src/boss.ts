import type {Element,Tile} from './game';
export interface Boss {id:number;element:Element;cell:number;pool:number[];remaining:Set<number>;hp:number;maxHp:number;hits:number}
export function largestPool(board:readonly(Tile|null)[],random:()=>number):number[]{
 const seen=new Set<number>();let choices:number[][]=[],size=0;
 for(let cell=0;cell<64;cell++){
  if(seen.has(cell)||!board[cell]||board[cell]==='stone')continue;
  const pool=[cell];seen.add(cell);
  for(let i=0;i<pool.length;i++){const c=pool[i],x=c%8;for(const n of [x>0?c-1:-1,x<7?c+1:-1,c-8,c+8])if(n>=0&&n<64&&!seen.has(n)&&board[n]===board[cell]){seen.add(n);pool.push(n);}}
  if(pool.length>size){size=pool.length;choices=[pool];}else if(pool.length===size)choices.push(pool);
 }
 return choices.length?choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]:[];
}
