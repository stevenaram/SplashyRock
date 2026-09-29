import type {Element,Tile} from './game';
export const BOSS_SLAM_DELAY=.55;
export const BOSS_WAVE_SPEED=14; // Grid cells per second.
export const BOSS_SURGE_DURATION=1.5;
export interface BossSurge {age:number;x:number;y:number;source:Set<number>;grown:Set<number>}
export interface Boss {surges:BossSurge[];id:number;element:Element;cell:number;pool:number[];remaining:Set<number>;hits:number;x:number;y:number;moveAge:number;deathRemaining:number;maxTiles:number;regionRevision:number;damageTaken:number}
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

export function poolSquares(pool:ReadonlySet<number>):number[]{
 return [...pool].filter(c=>c%8<7&&c<56&&pool.has(c+1)&&pool.has(c+8)&&pool.has(c+9));
}

export function elementalPools(board:readonly(Tile|null)[]):{element:Element;cells:number[]}[]{
 const seen=new Set<number>(),result:{element:Element;cells:number[]}[]=[];
 for(let c=0;c<64;c++){const element=board[c];if(!element||element==='stone'||seen.has(c))continue;
  const cells=[c];seen.add(c);for(let i=0;i<cells.length;i++){const n=cells[i],x=n%8;for(const next of [x>0?n-1:-1,x<7?n+1:-1,n-8,n+8])if(next>=0&&next<64&&!seen.has(next)&&board[next]===element){seen.add(next);cells.push(next);}}
  result.push({element,cells});
 }return result;
}
export function poolBlocks(pool:ReadonlySet<number>,size=3):number[]{
 return [...pool].filter(c=>c%8<=8-size&&Math.floor(c/8)<=8-size&&Array.from({length:size*size},(_,i)=>c+i%size+Math.floor(i/size)*8).every(n=>pool.has(n)));
}

export const BOSS_ENTRANCE_SECONDS=3;
export const BOSS_DEATH_SECONDS=3;

export interface BossReward {element:Element;x:number;y:number;damage:number;score:number}
export const bossRewardScore=(damage:number)=>500+50*damage;

export function bossHealth(b:Pick<Boss,'remaining'|'maxTiles'|'deathRemaining'>){
 const max=Math.max(1,b.maxTiles-4);
 const current=b.deathRemaining>0?0:Math.max(0,b.remaining.size-4);
 return {current,max,fraction:Math.min(1,current/max)};
}
