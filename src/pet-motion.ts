import type {Element, Tile} from './game';

// Logic is independent of rendering so queued travel and live obstacles stay testable.
export class PetMotion {
  queued=0;
  completed=0;
  next:number|null=null;
  progress=0;
  x:number;
  y:number;
  heading=0;
  private retreating=false;
  constructor(public cell:number,readonly element:Element,private readonly board:readonly (Tile|null)[],private readonly arrive:(cell:number)=>void,private readonly random:()=>number=Math.random){this.x=cell%8;this.y=Math.floor(cell/8);}
  addMove(){this.queued+=3;}
  private allowed(cell:number){return this.board[cell]!== (this.element==='lava'?'water':'lava')&&this.board[cell]!=='stone';}
  private choices(){
    const x=this.cell%8,y=Math.floor(this.cell/8),result:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy,n=ny*8+nx;
      if((!dx&&!dy)||nx<0||nx>7||ny<0||ny>7||!this.allowed(n))continue;
      if(dx&&dy&&(!this.allowed(y*8+nx)||!this.allowed(ny*8+x)))continue;
      result.push(n);
    }
    return result;
  }
  get busy(){return this.next!==null||(this.queued>0&&this.choices().length>0);}
  update(dt:number){
    while(dt>0&&this.queued>0){
      if(this.next===null){const choices=this.choices();if(!choices.length)break;this.next=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.progress=0;this.retreating=false;}
      const sx=this.cell%8,sy=Math.floor(this.cell/8),dx=this.next%8-sx,dy=Math.floor(this.next/8)-sy;
      if(!this.allowed(this.next)||(dx&&dy&&(!this.allowed(sy*8+sx+dx)||!this.allowed((sy+dy)*8+sx))))this.retreating=true;
      // 1.7 world units per second, including diagonals; no easing or dwell time.
      const duration=Math.hypot(dx,dy)*2/1.7;
      const remaining=(this.retreating?this.progress:1-this.progress)*duration;
      const used=Math.min(dt,remaining);dt-=used;this.progress+=used/duration*(this.retreating?-1:1);
      this.x=sx+dx*this.progress;this.y=sy+dy*this.progress;
      this.heading=Math.atan2(-dx,-dy)+(this.retreating?Math.PI:0);
      if(used>=remaining){
        if(!this.retreating){this.cell=this.next;this.queued--;this.completed++;if(this.completed%3===0)this.arrive(this.cell);}
        this.x=this.cell%8;this.y=Math.floor(this.cell/8);this.next=null;this.progress=0;
      }
    }
  }
}
