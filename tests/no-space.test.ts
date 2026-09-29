import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noSpacePieces,failedAnchor} from '../src/no-space';
import {Game,type Piece} from '../src/game';
const piece=(tile:'water'|'lava'):Piece=>({tile,shape:{id:'square',name:'Square',width:2,height:2,cells:[[0,0],[1,0],[0,1],[1,1]]}});
test('failed-fit demonstrations use exactly three remaining pieces, repeating only as needed',()=>{
 const a=piece('water'),b=piece('lava'),c=piece('water');
 assert.deepEqual(noSpacePieces([null,a,null]),[a,a,a]);
 assert.deepEqual(noSpacePieces([a,null,b]),[a,b,a]);
 assert.deepEqual(noSpacePieces([a,b,c]),[a,b,c]);
 assert.deepEqual(noSpacePieces([null,null]),[]);
});
test('demonstrations use distinct in-bounds blocked placements, favoring remaining sand',()=>{
 const g=new Game();g.board.fill('lava');for(const c of [9,10,27,28,45,46])g.board[c]=null;
 const p=piece('water'),used:number[]=[];
 for(let lane=0;lane<3;lane++){
  const cell=failedAnchor(g,p,lane,used);assert.equal(used.includes(cell),false);used.push(cell);
  assert.ok(cell%8+p.shape.width<=8&&Math.floor(cell/8)+p.shape.height<=8);
  assert.equal(g.canPlace(p,cell),false);
  assert.ok(p.shape.cells.some(([dx,dy])=>g.board[cell+dy*8+dx]===null));
 }
});
