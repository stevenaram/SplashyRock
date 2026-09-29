export const MAX_PETS=64;
// Each next egg costs 3.3% more; the 64th unlocks at 1,058,739 total score.
export const EGG_COST_GROWTH=1.033;
export const EGG_GOALS:readonly number[]=(()=>{let total=0,step=5000;return Array.from({length:MAX_PETS},()=>{total+=step;step*=EGG_COST_GROWTH;return Math.round(total);});})();
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
