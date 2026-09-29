export const hopTuning={enabled:new URLSearchParams(globalThis.location?.search??'').get('tune')==='hop',height:8.25};
export function createHopControls(replay:()=>void){
 if(!hopTuning.enabled)return ()=>{};
 const panel=document.createElement('aside');panel.id='hop-tuning';
 panel.innerHTML='<label for="hop-height">Hop height <output>8.25</output></label><input id="hop-height" type="range" min="1" max="24" step="0.25" value="8.25"><button type="button">Test hop</button><small>Place the egg first. Timing stays unchanged.</small>';
 const slider=panel.querySelector('input')!;
 slider.addEventListener('input',()=>{hopTuning.height=Number(slider.value);panel.querySelector('output')!.textContent=hopTuning.height.toFixed(2);});
 panel.querySelector('button')!.addEventListener('click',replay);document.body.append(panel);
 return ()=>panel.remove();
}
