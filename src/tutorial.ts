import {FIRST_EGG_SCORE} from './egg-goals';
import {seenTips} from './seen-tips';
import {eggIcon} from './egg';
import {pieceIcon} from './piece-icon';
import type {Game,Piece,Element} from './game';

const TOOLTIP_DURATION=5000;

export class Tutorial {
  private phase=0;
  private firstCell=27;
  private firstElement='water';
  private hand=document.createElement('div');
  private target=document.createElement('div');
  private tip=document.createElement('div');
  private petTip=document.createElement('div');
  private warningTip=document.createElement('div');
  private warningTimer:ReturnType<typeof setTimeout>|undefined;
  private petTimer:ReturnType<typeof setTimeout>|undefined;
  private goalHint=document.createElement('div');
  private timer:ReturnType<typeof setTimeout>|undefined;
  private observer:ResizeObserver;
  private paused=false;
  private animation:Animation|undefined;
  private frame=0;
  private guideKey="";
  private guideBoard=-1;
  constructor(private board:HTMLElement,goal:HTMLElement,private tray:HTMLElement,private game:Game,private screen:(cell:number)=>{x:number;y:number}){
    this.hand.id='guide-hand';this.hand.setAttribute('aria-hidden','true');this.target.id='guide-target';this.target.setAttribute('aria-hidden','true');
    this.tip.id='clearing-tip';this.tip.hidden=true;this.tip.innerHTML='<p>Place water and lava one space apart to clear tiles and build your score.</p><button type="button">Got it</button>';
    this.goalHint.id='goal-hint';this.goalHint.hidden=true;this.goalHint.innerHTML=`<img src="${eggIcon()}" alt=""/><p>Earn <strong>${FIRST_EGG_SCORE.toLocaleString()}</strong> score<br/>to hatch a pet</p><button aria-label="Dismiss pet goal">×</button>`;
    this.petTip.id='pet-ability-tip';this.petTip.hidden=true;this.petTip.setAttribute('role','status');this.petTip.innerHTML='<p></p><button type="button">Got it</button>';board.append(this.petTip);
    this.petTip.querySelector('button')!.addEventListener('click',()=>{clearTimeout(this.petTimer);this.petTip.hidden=true;});
    this.warningTip.id='fit-warning-tip';this.warningTip.hidden=true;this.warningTip.setAttribute('role','status');this.warningTip.innerHTML='<p>When none of your remaining shapes fit, it&#39;s game over.</p><button type="button">Got it</button>';board.append(this.warningTip);
    this.warningTip.querySelector('button')!.addEventListener('click',()=>{clearTimeout(this.warningTimer);this.warningTip.hidden=true;});
    goal.append(this.goalHint);board.append(this.tip);document.querySelector('#game')!.append(this.hand,this.target);
    this.tip.querySelector('button')!.addEventListener('click',()=>this.showGoal());this.goalHint.querySelector('button')!.addEventListener('click',()=>this.dismissGoal());
    this.observer=new ResizeObserver(()=>this.refresh());this.observer.observe(board);this.observer.observe(tray);
  }
  start(){clearTimeout(this.warningTimer);this.warningTip.hidden=true;clearTimeout(this.petTimer);this.petTip.hidden=true;clearTimeout(this.timer);this.phase=0;this.paused=false;this.tip.hidden=true;this.goalHint.hidden=true;
    if(seenTips.has('intro')){this.phase=3;this.showClearingTip();}
    else seenTips.mark('intro');
    this.refresh();
  }
  get guiding(){return this.phase<=2;}
  private destination(){
    if(this.phase===0)return 27;
    const x=this.firstCell%8,y=Math.floor(this.firstCell/8);
    return [[x+2,y],[x-2,y],[x,y+2],[x,y-2]].filter(([a,b])=>a>=0&&a<8&&b>=0&&b<8).map(([a,b])=>b*8+a).find(c=>this.game.board[c]===null&&this.game.board[(c+this.firstCell)/2]===null)??27;
  }
  permits(piece:Piece,cell:number){
    if(this.phase<2&&piece.shape.cells.length!==1)return false;
    if(this.phase===2)return false;
    if(this.phase!==1)return true;
    const distance=Math.abs(cell%8-this.firstCell%8)+Math.abs(Math.floor(cell/8)-Math.floor(this.firstCell/8));
    const straight=cell%8===this.firstCell%8||Math.floor(cell/8)===Math.floor(this.firstCell/8);
    return piece.tile!==this.firstElement&&piece.tile!=='pet'&&straight&&distance===2&&this.game.board[(cell+this.firstCell)/2]===null;
  }
  placed(piece:Piece,cell:number){
    if(piece.tile==='pet'){seenTips.mark('egg-drag');this.paused=false;this.refresh();return;}
    if(this.phase===0){this.firstElement=piece.tile;this.firstCell=cell;this.phase=1;}
    else if(this.phase===1)this.phase=2;
    this.paused=false;this.refresh();
  }
  settled(ready:boolean){if(this.phase===2&&ready){seenTips.mark('intro-complete');this.phase=3;this.showClearingTip();}if(this.guideBoard!==this.game.boardChange){this.guideBoard=this.game.boardChange;this.refresh();}}
  private showClearingTip(){
    if(seenTips.has('clearing')){this.showGoal();return;}
    seenTips.mark('clearing');this.tip.hidden=false;clearTimeout(this.timer);this.timer=setTimeout(()=>this.showGoal(),TOOLTIP_DURATION);
  }
  private showGoal(){
    if(this.phase!==3)return;clearTimeout(this.timer);this.phase=4;this.tip.hidden=true;
    if(seenTips.has('egg-goal'))return;
    seenTips.mark('egg-goal');this.goalHint.hidden=false;this.timer=setTimeout(()=>this.dismissGoal(),TOOLTIP_DURATION);
  }
  beginDrag(){this.paused=true;this.refresh();}
  endDrag(){this.paused=false;this.refresh();}
  refresh(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.layout());}
  private layout(){
    const eggGuide=this.phase>2&&!seenTips.has('egg-drag')&&this.game.pets.length===0;
    const slot=this.game.inventory.findIndex(p=>p&&(eggGuide?p.tile==='pet':p.tile!=='pet'&&p.shape.cells.length===1&&(this.phase===0||p.tile!==this.firstElement)));
    const piece=this.game.inventory[slot],button=this.tray.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    const empty=eggGuide?this.game.board.map((_,c)=>c).filter(c=>piece&&this.game.canPlace(piece,c)).sort((a,b)=>Math.hypot(a%8-3.5,Math.floor(a/8)-3.5)-Math.hypot(b%8-3.5,Math.floor(b/8)-3.5))[0]:undefined;
    const destination=eggGuide?empty:this.destination();
    if(this.game.over||(!eggGuide&&this.phase>1)||!button||!piece||destination===undefined){this.animation?.cancel();this.guideKey="";this.hand.hidden=this.target.hidden=true;return;}
    const r=button.getBoundingClientRect(),b=this.board.getBoundingClientRect(),point=this.screen(destination),neighbor=this.screen(destination%8<7?destination+1:destination-1);
    const key=[slot,destination,this.paused,r.x,r.y,r.width,r.height,b.x,b.y,b.width,b.height].join(':');
    if(key===this.guideKey)return;this.guideKey=key;this.animation?.cancel();this.hand.hidden=this.target.hidden=false;
    const x=point.x+b.left,y=point.y+b.top,size=Math.abs(neighbor.x-point.x)*.86;
    Object.assign(this.target.style,{left:`${x}px`,top:`${y}px`,width:`${size}px`,height:`${size*.86}px`});
    this.hand.hidden=this.paused;if(this.paused)return;
    this.hand.innerHTML=`<span class="guide-piece ${piece.tile}">${pieceIcon(piece)}</span><svg viewBox="0 0 48 56"><path d="M16 28V8a5 5 0 0 1 10 0v15l5-2 12 7v14L32 53H20L5 35a5 5 0 0 1 7-7l4 5Z"/></svg>`;
    const from=`translate(${r.x+r.width/2}px,${r.y+r.height/2}px)`,to=`translate(${x}px,${y}px)`;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.hand.style.transform=to;return;}
    this.animation=this.hand.animate([{transform:from,opacity:0},{transform:from,opacity:1,offset:.15},{transform:to,opacity:1,offset:.66},{transform:to,opacity:1,offset:.8},{transform:to,opacity:0}],{duration:2300,iterations:Infinity,easing:'cubic-bezier(.3,.1,.25,1)'});
  }
  showFitWarning(piece:Piece|undefined|null){
    if(seenTips.has('blocked-shape')||!piece||piece.tile==='pet'||this.game.pieceFits(piece))return;
    seenTips.mark('blocked-shape');this.dismissGoal();this.tip.hidden=true;this.petTip.hidden=true;
    this.warningTip.hidden=false;clearTimeout(this.warningTimer);this.warningTimer=setTimeout(()=>{this.warningTip.hidden=true;},TOOLTIP_DURATION);
  }
  showPetAbility(element:Element){
    if(seenTips.has('pet-ability'))return;
    seenTips.mark('pet-ability');
    this.warningTip.hidden=true;
    this.dismissGoal();this.tip.hidden=true;
    this.petTip.querySelector('p')!.textContent=`Your ${element} pet places 1 ${element} tile each time you place a shape.`;
    this.petTip.hidden=false;clearTimeout(this.petTimer);this.petTimer=setTimeout(()=>{this.petTip.hidden=true;},TOOLTIP_DURATION);
  }
  dismiss(){clearTimeout(this.warningTimer);this.warningTip.hidden=true;clearTimeout(this.petTimer);this.petTip.hidden=true;this.phase=5;this.tip.hidden=true;clearTimeout(this.timer);this.refresh();}
  dismissGoal(){this.goalHint.hidden=true;}
  dispose(){this.dismiss();cancelAnimationFrame(this.frame);this.animation?.cancel();this.observer.disconnect();this.hand.remove();this.target.remove();this.tip.remove();this.petTip.remove();this.warningTip.remove();this.goalHint.remove();}
}
