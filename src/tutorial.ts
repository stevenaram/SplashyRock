import {eggIcon} from './egg';

// A self-contained demonstration. It never changes the live board or score.
export class Tutorial {
  private readonly panel:HTMLElement;
  private readonly goalHint:HTMLElement;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private hintTimer:ReturnType<typeof setTimeout>|undefined;
  private readonly events=new AbortController();
  constructor(board:HTMLElement,goal:HTMLElement){
    this.panel=document.createElement('aside');this.panel.id='tutorial';
    this.panel.setAttribute('aria-label','Drag shapes onto empty sand. Sand between water and lava becomes stone. Stone clears itself, then its horizontal and vertical neighbors.');
    const cells=Array.from({length:15},(_,i)=>`<rect x="${20+i%5*44}" y="${17+Math.floor(i/5)*44}" width="44" height="44"/>`).join('');
    this.panel.innerHTML=`<button class="tutorial-close" aria-label="Dismiss tutorial">×</button>
      <svg viewBox="0 0 260 205" aria-hidden="true">
        <g class="lesson-sand">${cells}</g>
        <g class="lesson-water"><path d="M65 62h42v42H65z"/><path class="lesson-ripple" d="M72 77h11m7 12h10"/></g>
        <g class="lesson-target"><path d="M152 62h44v44h-44z"/></g>
        <g class="lesson-lava"><path d="M153 62h42v42h-42z"/><path class="lesson-crack" d="m159 64 8 13 11-4 7 17 8 4"/></g>
        <g class="lesson-link"><path d="M105 83h8m34 0h8"/></g>
        <g class="lesson-stone"><path d="m117 71 15-6 12 13-3 18-21 3-6-13z"/><path d="m117 71 12 12 15-5m-15 5-9 16"/></g>
        <g class="lesson-clear"><path d="M108 61h44v44h-44z"/><path d="M108 17h44v44h-44zM64 61h44v44H64zM152 61h44v44h-44zM108 105h44v44h-44z"/></g>
        <g class="lesson-steam"><path d="m80 81-3-7 3-7m47 17-3-8 3-8m49 15-3-7 3-7"/></g>
        <g class="lesson-hand"><path d="M177 94v-12a3 3 0 0 1 6 0v7l3-1 8 4v10l-7 8h-6l-9-10a3 3 0 0 1 4-4l1 1"/></g>
        <g class="lesson-tray"><rect x="66" y="174" width="18" height="18"/><rect x="120" y="174" width="18" height="18"/><rect x="174" y="174" width="18" height="18"/></g>
        <g class="lesson-check"><path d="m122 79 7 7 13-17"/></g>
      </svg>
      <svg class="lesson-summary" viewBox="0 0 240 42" aria-hidden="true"><path fill="#e8d2b4" stroke="#a99079" stroke-width="2" d="m45 10 14-5 12 12-3 17-20 2-6-13z"/><path fill="none" stroke="#e8e6be" stroke-width="3" d="M87 21h30m-8-7 8 7-8 7"/><path fill="#ceb97e" stroke="#ebd9a4" stroke-width="2" d="M160 3h18v12h12v14h-12v12h-18V29h-12V15h12z"/></svg>
      <div class="lesson-stages" aria-hidden="true"><i></i><i></i><i></i></div>`;
    this.panel.querySelector('button')!.addEventListener('pointerdown',event=>event.stopPropagation(),{signal:this.events.signal});
    board.append(this.panel);
    this.goalHint=document.createElement('div');this.goalHint.id='goal-hint';
    this.goalHint.innerHTML=`<img src="${eggIcon()}" alt=""/><p>Earn <strong>5,000</strong> score<br/>to hatch a pet</p><button aria-label="Dismiss pet goal">×</button>`;
    goal.append(this.goalHint);
    this.panel.querySelector('button')!.addEventListener('click',()=>this.dismiss(),{signal:this.events.signal});
    this.goalHint.querySelector('button')!.addEventListener('click',()=>this.dismissGoal(),{signal:this.events.signal});
  }
  start(){
    clearTimeout(this.timer);clearTimeout(this.hintTimer);
    this.panel.hidden=false;this.goalHint.hidden=false;
    this.panel.classList.remove('playing');void this.panel.offsetWidth;this.panel.classList.add('playing');
    this.timer=setTimeout(()=>this.dismiss(),14000);
    this.hintTimer=setTimeout(()=>this.dismissGoal(),20000);
  }
  dismiss(){clearTimeout(this.timer);this.panel.hidden=true;}
  dismissGoal(){clearTimeout(this.hintTimer);this.goalHint.hidden=true;}
  played(){this.dismiss();clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>this.dismissGoal(),4500);}
  dispose(){clearTimeout(this.timer);clearTimeout(this.hintTimer);this.events.abort();this.panel.remove();this.goalHint.remove();}
}
