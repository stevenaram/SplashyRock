// Small, original bitmap lettering keeps the celebration in the island's pixel style.
const glyphs: Record<string,string[]> = {
 C:['0111','1100','1000','1000','1000','1100','0111'],
 O:['0110','1001','1001','1001','1001','1001','0110'],
 M:['10001','11011','10101','10001','10001','10001','10001'],
 B:['1110','1001','1001','1110','1001','1001','1110'],
 '×':['00000','10001','01010','00100','01010','10001','00000'],
 '0':['01110','11011','11011','10101','11011','11011','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','01110'],
};
function lettering(text:string,unit:number,color:string){
 let x=0;const paths:string[]=[];
 for(const char of text){const rows=glyphs[char];rows.forEach((row,y)=>[...row].forEach((v,col)=>{if(v==='1')paths.push(`M${x+col*unit},${y*unit}h${unit}v${unit}h-${unit}z`);}));x+=(rows[0].length+1)*unit;}
 const outline=[[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy])=>`<path d="${paths.join('')}" fill="#173e4d" transform="translate(${dx} ${dy})"/>`).join('');
 return `<svg viewBox="-4 -4 ${x+5} ${7*unit+11}" width="${x+5}" height="${7*unit+11}" aria-hidden="true">${outline}<path d="${paths.join('')}" fill="${color}"/></svg>`;
}
export class ComboCallout {
 private readonly element=document.createElement('div');
 private cell=0;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private readonly observer:ResizeObserver;
 private readonly reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private readonly host:HTMLElement,private readonly project:(cell:number)=>{x:number;y:number}){
  this.element.id='combo';this.element.hidden=true;this.element.setAttribute('role','status');this.element.setAttribute('aria-live','polite');host.append(this.element);
  this.observer=new ResizeObserver(()=>this.position());this.observer.observe(host);
 }
 private position(){
  const point=this.project(this.cell),w=this.element.offsetWidth||160,h=this.element.offsetHeight||90;
  this.element.style.left=`${Math.max(w/2+8,Math.min(this.host.clientWidth-w/2-8,point.x))}px`;
  this.element.style.top=`${Math.max(68,Math.min(this.host.clientHeight-h-8,point.y-h-16))}px`;
 }
 show(multiplier:number,cell:number){
  clearTimeout(this.timer);this.cell=cell;this.element.getAnimations().forEach(a=>a.cancel());
  this.element.hidden=false;this.element.classList.remove('paid');
  this.element.setAttribute('aria-label',`Combo times ${multiplier}`);
  this.element.innerHTML=`<div class="combo-word">${lettering('COMBO',3,'#fff0c5')}</div><div class="combo-number">${lettering(`×${multiplier}`,6,'#ffbf61')}</div><span class="combo-bonus"></span><i class="combo-spark left"></i><i class="combo-spark right"></i>`;
  this.position();
  if(!this.reduced.matches)this.element.animate([{opacity:0,transform:'translateX(-50%) translateY(12px) scale(.7)'},{opacity:1,transform:'translateX(-50%) translateY(-3px) scale(1.08)',offset:.65},{opacity:1,transform:'translateX(-50%) scale(1)'}],{duration:340,easing:'cubic-bezier(.2,.75,.3,1)'});
 }
 finish(bonus:number){
  if(this.element.hidden)return;
  this.element.classList.add('paid');
  this.element.querySelector('.combo-bonus')!.textContent=`+${bonus.toLocaleString()} BONUS`;
  this.element.setAttribute('aria-label',`${this.element.getAttribute('aria-label')}, ${bonus} bonus points`);
  clearTimeout(this.timer);
  this.timer=setTimeout(()=>{
   if(this.reduced.matches){this.reset();return;}
   const fade=this.element.animate([{opacity:1,transform:'translateX(-50%) translateY(0)'},{opacity:0,transform:'translateX(-50%) translateY(-14px)'}],{duration:450,fill:'forwards',easing:'ease-out'});
   fade.onfinish=()=>this.reset();
  },1000);
 }
 reset(){clearTimeout(this.timer);this.element.getAnimations().forEach(a=>{a.onfinish=null;a.cancel();});this.element.hidden=true;}
 dispose(){this.reset();this.observer.disconnect();this.element.remove();}
}
