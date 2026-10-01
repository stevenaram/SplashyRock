import {neighborSource,besideForge,emptyForgeBasin} from './neighbor-rules';
import type {Element, Tile} from './game';

export const PET_LEAP_MIN=.5;
export const PET_LEAP_MAX=1.28;
export const PET_LEAP_SPEED=15; // World units per second, bounded by the stone reaction beats.

export interface BuildDelivery {x:number;y:number;height:number;place:()=>void}
export class PetMotion {
  carryingBrick=false;
  altitude=0;
  get collectingBrick(){const job=this.snacks[0];return Boolean(job?.build&&!job.delivered&&(!job.stage||this.feeding>0));}
  get building(){return Boolean(this.snacks[0]?.build);}
  get flightDestination(){return this.flight?{x:this.flight.tx??this.flight.target%8,y:this.flight.ty??Math.floor(this.flight.target/8)}:null;}
  visualOffsetX=0;visualOffsetY=0;
  attacking=false;
  leaping=false;
  leapProgress=0;
  private flight:{x:number;y:number;target:number;age:number;duration:number;tx?:number;ty?:number;fromHeight?:number;toHeight?:number;hit?:()=>void;cancelled?:boolean}|null=null;
  hatchRemaining=0;
  startHatch(){this.hatchRemaining=1.8;this.revision++;}
  abilitiesUsed=0;
  private snacks:({cell:number;eat:()=>boolean;cancel:()=>void;blast?:(cell:number)=>boolean;stage?:boolean;build?:BuildDelivery;delivered?:boolean}|undefined)[]=[];
  snacksEaten=0;
  feeding=0;
  private abilityRuns:number[]=[];
  hasAbilityFor(run:number){return this.abilityRuns.includes(run);}
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
  constructor(public cell:number,readonly element:Element,private readonly board:readonly (Tile|null)[],private readonly arrive:(cell:number,comboRun?:number)=>boolean|void,private readonly random:()=>number=Math.random,private readonly boardVersion?:()=>number,private readonly peers?:()=>readonly PetMotion[],private readonly attack?:()=>{cells:number[];hit:()=>void}|null,private readonly preferred?:()=>readonly number[],private readonly reserved?:()=>ReadonlySet<number>,private readonly placementAllowed?:(cell:number)=>boolean){this.x=cell%8;this.y=Math.floor(cell/8);}
  get onOwnLiquid(){return this.board[Math.round(this.y)*8+Math.round(this.x)]===this.element;}
  queueAbility(comboRun=0){this.snacks.push(undefined);this.abilityRuns.push(comboRun);this.queued++;this.revision++;}
  queueSnack(run:number,cell:number,eat:()=>boolean,cancel:()=>void,blast?:(cell:number)=>boolean){this.queueAbility(run);this.snacks[this.snacks.length-1]={cell,eat,cancel,blast};}
  queueBuild(run:number,cell:number,take:()=>boolean,cancel:()=>void,build:BuildDelivery,blast:(cell:number)=>boolean){this.queueSnack(run,cell,take,cancel,blast);this.snacks[this.snacks.length-1]!.build=build;}
  cancelAbilities(){this.carryingBrick=false;this.snacks.forEach(s=>s?.cancel());this.snacks.length=0;this.abilityRuns.length=0;this.queued=0;if(this.flight){this.flight.cancelled=true;this.flight.hit=undefined;}this.feeding=0;this.attacking=false;if(!this.flight)this.returnFromBoat();this.revision++;}
  private leapTarget(){
    // Fuel every available forge before considering ordinary placement preferences.
    // next is reserved immediately on launch, so later pets choose another basin.
    const fuel=this.board.flatMap((_,c)=>emptyForgeBasin(this.board,c,this.element)&&this.available(c)?[c]:[]);
    if(fuel.length){const distance=(c:number)=>Math.hypot(c%8-this.x,Math.floor(c/8)-this.y),nearest=Math.min(...fuel.map(distance));return this.pick(fuel.filter(c=>Math.abs(distance(c)-nearest)<1e-9));}
    let distance=Infinity;const choices:number[]=[];
    const reserved=new Set(this.reserved?.());for(let c=0;c<64;c++)if(this.placementAllowed&&!this.placementAllowed(c))reserved.add(c);
    const awayFromBush=(c:number)=>!this.cardinal(c).some(n=>this.board[n]==='bush');
    const avoidBush=this.element==='lava'&&this.board.some((tile,c)=>tile===null&&this.allowed(c)&&this.available(c)&&!reserved?.has(c)&&awayFromBush(c));
    const preferred=this.preferred?.().filter(c=>this.board[c]===null&&this.allowed(c)&&this.available(c)&&!reserved?.has(c)&&(!avoidBush||awayFromBush(c)))??[];
    for(let c=0;c<64;c++){
      if(this.board[c]!==null||!this.allowed(c)||!this.available(c)||reserved?.has(c)||(avoidBush&&!awayFromBush(c))||(preferred.length&&!preferred.includes(c)))continue;
      const d=Math.hypot(c%8-this.x,Math.floor(c/8)-this.y);
      if(d<distance-1e-9){distance=d;choices.length=0;choices.push(c);}
      else if(Math.abs(d-distance)<1e-9)choices.push(c);
    }
    return choices.length===1?choices[0]:choices.length?this.pick(choices):null;
  }
  private startLeap(){
    const snack=this.snacks[0];
    if(snack?.build&&snack.stage&&!snack.delivered){
      const b=snack.build;this.carryingBrick=true;
      this.launch(this.closestBoardCell(b.x,b.y),b.x,b.y,b.height);return true;
    }
    if(snack?.build&&!snack.stage){
      const peers=this.peers?.()??[this],index=Math.max(0,peers.indexOf(this)),angle=.2+(index%8)/7*(Math.PI-.4);
      this.launch(snack.cell,snack.cell%8+Math.cos(angle)*.32,Math.floor(snack.cell/8)+.12+Math.sin(angle)*.24,.43);return true;
    }
    const attack=snack?null:this.attack?.();
    const targets=attack?.cells.filter(c=>this.available(c))??[];
    const target=snack?(snack.stage?this.berryTarget():snack.cell):attack?(targets[0]??null):this.leapTarget();if(target===null){if(snack?.stage){this.finishSnack();this.returnFromBoat();return true;}return false;}
    this.attacking=!!attack;
    const distance=Math.hypot(target%8-this.x,Math.floor(target/8)-this.y)*2;
    const duration=Math.max(PET_LEAP_MIN,Math.min(PET_LEAP_MAX,distance/PET_LEAP_SPEED))*(attack?2:1);
    this.flight={x:this.x,y:this.y,target,age:0,duration,fromHeight:this.altitude,toHeight:0,hit:attack?.hit};this.next=target;this.progress=0;this.leaping=true;this.leapProgress=0;this.retreating=false;
    const dx=target%8-this.x,dy=Math.floor(target/8)-this.y;if(dx||dy)this.heading=Math.atan2(-dx,-dy);
    this.revision++;return true;
  }
  private closestBoardCell(x:number,y:number){return Math.max(0,Math.min(7,Math.round(y)))*8+Math.max(0,Math.min(7,Math.round(x)));}
  private launch(target:number,x=target%8,y=Math.floor(target/8),height=0,cancelled=false){
    const duration=Math.max(.5,Math.min(1.28,Math.hypot(x-this.x,y-this.y)*2/15));
    this.flight={x:this.x,y:this.y,target,age:0,duration,tx:x,ty:y,fromHeight:this.altitude,toHeight:height,cancelled};
    this.next=target;this.leaping=true;this.leapProgress=0;this.heading=Math.atan2(this.x-x,this.y-y);this.revision++;
  }
  private returnFromBoat(){
    if(this.x>=0&&this.x<=7&&this.y>=0&&this.y<=7&&this.altitude===0)return;
    const safe=this.board.flatMap((_,c)=>this.allowed(c)?[c]:[]);
    const target=safe.sort((a,b)=>Math.hypot(a%8-this.x,Math.floor(a/8)-this.y)-Math.hypot(b%8-this.x,Math.floor(b/8)-this.y))[0]??this.closestBoardCell(this.x,this.y);
    this.launch(target,undefined,undefined,0,true);
  }
  private land(){
    const flight=this.flight;if(!flight)return;
    this.cell=flight.target;this.x=flight.tx??this.cell%8;this.y=flight.ty??Math.floor(this.cell/8);this.altitude=flight.toHeight??0;this.next=null;this.progress=0;
    this.flight=null;this.leaping=false;this.leapProgress=0;this.planting=.000001;this.revision++;
    if(flight.cancelled){this.returnFromBoat();return;}
    const snack=this.snacks[0];
    if(snack?.build&&snack.stage&&!snack.delivered){snack.build.place();snack.delivered=true;this.carryingBrick=false;return;}
    if(snack){if(snack.stage){snack.blast?.(this.cell);this.finishSnack();}else if(snack.eat()){this.feeding=snack.build?.7:1;this.planting=0;if(!snack.build)this.snacksEaten++;else this.carryingBrick=true;snack.stage=true;}else this.finishSnack();return;}
    if(flight.hit){flight.hit();this.queued--;this.abilityRuns.shift();this.snacks.shift();this.attacking=false;}
    else if((this.allowed(this.cell)||emptyForgeBasin(this.board,this.cell,this.element))&&this.board[this.cell]===null&&this.arrive(this.cell,this.abilityRuns[0])!==false){this.queued--;this.abilityRuns.shift();this.snacks.shift();this.abilitiesUsed++;}
    // A changed landing tile never consumes the action: retry after recovery.
  }
  private finishSnack(){this.carryingBrick=false;const snack=this.snacks.shift();this.abilityRuns.shift();this.queued--;snack?.cancel();this.revision++;}
  private berryTargetAllowed(c:number){
    const opposite=this.element==='lava'?'water':'lava';
    return this.board[c]===null&&this.available(c)&&this.cardinal(c).some(n=>neighborSource(this.board,n,opposite));
  }
  private berryTarget(){
    let distance=Infinity;const choices:number[]=[];
    const available=this.board.flatMap((_,c)=>this.berryTargetAllowed(c)?[c]:[]);
    const awayFromForge=available.filter(c=>!besideForge(this.board,c));
    const candidates=awayFromForge.length?awayFromForge:available;
    // Lava berry blasts favor water sources that are not feeding a bush.
    // Rank the water tile itself, not the sand tile where the pet lands.
    const preferred=this.element==='lava'?candidates.filter(c=>this.cardinal(c).some(n=>neighborSource(this.board,n,'water')&&!this.cardinal(n).some(b=>this.board[b]==='bush'))):[];
    // A launched jump exposes its destination through next immediately, so
    // subsequent pets in this frame must choose another available tile.
    for(const c of preferred.length?preferred:candidates){
      const d=Math.hypot(c%8-this.x,Math.floor(c/8)-this.y);if(d<distance-1e-9){distance=d;choices.length=0;choices.push(c);}else if(Math.abs(d-distance)<1e-9)choices.push(c);}
    return choices.length?this.pick(choices):null;
  }
  private cardinal(c:number){return [c%8?c-1:-1,c%8<7?c+1:-1,c-8,c+8].filter(n=>n>=0&&n<64);}
  // Ability landings keep exclusive destinations; wandering uses soft occupancy.
  private available(cell:number){return !this.peers?.().some(p=>p!==this&&((p.next??p.cell)===cell));}
  private routingKey(){
    return this.boardVersion?`${this.cell}:${this.boardVersion()}:${this.peers?.().filter(p=>p!==this).map(p=>p.next??p.cell).join(',')??''}`:null;
  }
  private pick<T>(items:readonly T[]):T{return items[Math.min(items.length-1,Math.floor(this.random()*items.length))];}
  private allowed(cell:number){
    if(this.board[cell]===this.element||this.board[cell]==='bush')return true;
    if(this.board[cell]!==null)return false;
    const opposite=this.element==='water'?'lava':'water',x=cell%8,y=Math.floor(cell/8);
    return ![x>0?cell-1:-1,x<7?cell+1:-1,y>0?cell-8:-1,y<7?cell+8:-1].some(n=>neighborSource(this.board,n,opposite));
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
  private wanderChoices(){
    const peers=this.peers?.()??[];
    const candidates=this.neighbors(this.cell).map(cell=>({cell,arrivals:peers.filter(p=>p!==this&&(p.next??p.cell)===cell)}))
      .filter(({arrivals})=>!arrivals.some(p=>p.leaping||p.hatchRemaining>0||p.planting>0));
    const roomy=candidates.filter(({arrivals})=>arrivals.length<2);
    if(roomy.length)return roomy.map(({cell})=>cell);
    // In an already packed pocket, let one pet circulate toward the least
    // crowded neighbor instead of requiring an empty reservation to start.
    const here=peers.filter(p=>(p.next??p.cell)===this.cell).length;
    const least=Math.min(...candidates.map(({arrivals})=>arrivals.length));
    return least<=here?candidates.filter(({arrivals})=>arrivals.length===least).map(({cell})=>cell):[];
  }

  private chooseWander(choices:number[]){
    const peers=this.peers?.()??[];
    const weights=choices.map(c=>{
      const dx=c%8-this.cell%8,dy=Math.floor(c/8)-Math.floor(this.cell/8);
      const alignment=(-dx*Math.sin(this.heading)-dy*Math.cos(this.heading))/Math.hypot(dx,dy);
      const crowd=peers.filter(p=>p!==this&&(p.next??p.cell)===c).length;
      return (.35+2.6*Math.max(0,alignment))*(crowd?.25:1)*(this.recent.includes(c)?.25:1)*(c===this.recent.at(-1)?.12:1);
    });
    let roll=this.random()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<choices.length;i++){roll-=weights[i];if(roll<=0)return choices[i];}
    return choices[choices.length-1];
  }
  private updateSpacing(dt:number){
    let ox=0,oy=0;
    if(!this.leaping&&!this.hatchRemaining&&!this.planting){
      const peers=this.peers?.()??[],index=peers.indexOf(this);
      for(let i=0;i<peers.length;i++){const p=peers[i];if(p===this||p.leaping)continue;
        let dx=this.x-p.x,dy=this.y-p.y;const d=Math.hypot(dx,dy);if(d>=.7)continue;
        if(d<.001){const angle=(Math.min(index,i)+1)*2.399;dx=Math.cos(angle)*(index<i?1:-1);dy=Math.sin(angle)*(index<i?1:-1);}
        const length=Math.hypot(dx,dy);ox+=dx/length*(.7-d)*.4;oy+=dy/length*(.7-d)*.4;
      }
    }
    const size=Math.hypot(ox,oy),scale=size>.22?.22/size:1,blend=1-Math.exp(-dt*9);
    this.visualOffsetX+=(ox*scale-this.visualOffsetX)*blend;this.visualOffsetY+=(oy*scale-this.visualOffsetY)*blend;
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
        if(n<0||seen.has(n)||(this.board[n]==='stone'||this.board[n]==='forge')||(this.peers?.().filter(p=>p!==this&&(p.next??p.cell)===n).length??0)>=2)continue;
        seen.add(n);first[n]=c===this.cell?n:first[c];queue.push(n);
      }
    }
    if(key)this.escapeCache={key,value:result};
    return result;
  }
  // Cosmetic wandering must never keep a lost run alive indefinitely.
  get busy(){return this.feeding>0||this.hatchRemaining>0||this.leaping||this.planting>0||(this.queued>0&&(!!this.snacks[0]||this.attack?.()?.cells.some(c=>this.available(c))||this.leapTarget()!==null));}
  update(dt:number){
    this.updateSpacing(dt);
    if(this.hatchRemaining>0){const used=Math.min(dt,this.hatchRemaining);this.hatchRemaining-=used;dt-=used;if(this.hatchRemaining===0)this.revision++;}
    while(dt>0){
      if(this.flight){
        const f=this.flight,used=Math.min(dt,Math.max(0,f.duration-f.age));f.age+=used;dt-=used;
        const t=this.leapProgress=Math.min(1,f.age/f.duration);
        this.x=f.x+((f.tx??f.target%8)-f.x)*t;this.y=f.y+((f.ty??Math.floor(f.target/8))-f.y)*t;this.altitude=(f.fromHeight??0)+((f.toHeight??0)-(f.fromHeight??0))*t;
        if(t===1)this.land();
        continue;
      }
      if(this.feeding>0){const used=Math.min(dt,this.feeding);this.feeding-=used;dt-=used;if(this.feeding===0){
        // A consumed berry never becomes a deferred ability waiting for space.
        if(this.snacks[0]?.stage&&!this.snacks[0]?.build&&!this.board.some((_,c)=>this.berryTargetAllowed(c)))this.finishSnack();
        this.revision++;
      }continue;}
      if(this.planting>0){const used=Math.min(dt,.18-this.planting);this.planting+=used;dt-=used;if(this.planting>=.18){this.planting=0;this.revision++;}continue;}
      if(this.queued>0&&this.startLeap())continue;
      if(this.next===null){
        const unsafe=!this.allowed(this.cell);
        const target=unsafe?this.escapeRoute():null;
        if(unsafe&&target===null)break;
        this.escapingStep=unsafe;
        let choices=this.wanderChoices();
        if(target!==null)choices=[target];
        else{const fresh=choices.filter(n=>!this.recent.includes(n));if(fresh.length)choices=fresh;}
        if(!choices.length)break;
        this.next=this.chooseWander(choices);this.progress=0;this.retreating=false;
      }
      const sx=this.cell%8,sy=Math.floor(this.cell/8),dx=this.next%8-sx,dy=Math.floor(this.next/8)-sy;
      const blocked=this.escapingStep?(this.board[this.next]==='stone'||this.board[this.next]==='forge'):!this.allowed(this.next)||(dx&&dy&&(!this.allowed(sy*8+sx+dx)||!this.allowed((sy+dy)*8+sx)));
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
