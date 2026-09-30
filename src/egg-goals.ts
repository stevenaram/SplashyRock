export const MAX_PETS=16;
// Every reward costs 20% more than the previous one, starting at 3,000.
export const FIRST_EGG_SCORE=3000;
export const EGG_COST_GROWTH=1.2;
export const MAX_FORGES=8;
export const REWARD_GOALS:readonly number[]=(()=>{let total=0,step=FIRST_EGG_SCORE;return Array.from({length:MAX_PETS+MAX_FORGES},()=>{total+=step;step*=EGG_COST_GROWTH;return Math.round(total);});})();
// Eight introductory eggs, then eight forge/egg pairs (16 pets total).
export const REWARD_TYPES:readonly ('pet'|'forge')[]=REWARD_GOALS.map((_,i)=>i<8||i%2===1?'pet':'forge');
export const EGG_GOALS=REWARD_GOALS.filter((_,i)=>REWARD_TYPES[i]==='pet');
export function earnedEggs(score:number){return EGG_GOALS.filter(goal=>score>=goal).length;}
