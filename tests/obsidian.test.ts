import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {ConnectedSurface,exposedEdges} from '../src/surface';
const shape={id:'single',name:'Single',width:1,height:1,cells:[[0,0] as const]};
test('water placement immediately cools only edge-adjacent lava and leaves water intact',()=>{
 const g=new Game();g.board[26]=g.board[28]=g.board[18]='lava';g.inventory=[{tile:'water',shape}];g.place(0,27);
 assert.equal(g.board[26],'obsidian');assert.equal(g.board[28],'obsidian');assert.equal(g.board[18],'lava');assert.equal(g.board[27],'water');assert.deepEqual(g.obsidianEvents,[26,28]);
});
test('lava placement and pet placement both cool without waiting for aftermath',()=>{
 const g=new Game();g.board[0]='water';g.inventory=[{tile:'lava',shape}];g.place(0,1);assert.equal(g.board[1],'obsidian');
 g.plantPetTile(8,'lava');assert.equal(g.board[8],'obsidian');g.board[63]='lava';g.plantPetTile(62,'water');assert.equal(g.board[63],'obsidian');
});
test('obsidian blocks placement, does not form stone as lava, and can be swept away',()=>{
 const g=new Game();g.board[0]='water';g.board[1]='lava';g.reconcileObsidian();assert.equal(g.canPlace({tile:'water',shape},1),false);assert.equal(g.canFormStone(9),false);g.clearCells([1],0,true);assert.equal(g.board[1],null);assert.equal(g.reconcileObsidian(),false);
});
test('obsidian joins shared borders and cooling settles to a stable solid surface',()=>{
 const s=new ConnectedSurface();s.set(27,'obsidian');s.set(28,'obsidian');assert.deepEqual(exposedEdges(s.board,27),[true,false,true,true]);assert.equal(s.texture.image.data[27*4],4);
 for(let t=0;t<1;t+=.025)s.update(t);assert.equal(s.texture.image.data[27*4+3],0);
 s.texture.dispose();s.material.dispose();s.mesh.geometry.dispose();
});
