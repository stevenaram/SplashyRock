import type { Piece } from './game';
import {petIcon} from './pet';

// Each grid edge is emitted once, including shared interior dividers.
export function pieceIcon(piece: Piece) {
  if(piece.tile==='pet')return `<img class="shape-icon pet-icon" src="${petIcon(piece.petElement)}" alt="" draggable="false"/><span class="pet-label">${piece.petElement==='water'?'WATER PET':'LAVA PET'}</span>`;
  const {width,height,cells}=piece.shape;
  const edges=new Set<string>();
  const fills=cells.map(([x,y])=>{
    const a=x*24,b=y*24;
    edges.add(`M${a},${b}h24`);edges.add(`M${a},${b+24}h24`);
    edges.add(`M${a},${b}v24`);edges.add(`M${a+24},${b}v24`);
    return `M${a},${b}h24v24h-24z`;
  }).join('');
  return `<svg class="shape-icon" aria-hidden="true" style="--columns:${width};--rows:${height};--icon-unit:calc(var(--unit) * ${3/Math.max(3,width,height)})" viewBox="-1 -1 ${width*24+2} ${height*24+2}" shape-rendering="crispEdges"><path d="${fills}" fill="var(--fill)"/><path d="${[...edges].join('')}" fill="none" stroke="var(--edge)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="miter"/></svg>`;
}
