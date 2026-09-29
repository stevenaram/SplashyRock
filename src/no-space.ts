import type {Game,Piece} from './game';
import type {SoundCue} from './sound';
import {eggIcon} from './egg';

export function noSpacePieces(inventory:readonly(Piece|null)[]):Piece[]{
 const remaining=inventory.filter((p):p is Piece=>p!==null);
 return remaining.length?Array.from({length:3},(_,i)=>remaining[i%remaining.length]):[];
}
// Choose real, in-bounds failed placements across the board, favoring remaining sand.
export function failedAnchor(game:Game,piece:Piece,lane:number,used:readonly number[]=[]){
 let best=0,weight=-Infinity;
 for(let cell=0;cell<64;cell++){
  const x=cell%8,y=Math.floor(cell/8);
  if(used.includes(cell))continue;
  if(x+piece.shape.width>8||y+piece.shape.height>8)continue;
  const empty=piece.shape.cells.filter(([dx,dy])=>game.board[(y+dy)*8+x+dx]===null).length;
  const score=empty*5-Math.abs(x+(piece.shape.width-1)/2-(1+lane*2.5))*2-Math.abs(y+(piece.shape.height-1)/2-3.5)*.5;
  if(score>weight){weight=score;best=cell;}
 }
 return best;
}
const NS='http://www.w3.org/2000/svg';
export class NoSpaceSequence {
 private svg=document.createElementNS(NS,'svg');
 private frame=0;private started=0;private lastBeat=-1;private done:(()=>void)|null=null;
 private sand:{cell:number;polygon:SVGPolygonElement}[]=[];
 private attempts:{piece:Piece;cell:number;group:SVGGElement}[]=[];
 private words:SVGTextElement[]=[];
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private board:HTMLElement,private game:Game,private project:(x:number,y:number)=>{x:number;y:number},private sound:(cue:SoundCue,level?:number)=>void){
  this.svg.id='no-space-sequence';this.svg.setAttribute('aria-hidden','true');this.svg.setAttribute('hidden','');board.append(this.svg);
 }
 start(done:()=>void){
  this.cancel();this.done=done;this.started=performance.now();this.lastBeat=-1;this.svg.removeAttribute('hidden');
  document.querySelector('#game')!.classList.add('ending');
  this.sand=this.game.board.flatMap((tile,cell)=>{
   if(tile!==null)return [];const polygon=document.createElementNS(NS,'polygon');polygon.classList.add('space-sand');this.svg.append(polygon);return [{cell,polygon}];
  });
  const used:number[]=[];
  this.attempts=noSpacePieces(this.game.inventory).map((piece,lane)=>{const group=document.createElementNS(NS,'g');this.svg.append(group);const cell=failedAnchor(this.game,piece,lane,used);used.push(cell);return {piece,cell,group};});
  this.words=['No','Space','Left'].map(word=>{const text=document.createElementNS(NS,'text');text.textContent=word;text.classList.add('space-word');this.svg.append(text);return text;});
  this.frame=requestAnimationFrame(this.tick);
 }
 private corners(x:number,y:number){return [[x-.48,y-.48],[x+.48,y-.48],[x+.48,y+.48],[x-.48,y+.48]].map(([a,b])=>{const p=this.project(a,b);return `${p.x},${p.y}`;}).join(' ');}
 private tick=(now:number)=>{
  if(!this.done)return;
  const t=(now-this.started)/1000,width=this.board.clientWidth,height=this.board.clientHeight;
  this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  for(const {cell,polygon} of this.sand){
   polygon.setAttribute('points',this.corners(cell%8,Math.floor(cell/8)));
   const phase=Math.max(0,Math.min(1,(t-.12-(cell%8)*.16)/.35));
   polygon.style.opacity=String(this.reduced.matches?.65:phase*(t>2.65?Math.max(0,(3-t)/.35):1));
  }
  const empty=this.sand.map(s=>s.cell),cy=empty.length?empty.reduce((sum,c)=>sum+Math.floor(c/8),0)/empty.length:3.5;
  const left=this.project(-.5,cy).x,right=this.project(7.5,cy).x;
  const wordY=Math.min(height-30,Math.max(45,this.project(3.5,Math.max(2,Math.min(5,cy))).y));
  const font=Math.min(44,Math.max(18,(right-left)/12));
  this.attempts.forEach(({piece,cell,group},i)=>{
   const age=t-(.3+i*.72),visible=age>=0&&age<.95;
   group.replaceChildren();group.style.opacity=String(visible?this.reduced.matches?.85:Math.min(1,age/.14)*Math.min(1,(.95-age)/.2):0);
   if(!visible)return;
   for(const [dx,dy] of piece.shape.cells){
    const x=cell%8+dx,y=Math.floor(cell/8)+dy,blocked=this.game.board[y*8+x]!==null;
    const polygon=document.createElementNS(NS,'polygon');polygon.setAttribute('points',this.corners(x,y));polygon.setAttribute('class',`space-attempt ${blocked?'blocked':piece.tile}`);group.append(polygon);
    if(blocked){const point=this.project(x,y),mark=document.createElementNS(NS,'text');mark.setAttribute('x',String(point.x));mark.setAttribute('y',String(point.y));mark.setAttribute('class','space-cross');mark.textContent='×';group.append(mark);}
   }
   if(piece.tile==='pet'){const point=this.project(cell%8,Math.floor(cell/8)),img=document.createElementNS(NS,'image');img.setAttribute('href',eggIcon());img.setAttribute('x',String(point.x-18));img.setAttribute('y',String(point.y-24));img.setAttribute('width','36');img.setAttribute('height','42');group.prepend(img);}
   if(!this.reduced.matches)group.style.transform=`translateX(${Math.sin(age*40)*Math.max(0,1-age/.45)*3}px)`;
  });
  this.words.forEach((word,i)=>{
   const age=t-(.3+i*.72),pop=Math.max(0,Math.min(1,age/.2));
   word.setAttribute('x',String(left+(right-left)*(.24+i*.26)));word.setAttribute('y',String(wordY+(this.reduced.matches?0:(1-pop)*10)));
   word.style.fontSize=`${font}px`;word.style.opacity=String(pop);
  });
  const beat=Math.min(2,Math.floor((t-.3)/.72));if(beat>=0&&beat>this.lastBeat){this.lastBeat=beat;this.sound('noSpace',beat);}
  if(t>=3){const done=this.done;this.cancel();done();return;}
  this.frame=requestAnimationFrame(this.tick);
 };
 cancel(){cancelAnimationFrame(this.frame);this.done=null;this.svg.setAttribute('hidden','');this.svg.replaceChildren();this.sand=[];this.attempts=[];this.words=[];document.querySelector('#game')?.classList.remove('ending');}
 dispose(){this.cancel();this.svg.remove();}
}
