import type { Game } from './game';
export const STONE_DELAY_MS = 500;

export class StoneReactions {
  private readonly pending = new Map<number, ReturnType<typeof setTimeout>>();
  constructor(private readonly game: Game, private readonly onStone: (cell: number) => void) {}

  // Called only after a committed placement, never from the hover preview.
  schedule() {
    for (const cell of this.game.stoneCandidates()) {
      if (this.pending.has(cell)) continue;
      this.pending.set(cell, setTimeout(() => {
        this.pending.delete(cell);
        // Another piece may have filled this cell during the delay.
        if (this.game.formStone(cell)) this.onStone(cell);
      }, STONE_DELAY_MS));
    }
  }

  dispose() {
    this.pending.forEach(timer => clearTimeout(timer));
    this.pending.clear();
  }
}
