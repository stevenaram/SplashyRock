export function scoreTestControls(add:(amount:number)=>boolean,score:()=>number,nextEgg:()=>number|undefined,restart:()=>void,addGems:(amount:number)=>boolean,gems:()=>number,berries:()=>number,setBerries:(value:number)=>void,bushLimit:()=>number){
 const bossPanel=document.querySelector<HTMLElement>('#boss-test');
 const panel=document.createElement('details');panel.id=bossPanel?'score-test-controls':'boss-test';panel.className='score-test';panel.open=!bossPanel;
 panel.innerHTML='<summary>Score, gems &amp; berries test</summary><p>Unlock eggs or add gems to test revives.</p><div><button data-add="5000">+5,000</button><button data-add="25000">+25,000</button></div><button class="next-egg">Next egg unlock</button><form><label for="test-score-amount">Custom score</label><div><input id="test-score-amount" type="number" min="1" max="10000000" step="1" value="1000" inputmode="numeric" required/><button type="submit">Add</button></div></form><div><button data-gems="20">+20 gems</button><button data-gems="100">+100 gems</button></div><form class="gem-test-form"><label for="test-gem-amount">Custom gems</label><div><input id="test-gem-amount" type="number" min="1" max="1000000" step="1" value="20" inputmode="numeric" required/><button type="submit">Add gems</button></div></form><p class="berry-test-live"></p><form class="berry-test-form"><label for="test-berry-amount">Berries grown this run</label><div><input id="test-berry-amount" type="number" min="0" max="10000000" step="1" value="0" inputmode="numeric" required/><button type="submit">Set berries</button></div></form><small>Bush shapes always contain at most 3 tiles.</small><p class="score-test-status" role="status"></p><button class="reset-score-test">New test run</button><small>Sandbox only. Scores, gems and achievements are not saved.</small>';
 const status=panel.querySelector<HTMLElement>('.score-test-status')!;
 const apply=(amount:number)=>{if(!Number.isSafeInteger(amount)||amount<1||amount>10000000){status.textContent='Enter 1–10,000,000.';return;}status.textContent=add(amount)?`Score: ${score().toLocaleString()}`:'Start a new test run to add score.';};
 panel.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b=>b.addEventListener('click',()=>apply(Number(b.dataset.add))));
 panel.querySelector('.next-egg')!.addEventListener('click',()=>{const target=nextEgg();if(target===undefined){status.textContent='All 64 eggs unlocked.';return;}apply(Math.max(1,target-score()));});
 panel.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();apply(Number(panel.querySelector<HTMLInputElement>('input')!.value));});
 const applyGems=(amount:number)=>{status.textContent=addGems(amount)?`Gems: ${gems().toLocaleString()}`:'Enter 1–1,000,000 gems.';};
 panel.querySelectorAll<HTMLButtonElement>('[data-gems]').forEach(b=>b.addEventListener('click',()=>applyGems(Number(b.dataset.gems))));
 panel.querySelector('.gem-test-form')!.addEventListener('submit',e=>{e.preventDefault();applyGems(Number(panel.querySelector<HTMLInputElement>('#test-gem-amount')!.value));});
 panel.querySelector('.reset-score-test')!.addEventListener('click',()=>{restart();status.textContent='New test run.';});
 const live=panel.querySelector<HTMLElement>('.berry-test-live')!;
 const input=panel.querySelector<HTMLInputElement>('#test-berry-amount')!;
 const refresh=()=>{live.textContent=`Berries grown: ${berries().toLocaleString()} · Bush limit: ${bushLimit()} tiles`;};
 panel.querySelector('.berry-test-form')!.addEventListener('submit',e=>{e.preventDefault();const value=Number(input.value);if(!Number.isSafeInteger(value)||value<0||value>10000000){status.textContent='Enter 0–10,000,000 berries.';return;}setBerries(value);refresh();status.textContent=`Berries grown set to ${value.toLocaleString()}.`;});
 input.value=String(berries());refresh();const timer=setInterval(refresh,500);
 (bossPanel??document.body).append(panel);return ()=>{clearInterval(timer);panel.remove();};
}
