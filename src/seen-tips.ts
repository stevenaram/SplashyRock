import type {FeatureTip} from './feature-guidance';
import {sandboxMode} from './test-mode';
export type TipId=FeatureTip|'forge-drag'|'intro-complete'|'intro'|'clearing'|'egg-goal'|'blocked-shape'|'pet-ability'|'egg-drag'|'obsidian';
const PREFIX='splashy-rock-tip-v1:';

// Keep an in-memory fallback when private browsing or storage policy blocks writes.
export class SeenTips {
  private seen=new Set<TipId>();
  constructor(private storage?:Pick<Storage,'getItem'|'setItem'>,private persist:(id:TipId)=>boolean=()=>true){}
  has(id:TipId){
    if(this.seen.has(id))return true;
    try{if(this.persist(id)&&this.storage?.getItem(PREFIX+id)==='seen'){this.seen.add(id);return true;}}catch{}
    return false;
  }
  mark(id:TipId){this.seen.add(id);try{if(this.persist(id))this.storage?.setItem(PREFIX+id,'seen');}catch{}}
}
let storage:Storage|undefined;
try{storage=globalThis.localStorage;}catch{}
// Obsidian guidance is once per player, including sandbox visits and reloads.
// Other sandbox tutorials remain session-only, without altering normal progress.
export const seenTips=new SeenTips(storage,id=>!sandboxMode||id==='obsidian');


if(sandboxMode)for(const id of ['intro','intro-complete','clearing','egg-goal','blocked-shape','pet-ability'] as TipId[])seenTips.mark(id);
