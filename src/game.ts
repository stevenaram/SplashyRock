import {largestPool,poolSquares,type Boss} from './boss';
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
  boss:Boss|null=null;
  bossesDefeated=0;
  shapeMoves=0;
  private nextBossMove=0;
  private bossId=0;
  readonly bossStoneEvents:number[]=[];
  readonly bossHitEvents:{cell:number;element:Element}[]=[];
  bossNotice='';
  trySpawnBoss(){
    const hatched=this.pets.filter(p=>p.hatchRemaining===0);
    if(this.over||this.reviving||this.boss||hatched.length<3||this.shapeMoves<this.nextBossMove)return false;
    const lava=hatched.filter(p=>p.element==='lava').length;
    const element:Element=lava>hatched.length/2?'water':lava<hatched.length/2?'lava':this.random()<.5?'water':'lava';
    const pool=largestPool(this.board.map(t=>t===element?t:null),this.random),remaining=new Set(pool),squares=poolSquares(remaining);
    if(!squares.length)return false;
    const cell=squares[Math.floor(this.random()*squares.length)];
    this.boss={id:++this.bossId,element,cell,pool,remaining,hits:0,x:cell%8+.5,y:Math.floor(cell/8)+.5,moveAge:0};
    this.bossNotice=`${element==='lava'?'Lava':'Water'} boss! Break up its pool until no 2×2 patch remains.`;return true;
  }
  private damageBoss(){
    const boss=this.boss;if(!boss||(this.over&&!this.reviving))return;
    boss.hits++;
    if(poolSquares(boss.remaining).length)return;
    this.boss=null;this.bossesDefeated++;this.nextBossMove=this.shapeMoves+12;
    const reward=[...boss.remaining].filter(c=>this.board[c]===boss.element);
    for(const c of reward){this.write(c,'stone');this.stoneDepth[c]=1;this.bossStoneEvents.push(c);}
    if(!this.reviving)this.score+=250;
    this.bossNotice='Boss defeated! No 2×2 pool remains.';
  }
  readonly bossGrowthEvents:number[]=[];
  private bossGrowthQueue:number[]=[];
  get hasPendingBossGrowth(){return !!this.boss&&this.bossGrowthQueue.includes(this.boss.id);}
  resolveBossGrowth(pending:boolean){
    this.bossGrowthQueue=this.bossGrowthQueue.filter(id=>id===this.boss?.id);
    if(pending||this.over||this.reviving||!this.bossGrowthQueue.length)return false;
    this.bossGrowthQueue.shift();this.growBoss();return true;
  }
  dealInventory(){this.inventory=this.deal();}

  private growBoss(){
    const b=this.boss;if(!b)return;
    const additions=new Set<number>();
    for(const c of b.remaining)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const x=c%8+dx,y=Math.floor(c/8)+dy;if(x<0||x>7||y<0||y>7)continue;
      const n=y*8+x;if(this.board[n]===null)additions.add(n);
    }
    for(const c of additions){this.write(c,b.element);b.remaining.add(c);this.bossGrowthEvents.push(c);}
    // Connected same-element pieces become part of the territory too.
    const queue=[...b.remaining];for(let i=0;i<queue.length;i++)for(const n of this.neighbors(queue[i]))if(this.board[n]===b.element&&!b.remaining.has(n)){b.remaining.add(n);queue.push(n);}
    b.pool=[...b.remaining];
  }
  updateBoss(dt:number){
    const b=this.boss;if(!b)return;
    const squares=poolSquares(b.remaining);if(!squares.length)return;
    if(!squares.includes(b.cell)){b.cell=squares.reduce((a,c)=>Math.hypot(c%8+.5-b.x,Math.floor(c/8)+.5-b.y)<Math.hypot(a%8+.5-b.x,Math.floor(a/8)+.5-b.y)?c:a);b.x=b.cell%8+.5;b.y=Math.floor(b.cell/8)+.5;}
    const tx=b.cell%8+.5,ty=Math.floor(b.cell/8)+.5,d=Math.hypot(tx-b.x,ty-b.y);
    if(d>.001){const step=Math.min(d,dt*.8);b.x+=(tx-b.x)/d*step;b.y+=(ty-b.y)/d*step;return;}
    b.moveAge+=dt;if(b.moveAge<1.6)return;b.moveAge=0;
    const choices=squares.filter(c=>this.neighbors(b.cell).includes(c));if(choices.length)b.cell=choices[Math.floor(this.random()*choices.length)];
  }
  private helpfulPetTargets(element:Element):number[]{
    const b=this.boss;if(!b||b.element===element)return [];
    return this.board.flatMap((tile,c)=>tile===null&&this.neighbors(c).some(gap=>this.board[gap]===null&&this.neighbors(gap).some(n=>b.remaining.has(n)))?[c]:[]);
  }
  moves=0;
  maxCombo=0;
  tilesCleared=0;
  reviving=false;
  readonly petTileEvents:number[]=[];
  combo = 0;
  chainPoints = 0;
  readonly stoneDepth: number[] = Array(64).fill(0);
  readonly versions: number[] = Array(64).fill(0);
  constructor(private readonly random: () => number = Math.random, private readonly tutorialCompleted:()=>boolean=()=>false) {
    this.handsDealt=this.tutorialCompleted()?2:0;
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
    if(!this.reviving){this.tilesCleared+=removed.length;this.score+=removed.length*10;
    if(this.combo>0)this.chainPoints+=removed.length*10;}
    if(this.boss){let damage=0;for(const c of removed)if(this.boss.remaining.delete(c))damage++;if(damage)this.damageBoss();}
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
    this.bossGrowthQueue=[];this.boss=null;this.bossesDefeated=0;this.shapeMoves=0;this.nextBossMove=0;this.bossStoneEvents.length=0;this.bossGrowthEvents.length=0;this.bossHitEvents.length=0;this.bossNotice="";
    this.maxCombo=0;this.tilesCleared=0;this.reviving=false;
    this.pets.length=0;this.rewardsDealt=0;this.won=false;this.boardChange++;this.petTileEvents.length=0;this.moves=0;
    this.board.fill(null);this.versions.fill(0);this.boardRevision++;
    this.handsDealt=this.tutorialCompleted()?2:0;this.score=0;this.over=false;this.combo=0;this.chainPoints=0;this.stoneDepth.fill(0);this.inventory=this.deal();
  }
  reviveTargets():number[]{
    return [27,28,35,36];
  }
  beginRevive():number[]{
    if(!this.over||this.won||this.reviving)return [];
    const cells=this.reviveTargets();if(!cells.length)return [];
    this.reviving=true;this.combo=0;this.chainPoints=0;
    for(const cell of cells){this.write(cell,'stone');this.stoneDepth[cell]=1;}
    return cells;
  }
  finishRevive(){if(!this.reviving)return;this.reviving=false;this.over=false;}
  private deal(): Piece[] {

    const water=this.board.filter(t=>t==='water').length;
    const lava=this.board.filter(t=>t==='lava').length;
    const fallback:Element=this.random()<.5?'water':'lava';
    const majority: Element = water>lava?'lava':lava>water?'water':fallback;
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
    this.maxCombo=Math.max(this.maxCombo,depth);
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
      const pet=new PetMotion(anchor,element,this.board,cell=>this.plantPetTile(cell,element),this.random,()=>this.boardChange,()=>this.pets,undefined,()=>this.helpfulPetTargets(element));
      pet.startHatch();this.pets.push(pet);
    }
    else {
      this.shapeMoves++;
      for (const [x, y] of footprint(piece, anchor)) this.write(y * SIZE + x, piece.tile);
      this.score += piece.shape.cells.length;
      if(this.boss)this.bossGrowthQueue.push(this.boss.id);
    }
    this.inventory[slot] = null;
    this.claimEggRewards();
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
