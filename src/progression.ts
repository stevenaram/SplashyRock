import type {Game,Element,Tile} from './game';

export const PROGRESS_KEY='splashy-rock-progress-v1';
export const PET_GOALS=Array.from({length:64},(_,i)=>i+1);
export const COMBO_GOALS=Array.from({length:15},(_,i)=>i+2);
export const CLEAR_GOALS=[16,32,64,128,256,512];
export interface Achievement {id:string;title:string;description:string;reward:number;progress:number;target:number;family:string}
interface State {gems:number;completed:string[];first:Element;networkStep:number;petBest:number;comboBest:number;clearBest:number;networkBest:number}
const integer=(n:unknown,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
export function largestConnection(board:readonly(Tile|null)[],element:Element,required?:ReadonlySet<number>){
 const seen=new Set<number>();let largest=0;
 for(let c=0;c<64;c++){
  if(seen.has(c)||board[c]!==element)continue;
  const queue=[c];seen.add(c);
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%8,y=Math.floor(n/8);
   for(const next of [x>0?n-1:-1,x<7?n+1:-1,y>0?n-8:-1,y<7?n+8:-1])if(next>=0&&!seen.has(next)&&board[next]===element){seen.add(next);queue.push(next);}
  }
  if(!required||queue.some(c=>required.has(c)))largest=Math.max(largest,queue.length);
 }
 return largest;
}
export class Progression {
 private state:State;
 private lastBoard:readonly(Tile|null)[]|undefined;
 private lastChange=-1;
 private lastTiles:readonly(Tile|null)[]=Array(64).fill(null);
 constructor(private readonly storage?:Pick<Storage,'getItem'|'setItem'>,random:()=>number=Math.random){
  this.state={gems:0,completed:[],first:random()<.5?'water':'lava',networkStep:0,petBest:0,comboBest:0,clearBest:0,networkBest:0};
  this.reload();this.save();
 }
 get gems(){return this.state.gems;}
 get completedCount(){return this.state.completed.length;}
 private catalog():Achievement[]{
  const row=(id:string,title:string,description:string,reward:number,progress:number,target:number,family:string)=>({id,title,description,reward,progress,target,family});
  return [
   ...PET_GOALS.map(n=>row(`pet-${n}`,'Island companions',n===1?'Hatch your first pet.':`Hatch ${n} pets in a single run.`,5,this.state.petBest,n,'pets')),
   ...COMBO_GOALS.map(n=>row(`combo-${n}`,'Chain reaction',`Reach a ×${n} stone combo.`,3,this.state.comboBest,n,'combo')),
   ...Array.from({length:16},(_,i)=>{const element=i%2===0?this.state.first:this.state.first==='water'?'lava':'water',n=(Math.floor(i/2)+1)*8;return row(`network-${i}`,element==='water'?'Ocean maker':'Lava flow',`Connect ${n} ${element} tiles in one group.`,3+Math.floor(n/16),i===this.state.networkStep?this.state.networkBest:0,n,'network');}),
   ...CLEAR_GOALS.map(n=>row(`clear-${n}`,'Room to grow',`Clear ${n} tiles in a single run.`,5,this.state.clearBest,n,'clearing')),
   row('clean-slate','A fresh shore','Clear every tile from the board after the tutorial.',10,0,1,'clean'),
  ];
 }
 private validIds(){return new Set(this.catalog().map(a=>a.id));}
 reload(){
  try{
   const raw=this.storage?.getItem(PROGRESS_KEY);if(!raw)return;const data=JSON.parse(raw);
   if(!data||typeof data!=='object')return;
   const valid=this.validIds();
   this.state={gems:integer(data.gems),completed:Array.isArray(data.completed)?[...new Set<string>(data.completed.filter((id:unknown)=>typeof id==='string'&&valid.has(id)))]:[],first:data.first==='lava'?'lava':'water',networkStep:integer(data.networkStep,16),petBest:integer(data.petBest,64),comboBest:integer(data.comboBest,64),clearBest:integer(data.clearBest),networkBest:integer(data.networkBest,64)};
  }catch{}
 }
 private save(){try{this.storage?.setItem(PROGRESS_KEY,JSON.stringify(this.state));}catch{}}
 active(){const done=new Set(this.state.completed),families=new Set<string>();return this.catalog().filter(a=>{if(done.has(a.id)||families.has(a.family))return false;families.add(a.family);return true;});}
 completed(){const done=new Set(this.state.completed);return this.catalog().filter(a=>done.has(a.id)).map(a=>({...a,progress:a.target}));}
 observe(game:Game,options:{calm:boolean;allowCleanBoard:boolean;suppressed?:boolean}):Achievement[]{
  const changed=this.lastBoard!==game.board||this.lastChange!==game.boardChange;
  const previous=this.lastBoard===game.board?this.lastTiles:Array(64).fill(null);
  this.lastBoard=game.board;this.lastChange=game.boardChange;this.lastTiles=[...game.board];
  if(options.suppressed)return [];
  const hatched=game.pets.filter(p=>p.hatchRemaining===0).length;
  if(!changed&&hatched<=this.state.petBest&&game.maxCombo<=this.state.comboBest&&game.tilesCleared<=this.state.clearBest&&!(options.calm&&options.allowCleanBoard&&!this.state.completed.includes('clean-slate')&&game.tilesCleared>0&&game.board.every(t=>t===null)))return [];
  const before=JSON.stringify(this.state),awards:Achievement[]=[];
  this.state.petBest=Math.max(this.state.petBest,hatched);
  this.state.comboBest=Math.max(this.state.comboBest,game.maxCombo);
  this.state.clearBest=Math.max(this.state.clearBest,game.tilesCleared);
  const award=(a:Achievement)=>{if(this.state.completed.includes(a.id))return;this.state.completed.push(a.id);this.state.gems+=a.reward;awards.push(a);};
  const catalog=this.catalog();
  for(const a of catalog)if(['pets','combo','clearing'].includes(a.family)&&a.progress>=a.target)award(a);
  // Only the currently active connection target can count on this board event.
  // A newly unlocked opposite-element target needs a later board change.
  if(changed&&this.state.networkStep<16){
   const step=this.state.networkStep,element=step%2===0?this.state.first:this.state.first==='water'?'lava':'water';
   const count=largestConnection(game.board,element);this.state.networkBest=Math.max(this.state.networkBest,count);
   const a=catalog.find(a=>a.id===`network-${step}`)!;
   const additions=new Set(game.board.flatMap((tile,c)=>tile===element&&previous[c]!==element?[c]:[]));
   if(largestConnection(game.board,element,additions)>=a.target){award(a);this.state.networkStep++;this.state.networkBest=0;}
  }
  if(options.calm&&options.allowCleanBoard&&game.tilesCleared>0&&game.board.every(t=>t===null))award(catalog.find(a=>a.id==='clean-slate')!);
  if(JSON.stringify(this.state)!==before)this.save();
  return awards;
 }
 spend(amount:number){this.reload();if(!Number.isSafeInteger(amount)||amount<=0||this.gems<amount)return false;this.state.gems-=amount;this.save();return true;}
}
