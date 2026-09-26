import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exposedEdges,ConnectedSurface} from '../src/surface';
import type {Tile} from '../src/game';
test('same-element shared edges disappear; different elements and board edges remain',()=>{
 const board:(Tile|null)[]=Array(64).fill(null);
 board[27]='water';board[28]='water';board[19]='lava';
 assert.deepEqual(exposedEdges(board,27),[true,false,true,true]);
 assert.deepEqual(exposedEdges(board,28),[false,true,true,true]);
 board[7]='lava';board[8]='lava';
 assert.deepEqual(exposedEdges(board,7),[true,true,true,true]);
});
test('visual occupancy updates independently of gameplay and encodes all elements',()=>{
 const surface=new ConnectedSurface();
 surface.set(0,'water');surface.set(1,'lava');surface.set(2,'stone');
 assert.deepEqual(Array.from(surface.texture.image.data.slice(0,12)),[1,0,0,255,2,0,0,255,3,0,0,255]);
 surface.update(2);assert.equal(surface.material.uniforms.time.value,2);
 surface.texture.dispose();surface.mesh.geometry.dispose();surface.material.dispose();
});
