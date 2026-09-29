export const MAX_PETS=64;
// Every egg costs 10% more than the previous one, starting at 3,000.
export const FIRST_EGG_SCORE=3000;
export const EGG_COST_GROWTH=1.1;
export const EGG_GOALS:readonly number[]=(()=>{let total=0,step=FIRST_EGG_SCORE;return Array.from({length:MAX_PETS},()=>{total+=step;step*=EGG_COST_GROWTH;return Math.round(total);});})();
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
