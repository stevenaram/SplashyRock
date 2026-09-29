import type {BossReward} from './boss';

/** Independent of the boss mesh so the payout survives its final dissolve. */
export class BossRewardCallout {
 private active=new Map<HTMLElement,ReturnType<typeof setTimeout>>();
 constructor(private host:HTMLElement,private project:(x:number,y:number)=>{x:number;y:number}){}
 show(reward:BossReward){
  const el=document.createElement('div'),p=this.project(reward.x,reward.y);
  el.className='boss-reward';el.dataset.element=reward.element;el.setAttribute('role','status');
  el.innerHTML='<span>Boss defeated</span><strong></strong><small></small>';
  el.querySelector('strong')!.textContent=`+${reward.score.toLocaleString()}`;
  el.querySelector('small')!.textContent=`500 + ${reward.damage} tiles × 50`;
  el.setAttribute('aria-label',`Boss defeated. ${reward.score.toLocaleString()} score: 500 victory bonus plus ${reward.damage} tiles damaged at 50 each.`);
  el.style.left=`${Math.max(105,Math.min(this.host.clientWidth-105,p.x))}px`;
  el.style.top=`${Math.max(60,Math.min(this.host.clientHeight-90,p.y-25))}px`;
  this.host.append(el);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation=el.animate(reduced?[{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.85},{opacity:0}]:[
   {opacity:0,transform:'translate(-50%,-35%) scale(.72)'},
   {opacity:1,transform:'translate(-50%,-50%) scale(1.07)',offset:.09},
   {opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.16},
   {opacity:1,transform:'translate(-50%,-65%) scale(1)',offset:.8},
   {opacity:0,transform:'translate(-50%,-90%) scale(.97)'}
  ],{duration:3000,easing:'ease-out',fill:'forwards'});
  this.active.set(el,setTimeout(()=>{animation.cancel();el.remove();this.active.delete(el);},3050));
 }
 reset(){for(const [el,timer] of this.active){clearTimeout(timer);el.getAnimations().forEach(a=>a.cancel());el.remove();}this.active.clear();}
}
