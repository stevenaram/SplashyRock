import type { Game } from './game';
export const STONE_DELAY_MS = 500;

export class StoneReactions {
  private readonly pending = new Map<number, ReturnType<typeof setTimeout>>();
  constructor(private readonly game: Game, private readonly onStone: (cell: number) => void, private readonly onSettled: () => void = () => {}) {}
  get busy() { return this.pending.size > 0; }

  // Reconcile after every committed board change, never from a hover preview.
  schedule() {
    // A sweep can remove a required neighbor before the delay expires. Drop
    // stale work so a later qualifying state gets its own full reaction delay.
    for (const [cell, timer] of this.pending) {
      if (!this.game.canFormStone(cell)) { clearTimeout(timer); this.pending.delete(cell); }
    }
    for (const cell of this.game.stoneCandidates()) {
      if (this.pending.has(cell)) continue;
      const revision = this.game.boardRevision;
      this.pending.set(cell, setTimeout(() => {
        this.pending.delete(cell);
        // Another piece may have filled this cell during the delay.
        if (revision === this.game.boardRevision && this.game.formStone(cell)) this.onStone(cell);
        this.onSettled();
      }, STONE_DELAY_MS));
    }
  }

  dispose() {
    this.pending.forEach(timer => clearTimeout(timer));
    this.pending.clear();
  }
}


export const STONE_BURY_MS = 500;
export const NEIGHBOR_SWEEP_MS = 280;
export class SandSweeps {
  private readonly scheduled = new Set<string>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  get busy() { return this.timers.size > 0; }
  constructor(private readonly game: Game, private readonly onSweep: (cells: number[], origin: number, phase: 'stone'|'neighbors') => void, private readonly onSettled: () => void) {}
  private later(delay: number, callback: () => void) {
    const timer=setTimeout(()=>{this.timers.delete(timer);callback();},delay);this.timers.add(timer);
  }
  schedule() {
    this.game.board.forEach((tile,cell)=>{
      if(tile!=='stone')return;
      const version=this.game.versions[cell],key=`${cell}:${version}`;
      if(this.scheduled.has(key))return;
      this.scheduled.add(key);
      this.later(STONE_BURY_MS,()=>{
        const removed=this.game.board[cell]==='stone'&&this.game.versions[cell]===version?this.game.clearCells([cell]):[];
        this.onSweep(removed,cell,'stone');
        // Reserve phase two before reporting completion: game-over must not
        // fire in the short visual pause between the two stages.
        this.later(NEIGHBOR_SWEEP_MS,()=>{
          const cleared=this.game.clearCells(this.game.neighbors(cell));
          this.scheduled.delete(key);this.onSweep(cleared,cell,'neighbors');this.onSettled();
        });
        this.onSettled();
      });
    });
  }
  dispose(){this.timers.forEach(clearTimeout);this.timers.clear();this.scheduled.clear();}
}
