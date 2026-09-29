import {Aftermath} from './aftermath';
import type { Game } from './game';
export const STONE_DELAY_MS = 500;

export class StoneReactions {
  private readonly pending = new Map<number, {timer:ReturnType<typeof setTimeout>; owner?:Aftermath}>();
  constructor(private readonly game: Game, private readonly onStone: (cell: number, owner?:Aftermath) => void, private readonly onSettled: () => void = () => {}) {}
  get busy() { return this.pending.size > 0; }

  get activeAftermaths(){return [...this.pending.values()].flatMap(job=>job.owner?[job.owner]:[]);}

  // Reconcile after every committed board change, never from a hover preview.
  schedule(depth = 1, owner?:Aftermath) {
    const own=!owner;let added=false;if(!owner)owner=new Aftermath(this.onSettled,this.game.comboRun);
    // A sweep can remove a required neighbor before the delay expires. Drop
    // stale work so a later qualifying state gets its own full reaction delay.
    for (const [cell, job] of this.pending) {
      if (!this.game.canFormStone(cell)) { clearTimeout(job.timer); this.pending.delete(cell);job.owner?.release(); }
    }
    for (const cell of this.game.stoneCandidates()) {
      if (this.pending.has(cell)) continue;
      const revision = this.game.boardRevision;
      owner?.retain();added=true;
      const timer=setTimeout(() => {
        this.pending.delete(cell);
        // Another piece may have filled this cell during the delay.
        if (revision === this.game.boardRevision && this.game.formStone(cell, depth,owner?.comboRun)) this.onStone(cell,owner);
        this.onSettled();owner?.release();
      }, STONE_DELAY_MS);
      this.pending.set(cell,{timer,owner});
    }
    if(own){if(added)owner.release();else owner.cancel();}
  }

  dispose() {
    this.pending.forEach(job => {clearTimeout(job.timer);job.owner?.release();});
    this.pending.clear();
  }
}


export const STONE_BURY_MS = 500;
export const NEIGHBOR_SWEEP_MS = 280;
export class SandSweeps {
  private readonly owners=new Map<string,Aftermath>();
  get activeAftermaths(){return [...this.owners.values()];}
  private readonly scheduled = new Set<string>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  get busy() { return this.timers.size > 0; }
  constructor(private readonly game: Game, private readonly onSweep: (cells: number[], origin: number, phase: 'stone'|'neighbors', depth: number, owner?:Aftermath) => void, private readonly onSettled: () => void) {}
  private later(delay: number, callback: () => void) {
    const timer=setTimeout(()=>{this.timers.delete(timer);callback();},delay);this.timers.add(timer);
  }
  schedule(owner?:Aftermath) {
    const own=!owner;let added=false;if(!owner)owner=new Aftermath(this.onSettled,this.game.comboRun);
    this.game.board.forEach((tile,cell)=>{
      if(tile!=='stone')return;
      const depth=this.game.stoneDepth[cell]||1;
      const comboRun=this.game.stoneComboRuns[cell];
      const version=this.game.versions[cell],key=`${cell}:${version}`;
      if(this.scheduled.has(key))return;
      this.scheduled.add(key);this.owners.set(key,owner!);owner?.retain();added=true;
      this.later(STONE_BURY_MS,()=>{
        const removed=this.game.board[cell]==='stone'&&this.game.versions[cell]===version?this.game.clearCells([cell],comboRun):[];
        this.onSweep(removed,cell,'stone',depth,owner);
        // Reserve phase two before reporting completion: game-over must not
        // fire in the short visual pause between the two stages.
        this.later(NEIGHBOR_SWEEP_MS,()=>{
          const cleared=this.game.clearCells(this.game.neighbors(cell),comboRun);
          this.scheduled.delete(key);this.owners.delete(key);this.onSweep(cleared,cell,'neighbors',depth,owner);this.onSettled();owner?.release();
        });
        this.onSettled();
      });
    });
    if(own){if(added)owner.release();else owner.cancel();}
  }
  dispose(){this.timers.forEach(clearTimeout);this.timers.clear();this.scheduled.clear();for(const owner of this.owners.values())owner.release();this.owners.clear();}
}
