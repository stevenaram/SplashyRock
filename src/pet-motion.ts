import type {Element, Tile} from './game';

// Three distinct destinations per move, with live rerouting around new pieces.
export class PetMotion {
  queued=0;
  completed=0;
  revision=0;
  next:number|null=null;
  progress=0;
  planting=0;
  x:number;
  y:number;
  heading=0;
  private retreating=false;
  private visited:Set<number>;
  private recent:number[]=[];
  constructor(public cell:number,readonly element:Element,private readonly board:readonly (Tile|null)[],private readonly arrive:(cell:number)=>void,private readonly random:()=>number=Math.random,private readonly plain:(cell:number)=>boolean=cell=>board[cell]===null,private readonly trail:(cell:number)=>void=()=>{}){
    this.x=cell%8;this.y=Math.floor(cell/8);this.visited=new Set([cell]);
  }
  addMove(){this.queued+=3;}
  private allowed(cell:number){return this.board[cell]!== (this.element==='lava'?'water':'lava')&&this.board[cell]!=='stone';}
  private neighbors(cell:number){
    const x=cell%8,y=Math.floor(cell/8),result:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy,n=ny*8+nx;
      if((!dx&&!dy)||nx<0||nx>7||ny<0||ny>7||!this.allowed(n))continue;
      if(dx&&dy&&(!this.allowed(y*8+nx)||!this.allowed(ny*8+x)))continue;
      result.push(n);
    }
    return result;
  }
  private choices(){
    // Distances lead out of an elemental patch toward the nearest plain sand.
    const distances=Array<number>(64).fill(64),queue:number[]=[];
    for(let c=0;c<64;c++)if(this.plain(c)&&this.allowed(c)){distances[c]=0;queue.push(c);}
    for(let i=0;i<queue.length;i++)for(const n of this.neighbors(queue[i]))if(distances[n]>distances[queue[i]]+1){distances[n]=distances[queue[i]]+1;queue.push(n);}
    const remaining=3-this.completed%3;
    const candidates:{first:number;score:number}[]=[];
    const walk=(cell:number,path:number[],seen:Set<number>,score:number)=>{
      if(path.length===remaining){candidates.push({first:path[0],score:score+(this.board[cell]===null?0:150)});return;}
      for(const n of this.neighbors(cell)){
        if(seen.has(n))continue;
        const nextSeen=new Set(seen);nextSeen.add(n);
        const cost=distances[n]*(remaining-path.length)*20+(this.plain(n)?0:10)+(this.recent.includes(n)?12:0)+Math.hypot(n%8-cell%8,Math.floor(n/8)-Math.floor(cell/8))*(distances[cell]>0?.25:0);
        walk(n,[...path,n],nextSeen,score+cost);
      }
    };
    walk(this.cell,[],this.visited,0);
    const best=Math.min(...candidates.map(c=>c.score));
    return [...new Set(candidates.filter(c=>c.score===best).map(c=>c.first))];
  }
  get busy(){return this.planting>0||this.next!==null||(this.queued>0&&this.choices().length>0);}
  update(dt:number){
    while(dt>0&&(this.queued>0||this.planting>0)){
      if(this.planting>0){
        const before=this.planting,used=Math.min(dt,.56-before);this.planting+=used;dt-=used;
        if(before<.3&&this.planting>=.3){this.arrive(this.cell);this.revision++;}
        if(this.planting>=.56){this.planting=0;this.revision++;}
        continue;
      }
      if(this.next===null){const choices=this.choices();if(!choices.length)break;this.next=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.progress=0;this.retreating=false;}
      const sx=this.cell%8,sy=Math.floor(this.cell/8),dx=this.next%8-sx,dy=Math.floor(this.next/8)-sy;
      if(!this.allowed(this.next)||(dx&&dy&&(!this.allowed(sy*8+sx+dx)||!this.allowed((sy+dy)*8+sx))))this.retreating=true;
      const duration=Math.hypot(dx,dy)*2/1.7;
      const remaining=(this.retreating?this.progress:1-this.progress)*duration;
      const used=Math.min(dt,remaining);dt-=used;this.progress+=used/duration*(this.retreating?-1:1);
      this.x=sx+dx*this.progress;this.y=sy+dy*this.progress;
      this.heading=Math.atan2(-dx,-dy)+(this.retreating?Math.PI:0);
      if(used>=remaining){
        if(!this.retreating){
          this.cell=this.next;this.queued--;this.completed++;this.revision++;this.visited.add(this.cell);
          this.recent.push(this.cell);if(this.recent.length>12)this.recent.shift();
          if(this.completed%3===0){this.planting=.000001;this.visited=new Set([this.cell]);}
          else this.trail(this.cell);
        }
        this.x=this.cell%8;this.y=Math.floor(this.cell/8);this.next=null;this.progress=0;
      }
    }
  }
}
