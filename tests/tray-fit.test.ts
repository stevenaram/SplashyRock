import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
const square:Piece={tile:'water',shape:{id:'square',name:'Square',width:2,height:2,cells:[[0,0],[1,0],[0,1],[1,1]]}};
const single:Piece={tile:'lava',shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}};
test('individual inventory warnings distinguish a blocked piece from a playable one and refresh after clearing',()=>{
 const g=new Game();g.board.fill('water');g.board[27]=null;g.inventory=[square,single,null];assert.equal(g.pieceFits(square),false);assert.equal(g.pieceFits(single),true);assert.equal(g.hasLegalMove(),true);
 g.clearCells([28,35,36]);assert.equal(g.pieceFits(square),true);g.place(0,36);assert.equal(g.pieceFits(single),false);
});
test('fit warnings preserve shape holes and do not mistake edge wrapping for a legal placement',()=>{
 const g=new Game();g.board.fill('lava');for(const c of [7,8,15,16])g.board[c]=null;assert.equal(g.pieceFits(square),false);
 g.board.fill('water');const corner:Piece={tile:'water',shape:{id:'corner',name:'Corner',width:2,height:2,cells:[[0,0],[1,0],[0,1]]}};for(const c of [27,28,35])g.board[c]=null;assert.equal(g.pieceFits(corner),true);assert.equal(g.pieceFits(square),false);
});
