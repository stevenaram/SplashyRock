import {gemIcon} from './gems';
import {Progression,type Achievement} from './progression';

export class ProgressUI {
 readonly wallet=document.createElement('button');
 readonly menu=document.createElement('button');
 private dialog=document.createElement('dialog');
 private toast=document.createElement('button');
 private timer:ReturnType<typeof setTimeout>|undefined;
 private history=false;
 private focusBefore:HTMLElement|null=null;
 private events=new AbortController();
 constructor(private readonly progress:Progression,private readonly onOpen:()=>void){
  this.wallet.id='gem-wallet';this.wallet.type='button';this.wallet.innerHTML=`${gemIcon}<strong>0</strong>`;
  this.menu.id='progress-menu';this.menu.type='button';this.menu.setAttribute('aria-label','Open achievements');this.menu.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const hud=document.querySelector('#run-hud')!;hud.querySelector('#hud-wallets')!.append(this.wallet);hud.append(this.menu);
  this.dialog.id='achievements';this.dialog.setAttribute('aria-labelledby','achievements-title');
  this.dialog.innerHTML=`<header><div><span class="eyebrow">YOUR ISLAND JOURNEY</span><h2 id="achievements-title">Achievements</h2></div><button class="panel-close" aria-label="Close achievements">×</button></header><div class="achievement-wallet">${gemIcon}<strong></strong><span>Gems</span><small>Earn gems. Keep growing.</small></div><div class="achievement-tabs"><button data-history="false" aria-pressed="true">Next goals</button><button data-history="true" aria-pressed="false">Completed</button></div><div class="achievement-list"></div><footer>Rewards are collected automatically. Progress carries across runs.</footer>`;
  this.toast.id='gem-reward';this.toast.type='button';this.toast.hidden=true;this.toast.setAttribute('aria-live','polite');
  document.body.append(this.dialog,this.toast);
  this.wallet.addEventListener('click',()=>this.open());this.menu.addEventListener('click',()=>this.open());this.toast.addEventListener('click',()=>{this.toast.hidden=true;this.open();});
  this.dialog.querySelector('.panel-close')!.addEventListener('click',()=>this.dialog.close());
  this.dialog.addEventListener('click',e=>{if(e.target===this.dialog){const r=this.dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.dialog.close();}});
  this.dialog.addEventListener('close',()=>this.focusBefore?.focus({preventScroll:true}));
  this.dialog.querySelectorAll<HTMLButtonElement>('[data-history]').forEach(button=>button.addEventListener('click',()=>{this.history=button.dataset.history==='true';this.render();}));
  window.addEventListener('storage',()=>{this.progress.reload();this.render();},{signal:this.events.signal});
  this.render();
 }
 open(){this.onOpen();this.focusBefore=document.activeElement as HTMLElement;this.render();if(!this.dialog.open)this.dialog.showModal();}
 render(){
  const balance=this.progress.gems.toLocaleString();this.wallet.querySelector('strong')!.textContent=balance;this.wallet.setAttribute('aria-label',`${balance} Gems. View achievements`);
  this.dialog.querySelector('.achievement-wallet strong')!.textContent=balance;
  this.dialog.querySelectorAll<HTMLButtonElement>('[data-history]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.history==='true')===this.history)));
  const rows=this.history?this.progress.completed().reverse():this.progress.active();
  this.dialog.querySelector('.achievement-list')!.innerHTML=rows.length?rows.map(a=>this.row(a)).join(''):`<p class="achievement-empty">${this.history?'Your first achievement is waiting. Play a run to begin.':'Every achievement earned. What an island!'}</p>`;
 }
 private row(a:Achievement){const value=Math.min(a.target,a.progress);return `<article class="achievement-card ${this.history?'complete':''}" data-family="${a.family}"><div class="achievement-heading"><h3>${a.title}</h3><span class="gem-prize">${this.history?'✓':'+'}${a.reward}${gemIcon}</span></div><div class="achievement-meter" role="progressbar" aria-label="${a.description}" aria-valuemin="0" aria-valuemax="${a.target}" aria-valuenow="${value}"><i style="width:${100*value/a.target}%"></i></div><small>${this.history?'Completed':`${value.toLocaleString()} / ${a.target.toLocaleString()}`}</small></article>`;}
 earned(awards:Achievement[]){
  this.render();if(!awards.length)return;
  const gems=awards.reduce((sum,a)=>sum+a.reward,0);
  this.toast.innerHTML=`${gemIcon}<span><small>${awards[awards.length-1].title+(awards.length>1?` (+${awards.length-1} more)`:'')}</small><strong>+${gems} Gems</strong></span><span class="reward-check">✓</span>`;
  this.toast.hidden=false;clearTimeout(this.timer);this.timer=setTimeout(()=>{this.toast.hidden=true;},4000);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){this.toast.animate([{opacity:0,translate:'0 -8px',scale:.94},{opacity:1,translate:'0 0',scale:1}],{duration:320,easing:'cubic-bezier(.2,.8,.3,1)'});this.wallet.animate([{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:600});}
 }
 dispose(){this.events.abort();clearTimeout(this.timer);this.dialog.remove();this.toast.remove();this.wallet.remove();this.menu.remove();}
}
