import type {SoundCue} from './sound';
import {TutorialScene} from './tutorial-scene';
import {eggIcon} from './egg';

// A self-contained demonstration. It never changes the live board or score.
export class Tutorial {
  private readonly panel:HTMLElement;
  private readonly goalHint:HTMLElement;
  private phase=0;
  private demo:TutorialScene;
  private setPhase(){this.panel.dataset.phase=String(this.phase);this.panel.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.phase)===this.phase)));}
  private timer:ReturnType<typeof setTimeout>|undefined;
  private hintTimer:ReturnType<typeof setTimeout>|undefined;
  private readonly events=new AbortController();
  constructor(board:HTMLElement,goal:HTMLElement,onSound:(cue:SoundCue)=>void){
    this.panel=document.createElement('aside');this.panel.id='tutorial';
    this.panel.setAttribute('aria-label','Drag shapes onto empty sand. Sand between water and lava becomes stone. Stone clears itself, then its horizontal and vertical neighbors.');
    this.panel.innerHTML=`<div class="demo-live"></div><div class="demo-controls"><div class="demo-dots">${[0,1,2].map(n=>`<button data-phase="${n}" aria-label="Tutorial step ${n+1}">${n+1}</button>`).join('')}</div><button class="tutorial-close" aria-label="Close tutorial"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button></div><div class="tutorial-footer"><p>Place water and lava one space apart to clear tiles and build your score.</p><button class="tutorial-done" type="button">Got it</button></div>`;
    this.demo=new TutorialScene(this.panel.querySelector<HTMLElement>('.demo-live')!,phase=>{this.phase=phase;this.setPhase();},onSound);
    this.panel.addEventListener('pointerdown',event=>event.stopPropagation(),{signal:this.events.signal});
    this.panel.querySelectorAll<HTMLButtonElement>('[data-phase]').forEach(button=>button.addEventListener('click',()=>{this.demo.show(Number(button.dataset.phase));},{signal:this.events.signal}));
    board.append(this.panel);
    this.goalHint=document.createElement('div');this.goalHint.id='goal-hint';
    this.goalHint.innerHTML=`<img src="${eggIcon()}" alt=""/><p>Earn <strong>5,000</strong> score<br/>to hatch a pet</p><button aria-label="Dismiss pet goal">×</button>`;
    goal.append(this.goalHint);
    this.panel.querySelectorAll('.tutorial-close,.tutorial-done').forEach(button=>button.addEventListener('click',()=>this.dismiss(),{signal:this.events.signal}));
    this.goalHint.querySelector('button')!.addEventListener('click',()=>this.dismissGoal(),{signal:this.events.signal});
  }
  start(){
    clearTimeout(this.timer);clearTimeout(this.hintTimer);
    this.panel.hidden=false;this.goalHint.hidden=true;
    this.demo.show();
    this.panel.classList.remove('playing');void this.panel.offsetWidth;this.panel.classList.add('playing');
    this.timer=setTimeout(()=>this.dismiss(),19200);
  }
  dismiss(){
    this.demo.stop();clearTimeout(this.timer);
    if(this.panel.hidden)return;
    this.panel.hidden=true;this.goalHint.hidden=false;
    clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>this.dismissGoal(),20000);
  }
  dismissGoal(){clearTimeout(this.hintTimer);this.goalHint.hidden=true;}
  played(){this.dismiss();clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>this.dismissGoal(),4500);}
  dispose(){this.demo.dispose();clearTimeout(this.timer);clearTimeout(this.hintTimer);this.events.abort();this.panel.remove();this.goalHint.remove();}
}
