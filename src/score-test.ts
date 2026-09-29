export function scoreTestControls(add:(amount:number)=>boolean,score:()=>number,nextEgg:()=>number|undefined,restart:()=>void){
 const panel=document.createElement('details');panel.id='boss-test';panel.className='score-test';panel.open=true;
 panel.innerHTML='<summary>Score test</summary><p>Add score to unlock eggs and test pets.</p><div><button data-add="5000">+5,000</button><button data-add="25000">+25,000</button></div><button class="next-egg">Next egg unlock</button><form><label for="test-score-amount">Custom score</label><div><input id="test-score-amount" type="number" min="1" max="10000000" step="1" value="1000" inputmode="numeric" required/><button type="submit">Add</button></div></form><p class="score-test-status" role="status"></p><button class="reset-score-test">New test run</button><small>Sandbox only. Scores, gems and achievements are not saved.</small>';
 const status=panel.querySelector<HTMLElement>('.score-test-status')!;
 const apply=(amount:number)=>{if(!Number.isSafeInteger(amount)||amount<1||amount>10000000){status.textContent='Enter 1–10,000,000.';return;}status.textContent=add(amount)?`Score: ${score().toLocaleString()}`:'Start a new test run to add score.';};
 panel.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b=>b.addEventListener('click',()=>apply(Number(b.dataset.add))));
 panel.querySelector('.next-egg')!.addEventListener('click',()=>{const target=nextEgg();if(target===undefined){status.textContent='All 64 eggs unlocked.';return;}apply(Math.max(1,target-score()));});
 panel.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();apply(Number(panel.querySelector<HTMLInputElement>('input')!.value));});
 panel.querySelector('.reset-score-test')!.addEventListener('click',()=>{restart();status.textContent='New test run.';});
 document.body.append(panel);return ()=>panel.remove();
}
