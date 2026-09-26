import type { Game } from './game';
export const STONE_DELAY_MS = 500;

export class StoneReactions {
  private readonly pending = new Map<number, ReturnType<typeof setTimeout>>();
  constructor(private readonly game: Game, private readonly onStone: (cell: number) => void) {}

  // Called only after a committed placement, never from the hover preview.
  schedule() {
    for (const cell of this.game.stoneCandidates()) {
      if (this.pending.has(cell)) continue;
      const revision = this.game.boardRevision;
      this.pending.set(cell, setTimeout(() => {
        this.pending.delete(cell);
        // Another piece may have filled this cell during the delay.
        if (revision === this.game.boardRevision && this.game.formStone(cell)) this.onStone(cell);
      }, STONE_DELAY_MS));
    }
  }

  dispose() {
    this.pending.forEach(timer => clearTimeout(timer));
    this.pending.clear();
  }
}


export const STONE_LINE_DELAY_MS = 500;
export class StoneLineClears {
  private readonly pending = new Set<number>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(private readonly game: Game, private readonly onClear: (cells: number[]) => void) {}
  schedule() {
    const cells = this.game.pendingStoneLines.filter(cell => !this.pending.has(cell));
    if (!cells.length) return;
    cells.forEach(cell => this.pending.add(cell));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      cells.forEach(cell => this.pending.delete(cell));
      const removed = this.game.removeStoneCells(cells);
      if (removed.length) this.onClear(removed);
    }, STONE_LINE_DELAY_MS);
    this.timers.add(timer);
  }
  dispose() { this.timers.forEach(clearTimeout); this.timers.clear(); this.pending.clear(); }
}
