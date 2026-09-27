import {eggIcon} from './egg';

// A self-contained demonstration. It never changes the live board or score.
export class Tutorial {
  private readonly panel:HTMLElement;
  private readonly goalHint:HTMLElement;
  private phase=0;
  private phaseTimer:ReturnType<typeof setInterval>|undefined;
  private setPhase(){this.panel.dataset.phase=String(this.phase);this.panel.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.phase)===this.phase)));}
  private timer:ReturnType<typeof setTimeout>|undefined;
  private hintTimer:ReturnType<typeof setTimeout>|undefined;
  private readonly events=new AbortController();
  constructor(board:HTMLElement,goal:HTMLElement){
    this.panel=document.createElement('aside');this.panel.id='tutorial';
    this.panel.setAttribute('aria-label','Drag shapes onto empty sand. Sand between water and lava becomes stone. Stone clears itself, then its horizontal and vertical neighbors.');
    const cells=Array.from({length:25},(_,i)=>`<rect x="${10+i%5*36}" y="${10+Math.floor(i/5)*36}" width="36" height="36"/>`).join('');
    const tile=(x:number,y:number,kind:string,extra='')=>`<g class="demo-tile ${kind} ${extra}"><rect x="${11+x*36}" y="${11+y*36}" width="34" height="34"/><path d="M${17+x*36} ${23+y*36}h9m3 10h9"/></g>`;
    const cross='M82 46h36v36h36v36h-36v36H82v-36H46V82h36Z';
    this.panel.innerHTML=`<div class="demo-panels">${[0,1,2].map(step=>`<div class="demo-step" data-step="${step}">
      <span class="demo-number">${step+1}</span>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <g class="demo-sand">${cells}</g>
        ${tile(0,0,'water','untouched')}${tile(4,4,'lava','untouched')}${tile(3,1,'lava','untouched')}${tile(3,3,'lava','untouched')}
        <g class="demo-neighbors">${tile(1,2,'water')}${tile(2,1,'water')}${tile(2,3,'water')}${tile(3,2,'lava',step===0?'demo-drop':'')}</g>
        ${step===0?'<path class="demo-target" d="M118 82h36v36h-36z"/><path class="demo-finger" d="M137 109V96a3 3 0 0 1 6 0v7l10 2v12l-7 6h-5l-9-10a3 3 0 0 1 4-4z"/>':''}
        ${step>0?'<g class="demo-stone"><path d="m87 89 13-5 12 10-2 16-19 4-8-12z"/><path d="m87 89 11 10 14-5m-14 5-7 15"/></g>':''}
        ${step>0?`<path class="demo-footprint" d="${cross}"/>`:''}
        ${step===2?'<g class="demo-steam"><path d="m64 96-3-6 3-6m35-19-3-6 3-6m36 41-3-6 3-6m-33 41-3-6 3-6"/></g><path class="demo-empty" d="m91 100 7 7 14-17"/>':''}
      </svg>
      <svg class="demo-caption" viewBox="0 0 160 26" aria-hidden="true">${step===0?'<path fill="#bb482d" stroke="#ffb957" stroke-width="2" d="M35 3h20v20H35z"/><path d="M65 13h28m-7-6 7 6-7 6"/><path stroke-dasharray="3 2" d="M104 3h20v20h-20z"/>':step===1?'<path d="M28 13h28m-7-6 7 6-7 6M132 13h-28m7-6-7 6 7 6"/><path fill="#e8d2b4" d="m69 7 10-4 12 10-5 10H72z"/>':'<path d="M20 13h28m-7-6 7 6-7 6"/><path fill="#d2b982" d="M84 1h12v7h8v12h-8v6H84v-6h-8V8h8z"/><path d="m126 13 5 5 10-12"/>'}</svg>
    </div>`).join('')}</div>
    <div class="demo-controls"><div class="demo-dots">${[0,1,2].map(n=>`<button data-phase="${n}" aria-label="Tutorial step ${n+1}">${n+1}</button>`).join('')}</div><button class="tutorial-close" aria-label="Start playing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button></div>`;
    this.panel.addEventListener('pointerdown',event=>event.stopPropagation(),{signal:this.events.signal});
    this.panel.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(button=>button.addEventListener('click',()=>{this.phase=Number(button.dataset.phase);this.setPhase();},{signal:this.events.signal}));
    board.append(this.panel);
    this.goalHint=document.createElement('div');this.goalHint.id='goal-hint';
    this.goalHint.innerHTML=`<img src="${eggIcon()}" alt=""/><p>Earn <strong>5,000</strong> score<br/>to hatch a pet</p><button aria-label="Dismiss pet goal">×</button>`;
    goal.append(this.goalHint);
    this.panel.querySelector('.tutorial-close')!.addEventListener('click',()=>this.dismiss(),{signal:this.events.signal});
    this.goalHint.querySelector('button')!.addEventListener('click',()=>this.dismissGoal(),{signal:this.events.signal});
  }
  start(){
    clearTimeout(this.timer);clearTimeout(this.hintTimer);
    this.panel.hidden=false;this.goalHint.hidden=false;
    clearInterval(this.phaseTimer);this.phase=0;this.setPhase();
    this.phaseTimer=setInterval(()=>{this.phase=(this.phase+1)%3;this.setPhase();},3200);
    this.panel.classList.remove('playing');void this.panel.offsetWidth;this.panel.classList.add('playing');
    this.timer=setTimeout(()=>this.dismiss(),19200);
    this.hintTimer=setTimeout(()=>this.dismissGoal(),20000);
  }
  dismiss(){clearInterval(this.phaseTimer);clearTimeout(this.timer);this.panel.hidden=true;}
  dismissGoal(){clearTimeout(this.hintTimer);this.goalHint.hidden=true;}
  played(){this.dismiss();clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>this.dismissGoal(),4500);}
  dispose(){clearInterval(this.phaseTimer);clearTimeout(this.timer);clearTimeout(this.hintTimer);this.events.abort();this.panel.remove();this.goalHint.remove();}
}
