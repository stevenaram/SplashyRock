import type {Element, Tile} from './game';

export class PetMotion {
  hatchRemaining=0;
  startHatch(){this.hatchRemaining=1.8;this.revision++;}
  queued=0; // Ready abilities, not walking steps.
  completed=0;
  revision=0;
  next:number|null=null;
  progress=0;
  planting=0;
  x:number;
  y:number;
  heading=0;
  private retreating=false;
  private recent:number[]=[];
  private routeCache:{key:string;value:number|null}|null=null;
  constructor(public cell:number,readonly element:Element,private readonly board:readonly (Tile|null)[],private readonly arrive:(cell:number)=>boolean|void,private readonly random:()=>number=Math.random,private readonly boardVersion?:()=>number){this.x=cell%8;this.y=Math.floor(cell/8);}
  get onOwnLiquid(){return this.board[Math.round(this.y)*8+Math.round(this.x)]===this.element;}
  queueAbility(){this.queued++;this.revision++;}
  private allowed(cell:number){
    if(this.board[cell]===this.element)return true;
    if(this.board[cell]!==null)return false;
    const opposite=this.element==='water'?'lava':'water',x=cell%8,y=Math.floor(cell/8);
    return ![x>0?cell-1:-1,x<7?cell+1:-1,y>0?cell-8:-1,y<7?cell+8:-1].some(n=>n>=0&&this.board[n]===opposite);
  }
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
  private sandRoute(){
    const key=this.boardVersion?`${this.cell}:${this.boardVersion()}`:null;
    if(key&&this.routeCache?.key===key)return this.routeCache.value;
    const value=this.findSandRoute();if(key)this.routeCache={key,value};return value;
  }
  private findSandRoute(){
    // Dijkstra chooses the nearest reachable sand by actual walking distance.
    const distance=Array<number>(64).fill(Infinity),first=Array<number>(64).fill(-1),visited=new Set<number>();distance[this.cell]=0;
    for(let i=0;i<64;i++){
      let c=-1;for(let n=0;n<64;n++)if(!visited.has(n)&&(c<0||distance[n]<distance[c]))c=n;
      if(c<0||!Number.isFinite(distance[c]))break;
      if(this.board[c]===null&&this.allowed(c))return c===this.cell?this.cell:first[c];
      visited.add(c);
      for(const n of this.neighbors(c)){const d=distance[c]+Math.hypot(n%8-c%8,Math.floor(n/8)-Math.floor(c/8));if(d<distance[n]){distance[n]=d;first[n]=c===this.cell?n:first[c];}}
    }
    return null;
  }
  // Cosmetic wandering must never keep a lost run alive indefinitely.
  get busy(){return this.hatchRemaining>0||this.planting>0||(this.queued>0&&this.sandRoute()!==null);}
  update(dt:number){
    if(this.hatchRemaining>0){const used=Math.min(dt,this.hatchRemaining);this.hatchRemaining-=used;dt-=used;if(this.hatchRemaining===0)this.revision++;}
    while(dt>0){
      if(this.planting>0){
        const before=this.planting,used=Math.min(dt,.56-before);this.planting+=used;dt-=used;
        if(before<.3&&this.planting>=.3){if(this.allowed(this.cell)&&this.board[this.cell]===null&&this.arrive(this.cell)!==false)this.queued--;this.revision++;}
        if(this.planting>=.56){this.planting=0;this.revision++;}
        continue;
      }
      if(this.next===null){
        const target=this.queued>0?this.sandRoute():null;
        if(target===this.cell){this.planting=.000001;this.revision++;continue;}
        let choices=this.neighbors(this.cell);
        if(target!==null)choices=[target];
        else{const fresh=choices.filter(n=>!this.recent.includes(n));if(fresh.length)choices=fresh;}
        if(!choices.length)break;
        this.next=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.progress=0;this.retreating=false;
      }
      const sx=this.cell%8,sy=Math.floor(this.cell/8),dx=this.next%8-sx,dy=Math.floor(this.next/8)-sy;
      if(!this.allowed(this.next)||(dx&&dy&&(!this.allowed(sy*8+sx+dx)||!this.allowed((sy+dy)*8+sx))))this.retreating=true;
      const duration=Math.hypot(dx,dy)*2/1.7,remaining=(this.retreating?this.progress:1-this.progress)*duration;
      const used=Math.min(dt,remaining);dt-=used;this.progress+=used/duration*(this.retreating?-1:1);
      this.x=sx+dx*this.progress;this.y=sy+dy*this.progress;this.heading=Math.atan2(-dx,-dy)+(this.retreating?Math.PI:0);
      if(used>=remaining){
        if(!this.retreating){this.recent.push(this.cell);if(this.recent.length>8)this.recent.shift();this.cell=this.next;this.completed++;this.revision++;}
        this.x=this.cell%8;this.y=Math.floor(this.cell/8);this.next=null;this.progress=0;
      }
    }
  }
}
