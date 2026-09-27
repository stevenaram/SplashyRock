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

test('neighbor reveals finish before stone delay, stay stable, and recede after clearing',()=>{
 const surface=new ConnectedSurface(),data=surface.texture.image.data;
 surface.set(26,'water');surface.set(28,'lava');surface.update(0);
 assert.equal(data[27*4+1],0);assert.equal(data[27*4+2],0);
 surface.update(.05);surface.update(.10);surface.update(.15);
 assert.ok(data[27*4+1]>0&&data[27*4+1]<255);
 for(let t=.20;t<=.46;t+=.05)surface.update(t);
 assert.equal(data[27*4+1],255);assert.equal(data[27*4+2],255);
 assert.equal(data[17*4+1],0); // Diagonal to water remains untouched.
 surface.set(0,'water');surface.update(.50);assert.equal(data[27*4+1],255);
 surface.set(26,null);surface.update(.55);assert.ok(data[27*4+1]<255&&data[27*4+1]>0);
 for(let t=.60;t<=.81;t+=.05)surface.update(t);
 assert.equal(data[27*4+1],0);assert.equal(data[27*4+2],255);
 surface.resetInfluences();assert.equal(data[27*4+2],0);
 surface.texture.dispose();surface.mesh.geometry.dispose();surface.material.dispose();
});
test('reduced motion snaps influences and occupied cells cannot retain them',()=>{
 const surface=new ConnectedSurface(),data=surface.texture.image.data;
 surface.set(26,'water');surface.update(0,true);assert.equal(data[27*4+1],255);
 assert.equal(surface.material.uniforms.time.value,0);
 surface.set(27,'stone');surface.update(.01);assert.equal(data[27*4+1],0);
 surface.texture.dispose();surface.mesh.geometry.dispose();surface.material.dispose();
});

test('stone removes decorations immediately and burial does not regrow them before the neighbor sweep',()=>{
 const s=new ConnectedSurface(),data=s.texture.image.data;
 s.set(26,'water');s.set(28,'lava');s.update(0,true);
 assert.equal(data[109],255);assert.equal(data[110],255);
 s.set(27,'stone');assert.equal(data[109],0);assert.equal(data[110],0);
 s.set(27,null);
 for(let t=.05;t<.4;t+=.05)s.update(t);
 assert.equal(data[109],0);assert.equal(data[110],0);
 s.set(26,null);s.set(28,null);s.finishBurial(27);s.update(.45,true);
 assert.equal(data[109],0);assert.equal(data[110],0);
 s.set(26,'water');s.update(.5,true);assert.equal(data[109],255);
 s.texture.dispose();s.mesh.geometry.dispose();s.material.dispose();
});

test('pet trails feed exactly the same visual influence channels as normal neighbors',()=>{
 for(const element of ['water','lava'] as const){
  const regular=new ConnectedSurface(),pet=new ConnectedSurface();regular.set(26,element);const marks=Array(64).fill(null);marks[27]={element};pet.petMarks=marks;
  for(let time=0;time<.5;time+=.05){regular.update(time);pet.update(time);assert.deepEqual(Array.from(pet.texture.image.data.slice(27*4,27*4+4)),Array.from(regular.texture.image.data.slice(27*4,27*4+4)));}
  pet.set(27,element);pet.update(.5);assert.equal(pet.texture.image.data[27*4+1],0);assert.equal(pet.texture.image.data[27*4+2],0);
  for(const s of [regular,pet]){s.texture.dispose();s.mesh.geometry.dispose();s.material.dispose();}
 }
});
