export const MAX_PETS=64;
export const EGG_GOALS:readonly number[]=(()=>{let total=0,step=5000;return Array.from({length:MAX_PETS},()=>{total+=step;step*=1.2;return Math.round(total);});})();
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
