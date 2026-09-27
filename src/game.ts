import {EGG_GOALS,MAX_PETS,earnedEggs} from './egg-goals';
import {PetMotion} from './pet-motion';
import { SHAPES, type Shape, type Offset } from './shapes';
export type Element = 'water' | 'lava';
export type Tile = Element | 'stone';
export interface Piece { tile: Element | 'pet'; shape: Shape; petElement?: Element }
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
  private handsDealt=0;
  boardRevision = 0;
  score = 0;
  over = false;
  won=false;
  rewardsDealt=0;
  boardChange=0;
  readonly pets:PetMotion[]=[];
  get pet(){return this.pets.at(-1)??null;}
  get petPlaced(){return this.pets.length>0;}
  get petRewardDealt(){return this.rewardsDealt>0;}
  get earnedEggs(){return earnedEggs(this.score);}
  get petsBusy(){return this.pets.some(p=>p.busy);}
  finishIfWon(){if(this.over)return this.won;if(this.pets.length===MAX_PETS&&this.pets.every(p=>p.hatchRemaining===0)){this.won=true;this.over=true;}return this.won;}
  moves=0;
  readonly petTileEvents:number[]=[];
  combo = 0;
  chainPoints = 0;
  readonly stoneDepth: number[] = Array(64).fill(0);
  readonly versions: number[] = Array(64).fill(0);
  constructor(private readonly random: () => number = Math.random) {
    this.inventory = this.deal();
  }
  private write(cell: number, tile: Tile | null) {
    if (this.board[cell] !== tile) { this.board[cell] = tile; this.versions[cell]++;this.boardChange++; }
  }
  neighbors(cell: number): number[] {
    const x=cell%SIZE,y=Math.floor(cell/SIZE);
    return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([x,y])=>x>=0&&x<SIZE&&y>=0&&y<SIZE).map(([x,y])=>y*SIZE+x);
  }
  clearCells(cells: readonly number[]): number[] {
    const removed: number[]=[];
    for(const cell of new Set(cells)){if(this.board[cell]!==null){this.write(cell,null);removed.push(cell);}}
    this.score+=removed.length*10;
    if(this.combo>0)this.chainPoints+=removed.length*10;
    this.claimEggRewards();
    return removed;
  }
  // Base reaction points are shown as earned; pay the remaining multiplier
  // once all reaction/sweep timers settle. Placements are never included.
  finishChain(): number {
    const bonus=this.chainPoints*Math.max(0,this.combo-1);
    this.score+=bonus;this.combo=0;this.chainPoints=0;
    this.claimEggRewards();
    return bonus;
  }
  pieceFits(piece:Piece):boolean {return this.board.some((_,cell)=>this.canPlace(piece,cell));}
  hasLegalMove(): boolean {
    return this.inventory.some(piece=>piece!==null&&this.pieceFits(piece));
  }
  finishIfBlocked(pending: boolean): boolean {
    if(!pending&&!this.petsBusy&&!this.hasLegalMove())this.over=true;
    return this.over;
  }
  restart() {
    this.pets.length=0;this.rewardsDealt=0;this.won=false;this.boardChange++;this.petTileEvents.length=0;this.moves=0;
    this.board.fill(null);this.versions.fill(0);this.boardRevision++;
    this.handsDealt=0;this.score=0;this.over=false;this.combo=0;this.chainPoints=0;this.stoneDepth.fill(0);this.inventory=this.deal();
  }
  private deal(): Piece[] {
    const occupied=this.board.filter(Boolean).length;
    const water=this.board.filter(t=>t==='water').length;
    const lava=this.board.filter(t=>t==='lava').length;
    const fallback:Element=this.random()<.5?'water':'lava';
    const majority: Element = water>occupied/2?'lava':lava>occupied/2?'water':fallback;
    const hand=this.handsDealt++;
    const minoritySlot = Math.floor(this.random() * (hand===0?2:3));
    return Array.from({ length: 3 }, (_, slot) => ({
      shape: (()=>{
        const pool=hand===0?SHAPES.filter(s=>s.cells.length===(slot<2?1:3)):hand===1?SHAPES.filter(s=>slot<2?s.cells.length===3:s.cells.length>3):SHAPES;
        return pool[Math.floor(this.random()*pool.length)];
      })(),
      tile: slot === minoritySlot ? (majority === 'water' ? 'lava' : 'water') : majority,
    }));
  }
  claimEggRewards(): number {
    if(this.over)return 0;
    let count=0;
    while(this.rewardsDealt<MAX_PETS&&this.score>=EGG_GOALS[this.rewardsDealt]){
      const egg:Piece={tile:'pet',shape:{id:'pet-egg',name:'Mystery Egg',width:1,height:1,cells:[[0,0]]}};
      const empty=this.inventory[1]===null?1:this.inventory.indexOf(null);
      if(empty<0)this.inventory.push(egg);else this.inventory[empty]=egg;
      this.rewardsDealt++;count++;
    }
    return count;
  }
  canPlace(piece: Piece, anchor: number): boolean {
    if(piece.tile==='pet'&&this.pets.length>=MAX_PETS)return false;
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
    return neighbors.includes('water')&&neighbors.includes('lava');
  }
  plantPetTile(cell:number,element:Element):boolean {
    if(this.over||this.board[cell]!==null)return false;
    this.write(cell,element);this.petTileEvents.push(cell);return true;
  }
  stoneCandidates(): number[] {
    return this.board.flatMap((_, cell) => this.canFormStone(cell) ? [cell] : []);
  }
  formStone(cell: number, depth = 1): boolean {
    if (!this.canFormStone(cell)) return false;
    this.write(cell, 'stone');
    this.score += 20;
    this.stoneDepth[cell]=depth;this.combo=Math.max(this.combo,depth);this.chainPoints+=20;
    this.claimEggRewards();
    return true;
  }
  place(slot: number, anchor: number): boolean {
    const piece = this.inventory[slot];
    if (this.over || !piece || !this.canPlace(piece, anchor)) return false;
    this.moves++;
    if(piece.tile==='pet'){
      const element:Element=this.pets.length===1?(this.pets[0].element==='lava'?'water':'lava'):piece.petElement??(this.random()<.5?'lava':'water');
      const pet=new PetMotion(anchor,element,this.board,cell=>this.plantPetTile(cell,element),this.random,()=>this.boardChange);
      pet.startHatch();this.pets.push(pet);
    }
    else {
      for (const [x, y] of footprint(piece, anchor)) this.write(y * SIZE + x, piece.tile);
      this.score += piece.shape.cells.length;
    }
    this.inventory[slot] = null;
    this.claimEggRewards();
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
