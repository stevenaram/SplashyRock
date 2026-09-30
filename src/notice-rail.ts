// A shared lane keeps transient messages below the measured HUD and above the tray.
export function noticeRail(goal:HTMLElement,tray:HTMLElement){
 const rail=document.createElement('div');rail.id='notice-rail';
 for(const id of ['egg-unlocked','gem-reward','clearing-tip','pet-ability-tip','fit-warning-tip','obsidian-tip','goal-hint']){
  const notice=document.getElementById(id);if(notice)rail.append(notice);
 }
 document.body.append(rail);
 const layout=()=>{
  const top=Math.ceil(goal.getBoundingClientRect().bottom)+10;
  rail.style.top=`${top}px`;
  rail.style.maxHeight=`${Math.max(0,tray.getBoundingClientRect().top-top-12)}px`;
 };
 const observer=new ResizeObserver(layout);observer.observe(document.querySelector('#run-hud')!);observer.observe(tray);
 window.addEventListener('resize',layout);layout();
 return ()=>{observer.disconnect();window.removeEventListener('resize',layout);rail.remove();};
}
