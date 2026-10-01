/** Diagonal deck sweep completes before the island starts slipping astern. */
export const DECK_SWEEP_SECONDS=3;
export function deckReveal(cell:number,age:number,reduced=false){
 return reduced?1:Math.max(0,Math.min(1,(age-(cell%8+Math.floor(cell/8))*.18)/.45));
}
export function launchPose(age:number,reduced=false){
 const voyage=Math.max(0,age-DECK_SWEEP_SECONDS),rock=reduced?0:Math.min(1,voyage/1.2),settle=Math.exp(-voyage/5);
 return {voyage,pitch:rock*(.055*Math.sin(voyage*1.5)*settle+.012*Math.sin(voyage*.8)),roll:rock*(.035*Math.sin(voyage*2)*settle+.022*Math.sin(voyage*.95)),heave:rock*(-.12*Math.sin(Math.min(Math.PI,voyage*.9))+.035*Math.sin(voyage*1.4))};
}
