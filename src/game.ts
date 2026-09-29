import {BOSS_DEATH_SECONDS,elementalPools,poolBlocks,poolSquares,type Boss} from './boss';
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
  readonly bosses:Boss[]=[];
  get boss(){return this.bosses.find(b=>!b.deathRemaining)??null;}
  get bossesDying(){return this.bosses.some(b=>b.deathRemaining>0);}
  bossesDefeated=0;
  shapeMoves=0;
  private bossId=0;
  readonly bossStoneEvents:number[]=[];
  readonly bossLiquidEvents:{cell:number;element:Element}[]=[];
  readonly bossGrowthEvents:{cell:number;element:Element}[]=[];
  bossNotice='';

  trySpawnBoss(pending=false){
    if(pending||this.over||this.reviving)return false;
    let spawned=false;
    for(const {element,cells:pool} of elementalPools(this.board)){
      if(this.bosses.some(b=>b.element===element))continue;
      const remaining=new Set(pool),blocks=poolBlocks(remaining);if(!blocks.length)continue;
      const anchor=blocks[Math.floor(this.random()*blocks.length)],cell=anchor+9;
      this.bosses.push({id:++this.bossId,element,cell,pool,remaining,hits:0,x:cell%8+.5,y:Math.floor(cell/8)+.5,moveAge:0,deathRemaining:0,maxTiles:pool.length,regionRevision:this.boardChange,expansionParity:0});spawned=true;
      this.bossNotice=`${element==='lava'?'Lava':'Water'} boss! Break up its pool until no 2×2 patch remains.`;
    }return spawned;
  }
  private reconcileBossRegion(b:Boss){
    if(b.deathRemaining)return;
    // Choose the surviving liquid directly under the boss, never a distant island.
    const x=Math.max(0,Math.min(6,Math.round(b.x-.5))),y=Math.max(0,Math.min(6,Math.round(b.y-.5))),foot=y*8+x;
    const seeds=[foot,foot+1,foot+8,foot+9].filter(c=>this.board[c]===b.element);
    seeds.sort((a,c)=>Math.hypot(a%8-b.x,Math.floor(a/8)-b.y)-Math.hypot(c%8-b.x,Math.floor(c/8)-b.y));
    const region=new Set<number>(),queue=seeds.length?[seeds[0]]:[];
    if(queue.length)region.add(queue[0]);
    for(let i=0;i<queue.length;i++)for(const n of this.neighbors(queue[i]))if(this.board[n]===b.element&&!region.has(n)){region.add(n);queue.push(n);}
    const lost=[...b.remaining].some(c=>!region.has(c));if(lost)b.hits++;
    b.remaining=region;b.pool=[...region];b.regionRevision=this.boardChange;b.maxTiles=Math.max(b.maxTiles,region.size);
    if(!poolSquares(region).length){b.cell=foot;this.beginBossDeath(b);}
  }
  private heldByDyingBoss(cell:number){return this.bosses.some(b=>b.deathRemaining>0&&b.remaining.has(cell));}
  private beginBossDeath(b:Boss){
    if(b.deathRemaining)return;
    b.deathRemaining=BOSS_DEATH_SECONDS;b.x=b.cell%8+.5;b.y=Math.floor(b.cell/8)+.5;
    const held=[b.cell,b.cell+1,b.cell+8,b.cell+9];
    for(const c of b.remaining)if(!held.includes(c)&&this.board[c]===b.element){this.write(c,'stone');this.stoneDepth[c]=1;this.bossStoneEvents.push(c);}
    b.remaining=new Set(held);
    for(const c of held){this.write(c,b.element);this.bossLiquidEvents.push({cell:c,element:b.element});}
    this.bossNotice='Boss defeated!';
  }
  dealInventory(){this.inventory=this.deal();}
  private growBosses(){
    for(const b of this.bosses)if(b.regionRevision!==this.boardChange)this.reconcileBossRegion(b);
    // Alternate checkerboard colors each shape placement, including blocked turns.
    // Snapshot every frontier first so a surge never grows more than one layer.
    const proposals=this.bosses.filter(b=>!b.deathRemaining).map(b=>{
      const cells=new Set<number>();for(const c of b.remaining)for(const n of this.neighbors(c)){
        if(this.board[n]===null&&(n%8+Math.floor(n/8))%2===b.expansionParity)cells.add(n);
      }return {b,cells};
    });
    for(const {b,cells} of proposals){b.expansionParity=1-b.expansionParity;for(const c of cells)if(this.board[c]===null){this.write(c,b.element);b.remaining.add(c);this.bossGrowthEvents.push({cell:c,element:b.element});}
      this.reconcileBossRegion(b);
    }
  }
  updateBoss(dt:number){
    let finished=false;
    for(const b of [...this.bosses]){
      if(!b.deathRemaining&&b.regionRevision!==this.boardChange){this.reconcileBossRegion(b);if(b.deathRemaining)finished=true;}

      if(b.deathRemaining){b.deathRemaining=Math.max(0,b.deathRemaining-dt);if(b.deathRemaining===0){
        this.bosses.splice(this.bosses.indexOf(b),1);this.bossesDefeated++;if(!this.reviving)this.score+=250;
        for(const c of b.remaining){this.write(c,'stone');this.stoneDepth[c]=1;this.bossStoneEvents.push(c);}finished=true;
      }continue;}
      const squares=poolSquares(b.remaining);if(!squares.length)continue;
      if(!squares.includes(b.cell)){b.cell=squares.reduce((a,c)=>Math.hypot(c%8+.5-b.x,Math.floor(c/8)+.5-b.y)<Math.hypot(a%8+.5-b.x,Math.floor(a/8)+.5-b.y)?c:a);b.x=b.cell%8+.5;b.y=Math.floor(b.cell/8)+.5;}
      const tx=b.cell%8+.5,ty=Math.floor(b.cell/8)+.5,d=Math.hypot(tx-b.x,ty-b.y);
      if(d>.001){const step=Math.min(d,dt*.8);b.x+=(tx-b.x)/d*step;b.y+=(ty-b.y)/d*step;continue;}
      b.moveAge+=dt;if(b.moveAge<1.6)continue;b.moveAge=0;
      const choices=squares.filter(c=>this.neighbors(b.cell).includes(c));if(choices.length)b.cell=choices[Math.floor(this.random()*choices.length)];
    }return finished;
  }
  private helpfulPetTargets(element:Element):number[]{
    const pools=this.bosses.filter(b=>!b.deathRemaining&&b.element!==element);if(!pools.length)return [];
    return this.board.flatMap((tile,c)=>tile===null&&this.neighbors(c).some(gap=>this.board[gap]===null&&this.neighbors(gap).some(n=>pools.some(b=>b.remaining.has(n))))?[c]:[]);
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
    for(const cell of new Set(cells)){if(this.board[cell]!==null&&!this.heldByDyingBoss(cell)){this.write(cell,null);removed.push(cell);}}
    for(const boss of this.bosses)if(!boss.deathRemaining)this.reconcileBossRegion(boss);
    const cleared=removed.filter(c=>this.board[c]===null);
    if(!this.reviving){this.tilesCleared+=cleared.length;this.score+=cleared.length*10;if(this.combo>0)this.chainPoints+=cleared.length*10;}
    this.claimEggRewards();
    return cleared;
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
    if(!pending&&!this.bossesDying&&!this.petsBusy&&!this.hasLegalMove())this.over=true;
    return this.over;
  }
  restart() {
    this.bosses.length=0;this.bossesDefeated=0;this.shapeMoves=0;this.bossStoneEvents.length=0;this.bossGrowthEvents.length=0;this.bossLiquidEvents.length=0;this.bossNotice="";
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
    const cells=this.reviveTargets().filter(c=>!this.heldByDyingBoss(c));if(!cells.length)return [];
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
    const active=this.bosses.filter(b=>!b.deathRemaining),elements=new Set(active.map(b=>b.element));
    const bossCounter:Element|null=elements.size===1?(active[0].element==='water'?'lava':'water'):null;
    const hand=this.handsDealt++;
    const minoritySlot = Math.floor(this.random() * (hand===0?2:3));
    return Array.from({ length: 3 }, (_, slot) => ({
      shape: (()=>{
        const pool=hand===0?SHAPES.filter(s=>s.cells.length===(slot<2?1:3)):hand===1?SHAPES.filter(s=>slot<2?s.cells.length===3:s.cells.length>3):SHAPES;
        return pool[Math.floor(this.random()*pool.length)];
      })(),
      tile: bossCounter ?? (slot === minoritySlot ? (majority === 'water' ? 'lava' : 'water') : majority),
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
      this.growBosses();
    }
    this.inventory[slot] = null;
    this.claimEggRewards();
    if (this.inventory.every(item => item === null)) this.inventory = this.deal();
    return true;
  }
}
