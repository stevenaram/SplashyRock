import { SHAPES, type Shape, type Offset } from './shapes';
export type Element = 'water' | 'lava';
export type Tile = Element | 'stone';
export interface Piece { tile: Element | 'pet'; shape: Shape }
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
  boardRevision = 0;
  score = 0;
  over = false;
  petRewardDealt=false;
  petPlaced=false;
  combo = 0;
  chainPoints = 0;
  readonly stoneDepth: number[] = Array(64).fill(0);
  readonly versions: number[] = Array(64).fill(0);
  constructor(private readonly random: () => number = Math.random) {
    this.inventory = this.deal();
  }
  private write(cell: number, tile: Tile | null) {
    if (this.board[cell] !== tile) { this.board[cell] = tile; this.versions[cell]++; }
  }
  neighbors(cell: number): number[] {
    const x=cell%SIZE,y=Math.floor(cell/SIZE);
    return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([x,y])=>x>=0&&x<SIZE&&y>=0&&y<SIZE).map(([x,y])=>y*SIZE+x);
  }
  clearCells(cells: readonly number[]): number[] {
    const removed: number[]=[];
    for(const cell of new Set(cells)) if(this.board[cell]!==null){this.write(cell,null);removed.push(cell);}
    this.score+=removed.length*10;
    if(this.combo>0)this.chainPoints+=removed.length*10;
    return removed;
  }
  // Base reaction points are shown as earned; pay the remaining multiplier
  // once all reaction/sweep timers settle. Placements are never included.
  finishChain(): number {
    const bonus=this.chainPoints*Math.max(0,this.combo-1);
    this.score+=bonus;this.combo=0;this.chainPoints=0;
    return bonus;
  }
  hasLegalMove(): boolean {
    return this.inventory.some(piece=>piece!==null&&this.board.some((_,cell)=>this.canPlace(piece,cell)));
  }
  finishIfBlocked(pending: boolean): boolean {
    if(!pending&&!this.hasLegalMove())this.over=true;
    return this.over;
  }
  restart() {
    this.board.fill(null);this.versions.fill(0);this.boardRevision++;
    this.score=0;this.over=false;this.petRewardDealt=false;this.petPlaced=false;this.combo=0;this.chainPoints=0;this.stoneDepth.fill(0);this.inventory=this.deal();
  }
  private deal(): Piece[] {
    if(this.score>=5000&&!this.petRewardDealt){
      this.petRewardDealt=true;
      const first:Element=this.random()<.5?'water':'lava';
      const shape=()=>SHAPES[Math.floor(this.random()*SHAPES.length)];
      return [{tile:first,shape:shape()},{tile:'pet',shape:{id:'lava-pet',name:'Lava pet',width:1,height:1,cells:[[0,0]]}},{tile:first==='water'?'lava':'water',shape:shape()}];
    }
    const majority: Element = this.random() < .5 ? 'water' : 'lava';
    const minoritySlot = Math.floor(this.random() * 3);
    return Array.from({ length: 3 }, (_, slot) => ({
      shape: SHAPES[Math.floor(this.random() * SHAPES.length)],
      tile: slot === minoritySlot ? (majority === 'water' ? 'lava' : 'water') : majority,
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
  formStone(cell: number, depth = 1): boolean {
    if (!this.canFormStone(cell)) return false;
    this.write(cell, 'stone');
    this.score += 20;
    this.stoneDepth[cell]=depth;this.combo=Math.max(this.combo,depth);this.chainPoints+=20;
    return true;
  }
  place(slot: number, anchor: number): boolean {
    const piece = this.inventory[slot];
    if (this.over || !piece || !this.canPlace(piece, anchor)) return false;
    if(piece.tile==='pet')this.petPlaced=true;
    else {
      for (const [x, y] of footprint(piece, anchor)) this.write(y * SIZE + x, piece.tile);
      this.score += piece.shape.cells.length;
    }
    this.inventory[slot] = null;
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
