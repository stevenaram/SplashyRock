export type Tile = 'water' | 'lava';
export const SIZE = 8;
export class Game {
  readonly board: (Tile | null)[] = Array(SIZE * SIZE).fill(null);
  inventory: (Tile | null)[];
  constructor(private readonly random: () => number = Math.random) {
    this.inventory = this.deal();
  }
  private deal(): Tile[] {
    return Array.from({ length: 3 }, () => this.random() < 0.5 ? 'water' : 'lava');
  }
  canPlace(cell: number): boolean {
    return Number.isInteger(cell) && cell >= 0 && cell < this.board.length && this.board[cell] === null;
  }
  place(slot: number, cell: number): boolean {
    const tile = this.inventory[slot];
    if (!tile || !this.canPlace(cell)) return false;
    this.board[cell] = tile;
    this.inventory[slot] = null;
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
