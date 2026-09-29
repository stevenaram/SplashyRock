export const MAX_PETS=64;
// The first egg arrives early; later milestones retain the existing 3.3% curve.
export const FIRST_EGG_SCORE=3000;
export const EGG_COST_GROWTH=1.033;
export const EGG_GOALS:readonly number[]=(()=>{let total=0,step=5000;return Array.from({length:MAX_PETS},(_,index)=>{total+=step;step*=EGG_COST_GROWTH;return index===0?FIRST_EGG_SCORE:Math.round(total);});})();
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
