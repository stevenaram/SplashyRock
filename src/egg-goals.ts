export const MAX_PETS=16;
// Every egg costs 20% more than the previous one, starting at 3,000.
export const FIRST_EGG_SCORE=3000;
export const EGG_COST_GROWTH=1.2;
export const MAX_FORGES=8;
export const REWARD_GOALS:readonly number[]=(()=>{let total=0,step=FIRST_EGG_SCORE;return Array.from({length:MAX_PETS+MAX_FORGES},()=>{total+=step;step*=EGG_COST_GROWTH;return Math.round(total);});})();
export const EGG_GOALS=REWARD_GOALS.slice(0,MAX_PETS);
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
