import type {Game,Piece} from './game';
export const FEATURE_TIPS={
 'berries-grown':'Water beside a bush grows berries.',
 'berries-eaten':'Pets eat berries instead of placing their usual tile.',
 'berry-blast':"Eating berries triggers a Pet's Berry Blast ability.",
 'bush-fire':'This bush is burning. It will burn away in a fiery blast when you place your next shape.',
 'bush-extinguished':'Water beside a burning bush puts the fire out.',
 'pet-forge-fuel':'Pets bring lava or water to the forge as needed, unless they’re busy eating berries.',
 'obsidian-blast':"Placing bricks triggers a Pet's Obsidian Blast ability.",
 'forge-both':'Add lava to the left basin and water to the right to light the forge.',
 'forge-lava':'This forge needs lava in its left basin.',
 'forge-water':'This forge needs water in its right basin.',
} as const;
export type FeatureTip=keyof typeof FEATURE_TIPS;
export function forgeSuggestion(game:Game,piece:Piece){
 const rank=(c:number)=>{const x=c%8,y=Math.floor(c/8),edge=Math.min(x,7-x,y,7-y);return Math.hypot(x-1,7-y)+edge*2;};
 return game.board.map((_,c)=>c).filter(c=>game.canPlace(piece,c)).sort((a,b)=>rank(a)-rank(b)||b-a)[0];
}
export function forgeNeeds(game:Game):FeatureTip[]{
 return [...game.forges.keys()].flatMap(c=>{const lava=game.board[c-1]==='lava',water=game.board[c+1]==='water';return lava&&water?[]:[!lava&&!water?'forge-both':lava?'forge-water':'forge-lava'];});
}
