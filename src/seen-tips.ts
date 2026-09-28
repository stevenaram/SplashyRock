export type TipId='intro-complete'|'intro'|'clearing'|'egg-goal'|'blocked-shape'|'pet-ability';
const PREFIX='splashy-rock-tip-v1:';

// Keep an in-memory fallback when private browsing or storage policy blocks writes.
export class SeenTips {
  private seen=new Set<TipId>();
  constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){}
  has(id:TipId){
    if(this.seen.has(id))return true;
    try{if(this.storage?.getItem(PREFIX+id)==='seen'){this.seen.add(id);return true;}}catch{}
    return false;
  }
  mark(id:TipId){this.seen.add(id);try{this.storage?.setItem(PREFIX+id,'seen');}catch{}}
}
let storage:Storage|undefined;
try{storage=globalThis.localStorage;}catch{}
export const seenTips=new SeenTips(storage);
