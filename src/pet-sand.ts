import type {Tile} from './game';
export function isPureSand(board:readonly(Tile|null)[],cell:number){
 if(cell<0||cell>=64||board[cell]!==null)return false;
 const x=cell%8;
 return ![x>0?cell-1:-1,x<7?cell+1:-1,cell-8,cell+8].some(n=>n>=0&&n<64&&(board[n]==='water'||board[n]==='lava'));
}
