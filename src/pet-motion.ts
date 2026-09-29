import type {Element, Tile} from './game';

export const PET_LEAP_MIN=.5;
export const PET_LEAP_MAX=1.28;
export const PET_LEAP_SPEED=15; // World units per second, bounded by the stone reaction beats.

interface PetShuffle {members:PetMotion[];targets:number[];retreat:boolean}

export class PetMotion {
  private shuffle:PetShuffle|null=null;
  private shuffleRetry=0;
  attacking=false;
  leaping=false;
  leapProgress=0;
  private flight:{x:number;y:number;target:number;age:number;duration:number;hit?:()=>void;cancelled?:boolean}|null=null;
  hatchRemaining=0;
  startHatch(){this.hatchRemaining=1.8;this.revision++;}
  abilitiesUsed=0;
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
  private escapingStep=false;
  private escapeCache:{key:string;value:number|null}|null=null;
  private recent:number[]=[];
  constructor(public cell:number,readonly element:Element,private readonly board:readonly (Tile|null)[],private readonly arrive:(cell:number)=>boolean|void,private readonly random:()=>number=Math.random,private readonly boardVersion?:()=>number,private readonly peers?:()=>readonly PetMotion[],private readonly attack?:()=>{cells:number[];hit:()=>void}|null,private readonly preferred?:()=>readonly number[]){this.x=cell%8;this.y=Math.floor(cell/8);}
  get onOwnLiquid(){return this.board[Math.round(this.y)*8+Math.round(this.x)]===this.element;}
  queueAbility(){this.queued++;this.revision++;}
  cancelAbilities(){this.queued=0;if(this.flight){this.flight.cancelled=true;this.flight.hit=undefined;}this.attacking=false;this.revision++;}
  private leapTarget(){
    let distance=Infinity;const choices:number[]=[];
    const preferred=this.preferred?.().filter(c=>this.board[c]===null&&this.allowed(c)&&this.available(c))??[];
    for(let c=0;c<64;c++){
      if(this.board[c]!==null||!this.allowed(c)||!this.available(c)||(preferred.length&&!preferred.includes(c)))continue;
      const d=Math.hypot(c%8-this.x,Math.floor(c/8)-this.y);
      if(d<distance-1e-9){distance=d;choices.length=0;choices.push(c);}
      else if(Math.abs(d-distance)<1e-9)choices.push(c);
    }
    return choices.length===1?choices[0]:choices.length?this.pick(choices):null;
  }
  private startLeap(){
    const attack=this.attack?.();
    const targets=attack?.cells.filter(c=>this.available(c))??[];
    const target=attack?(targets[0]??null):this.leapTarget();if(target===null)return false;
    this.attacking=!!attack;
    const distance=Math.hypot(target%8-this.x,Math.floor(target/8)-this.y)*2;
    const duration=Math.max(PET_LEAP_MIN,Math.min(PET_LEAP_MAX,distance/PET_LEAP_SPEED))*(attack?2:1);
    this.flight={x:this.x,y:this.y,target,age:0,duration,hit:attack?.hit};this.next=target;this.progress=0;this.leaping=true;this.leapProgress=0;this.retreating=false;
    const dx=target%8-this.x,dy=Math.floor(target/8)-this.y;if(dx||dy)this.heading=Math.atan2(-dx,-dy);
    this.revision++;return true;
  }
  private land(){
    const flight=this.flight;if(!flight)return;
    this.cell=flight.target;this.x=this.cell%8;this.y=Math.floor(this.cell/8);this.next=null;this.progress=0;
    this.flight=null;this.leaping=false;this.leapProgress=0;this.planting=.000001;this.revision++;
    if(flight.cancelled)return;
    if(flight.hit){flight.hit();this.queued--;this.attacking=false;}
    else if(this.allowed(this.cell)&&this.board[this.cell]===null&&this.arrive(this.cell)!==false){this.queued--;this.abilitiesUsed++;}
    // A changed landing tile never consumes the action: retry after recovery.
  }
  // Moving pets reserve their destination, not the tile they are leaving.
  // Resting, hatching, and charging pets hold the tile underneath them.
  private available(cell:number){return !this.peers?.().some(p=>p!==this&&((p.next??p.cell)===cell||p.shuffle?.members.some(member=>member.cell===cell)));}
  private routingKey(){
    return this.boardVersion?`${this.cell}:${this.boardVersion()}:${this.peers?.().filter(p=>p!==this).map(p=>p.next??p.cell).join(',')??''}`:null;
  }
  private pick<T>(items:readonly T[]):T{return items[Math.min(items.length-1,Math.floor(this.random()*items.length))];}
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
  private tryShuffle(){
    if(this.shuffleRetry>0)return false;
    this.shuffleRetry=.25+this.random()*.25;
    const peers=this.peers?.()??[];
    const readiness=new Map<PetMotion,boolean>();
    const ready=(p:PetMotion)=>{if(!readiness.has(p))readiness.set(p,p.next===null&&!p.shuffle&&!p.hatchRemaining&&!p.planting&&!p.leaping&&p.allowed(p.cell)&&!p.busy);return readiness.get(p)!;};
    if(!ready(this))return false;
    const at=new Map(peers.filter(ready).map(p=>[p.cell,p]));at.set(this.cell,this);
    let budget=96;
    const search=(path:PetMotion[]):PetMotion[]|null=>{
      if(--budget<0)return null;
      const last=path[path.length-1];
      const options=last.neighbors(last.cell).filter(c=>Math.abs(c%8-last.cell%8)+Math.abs(Math.floor(c/8)-Math.floor(last.cell/8))===1)
        .filter(c=>!peers.some(p=>!path.includes(p)&&!ready(p)&&((p.next??p.cell)===c||p.shuffle?.members.some(m=>m.cell===c))));
      // Randomized order avoids always shuffling the same pair; favor a small loop over a swap.
      for(let i=options.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
      if(path.length<4)for(const c of options){const next=at.get(c);if(next&&!path.includes(next)){const result=search([...path,next]);if(result)return result;}}
      return path.length>=2&&options.includes(this.cell)?path:null;
    };
    const members=search([this]);if(!members)return false;
    const group:PetShuffle={members,targets:members.map((_,i)=>members[(i+1)%members.length].cell),retreat:false};
    members.forEach((p,i)=>{p.shuffle=group;p.next=group.targets[i];p.progress=0;p.retreating=false;p.escapingStep=false;p.revision++;});
    return true;
  }
  private updateShuffle(dt:number){
    const group=this.shuffle!;
    // If terrain changes under a coordinated path, everyone returns together.
    if(group.members.some((p,i)=>!p.allowed(group.targets[i])))group.retreat=true;
    const target=group.targets[group.members.indexOf(this)],sx=this.cell%8,sy=Math.floor(this.cell/8),dx=target%8-sx,dy=Math.floor(target/8)-sy;
    this.progress=Math.max(0,Math.min(1,this.progress+(group.retreat?-1:1)*dt*1.7/2));
    // A small passing lane keeps a swapping pair from walking through each other.
    const side=group.members.length===2?Math.sin(this.progress*Math.PI)*.14:0;
    this.x=sx+dx*this.progress-dy*side;this.y=sy+dy*this.progress+dx*side;
    this.heading=Math.atan2(-dx,-dy)+(group.retreat?Math.PI:0);
    const complete=group.members.every(p=>group.retreat?p.progress===0:p.progress===1);
    if(!complete)return;
    group.members.forEach((p,i)=>{
      if(!group.retreat){p.recent.push(p.cell);if(p.recent.length>8)p.recent.shift();p.cell=group.targets[i];p.completed++;}
      p.x=p.cell%8;p.y=Math.floor(p.cell/8);p.next=null;p.progress=0;p.shuffle=null;p.shuffleRetry=.2;p.revision++;
    });
  }
  // A tile can become unsafe underneath a pet. Only in that case allow a
  // cardinal escape across hostile liquid/shoreline to the nearest safe tile.
  // Stones remain obstacles; normal wandering never uses this exception.
  private escapeRoute():number|null {
    const key=this.routingKey();
    if(key&&this.escapeCache?.key===key)return this.escapeCache.value;
    const queue=[this.cell],first=Array<number>(64).fill(-1),seen=new Set(queue);
    let result:number|null=null;
    for(let i=0;i<queue.length;i++){
      const c=queue[i];
      if(c!==this.cell&&this.allowed(c)){result=first[c];break;}
      const x=c%8,y=Math.floor(c/8);
      for(const n of [x>0?c-1:-1,x<7?c+1:-1,y>0?c-8:-1,y<7?c+8:-1]){
        if(n<0||seen.has(n)||this.board[n]==='stone'||!this.available(n))continue;
        seen.add(n);first[n]=c===this.cell?n:first[c];queue.push(n);
      }
    }
    if(key)this.escapeCache={key,value:result};
    return result;
  }
  // Cosmetic wandering must never keep a lost run alive indefinitely.
  get busy(){return this.hatchRemaining>0||this.leaping||this.planting>0||(this.queued>0&&(this.attack?.()?.cells.some(c=>this.available(c))||this.leapTarget()!==null));}
  update(dt:number){
    this.shuffleRetry=Math.max(0,this.shuffleRetry-dt);
    if(this.shuffle){this.updateShuffle(dt);return;}
    if(this.hatchRemaining>0){const used=Math.min(dt,this.hatchRemaining);this.hatchRemaining-=used;dt-=used;if(this.hatchRemaining===0)this.revision++;}
    while(dt>0){
      if(this.flight){
        const f=this.flight,used=Math.min(dt,Math.max(0,f.duration-f.age));f.age+=used;dt-=used;
        const t=this.leapProgress=Math.min(1,f.age/f.duration);
        this.x=f.x+(f.target%8-f.x)*t;this.y=f.y+(Math.floor(f.target/8)-f.y)*t;
        if(t===1)this.land();
        continue;
      }
      if(this.planting>0){const used=Math.min(dt,.18-this.planting);this.planting+=used;dt-=used;if(this.planting>=.18){this.planting=0;this.revision++;}continue;}
      if(this.queued>0&&this.startLeap())continue;
      if(this.next===null){
        const unsafe=!this.allowed(this.cell);
        const target=unsafe?this.escapeRoute():null;
        if(unsafe&&target===null)break;
        this.escapingStep=unsafe;
        let choices=this.neighbors(this.cell).filter(n=>this.available(n));
        if(target!==null)choices=[target];
        else{const fresh=choices.filter(n=>!this.recent.includes(n));if(fresh.length)choices=fresh;}
        if(!choices.length){if(!unsafe&&this.tryShuffle())this.updateShuffle(dt);break;}
        this.next=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];this.progress=0;this.retreating=false;
      }
      const sx=this.cell%8,sy=Math.floor(this.cell/8),dx=this.next%8-sx,dy=Math.floor(this.next/8)-sy;
      const blocked=this.escapingStep?this.board[this.next]==='stone':!this.allowed(this.next)||(dx&&dy&&(!this.allowed(sy*8+sx+dx)||!this.allowed((sy+dy)*8+sx)));
      if(blocked)this.retreating=true;
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
