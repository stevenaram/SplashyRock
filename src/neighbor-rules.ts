import type {Element,Tile} from './game';
type Board=readonly(Tile|null)[];
export function forgeBasin(board:Board,cell:number){
 return (cell%8<7&&board[cell+1]==='forge')||(cell%8>0&&board[cell-1]==='forge');
}
// Contained liquids remain real tiles, but do not heat or wet surrounding sand.
export function neighborSource(board:Board,cell:number,element:Element){
 return cell>=0&&cell<64&&board[cell]===element&&!forgeBasin(board,cell);
}
export function besideForge(board:Board,cell:number){
 const footprint=(c:number)=>board[c]==='forge'||forgeBasin(board,c);
 return footprint(cell)||[cell%8?cell-1:-1,cell%8<7?cell+1:-1,cell-8,cell+8].some(c=>c>=0&&c<64&&footprint(c));
}
export function emptyForgeBasin(board:Board,cell:number,element:Element){
 return board[cell]===null&&(element==='lava'?(cell%8<7&&board[cell+1]==='forge'):(cell%8>0&&board[cell-1]==='forge'));
}
