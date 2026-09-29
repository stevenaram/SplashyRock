import type {Aftermath} from './aftermath';
import type {Element,Game} from './game';

/** A frozen completion fence: later placements cannot extend a queued spawn. */
export class BossSpawnQueue {
 private pending=new Map<Element,{cells:Set<number>;wait:Aftermath[]}>();
 constructor(private game:Game){}
 update(active:readonly Aftermath[]){
  const candidates=this.game.bossSpawnCandidates();
  for(const [element,entry] of this.pending){
   if(!candidates.some(p=>p.element===element&&p.cells.some(c=>entry.cells.has(c))))this.pending.delete(element);
  }
  for(const {element,cells} of candidates){
   if(!this.pending.has(element))this.pending.set(element,{cells:new Set(cells),wait:[...new Set(active)].filter(a=>!a.finished)});
  }
  for(const [element,entry] of this.pending){
   if(entry.wait.some(a=>!a.finished))continue;
   this.game.trySpawnBoss(false,element,entry.cells);this.pending.delete(element);
  }
 }
 reset(){this.pending.clear();}
}
