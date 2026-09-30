export const FEATURE_TRACKS=[
 {id:'bush-planted',goals:[1,10,50,100,250,500],text:(n:number)=>`Place ${n} bush ${n===1?'tile':'tiles'}.`},
 {id:'berries-grown',goals:[4,40,200,500,1000,2500],text:(n:number)=>`Grow ${n.toLocaleString('en-US')} berries on bushes.`},
 {id:'berries-eaten',goals:[1,10,50,100,250,500],text:(n:number)=>`Have pets eat ${n} ${n===1?'berry':'berries'}.`},
 {id:'berry-blast',goals:[1,10,25,50,100,250],text:(n:number)=>`Trigger ${n} successful pet berry ${n===1?'blast':'blasts'}.`},
 {id:'bush-burned',goals:[1,10,25,50,100,250],text:(n:number)=>`Burn out ${n} ${n===1?'bush':'bushes'} with a fiery blast.`},
 {id:'bush-extinguished',goals:[1,5,15,30,75,150],text:(n:number)=>`Extinguish ${n} burning ${n===1?'bush':'bushes'} with water.`},
 {id:'obsidian-formed',goals:[1,10,25,50,100,250],text:(n:number)=>`Create ${n} obsidian ${n===1?'tile':'tiles'}.`},
 {id:'obsidian-cleared',goals:[1,10,25,50,100,250],text:(n:number)=>`Clear ${n} obsidian ${n===1?'tile':'tiles'}.`},
] as const;
export type FeatureMetric=typeof FEATURE_TRACKS[number]['id'];
export const FEATURE_REWARDS=[3,5,10,15,25,40];
