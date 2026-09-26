import { SHAPES, type Shape, type Offset } from './shapes';
export type Element = 'water' | 'lava';
export type Tile = Element | 'stone';
export interface Piece { tile: Element; shape: Shape }
export const SIZE = 8;

// The pointer anchors the center cell of a shape's bounding box. Holes remain
// holes: only the listed squares participate in collision and placement.
export function footprint(piece: Piece, anchor: number): Offset[] {
  const x = anchor % SIZE - Math.floor(piece.shape.width / 2);
  const y = Math.floor(anchor / SIZE) - Math.floor(piece.shape.height / 2);
  return piece.shape.cells.map(([dx, dy]) => [x + dx, y + dy]);
}
export class Game {
  readonly board: (Tile | null)[] = Array(SIZE * SIZE).fill(null);
  inventory: (Piece | null)[];
  constructor(private readonly random: () => number = Math.random) {
    this.inventory = this.deal();
  }
  private deal(): Piece[] {
    return Array.from({ length: 3 }, () => ({
      shape: SHAPES[Math.floor(this.random() * SHAPES.length)],
      tile: this.random() < 0.5 ? 'water' : 'lava',
    }));
  }
  canPlace(piece: Piece, anchor: number): boolean {
    if (!Number.isInteger(anchor) || anchor < 0 || anchor >= SIZE * SIZE) return false;
    return footprint(piece, anchor).every(([x, y]) =>
      x >= 0 && x < SIZE && y >= 0 && y < SIZE && this.board[y * SIZE + x] === null);
  }
  canFormStone(cell: number): boolean {
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || this.board[cell] !== null) return false;
    const x = cell % SIZE, y = Math.floor(cell / SIZE);
    const neighbors: Tile[] = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
        const tile = this.board[ny * SIZE + nx];
        if (tile) neighbors.push(tile);
      }
    }
    return neighbors.includes('water') && neighbors.includes('lava');
  }
  stoneCandidates(): number[] {
    return this.board.flatMap((_, cell) => this.canFormStone(cell) ? [cell] : []);
  }
  formStone(cell: number): boolean {
    if (!this.canFormStone(cell)) return false;
    this.board[cell] = 'stone';
    return true;
  }
  place(slot: number, anchor: number): boolean {
    const piece = this.inventory[slot];
    if (!piece || !this.canPlace(piece, anchor)) return false;
    for (const [x, y] of footprint(piece, anchor)) this.board[y * SIZE + x] = piece.tile;
    this.inventory[slot] = null;
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
