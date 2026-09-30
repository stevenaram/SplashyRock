import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import {createForge} from '../src/forge';
test('forge model batches painted detail while retaining ten animated bricks and moving machinery',()=>{
 const model=createForge();let meshes=0;model.group.traverse(o=>{if(o instanceof Mesh){meshes++;assert.ok(o.geometry.attributes.position.count>0);}});
 assert.equal(model.bricks.length,10);assert.equal(model.gears.length,2);assert.equal(model.pistons.length,2);assert.ok(meshes<30,`Expected batched forge, got ${meshes} meshes`);assert.ok(model.bricks.every(b=>!b.visible));model.dispose();
});
test('filled water basin steams even at capacity, and production boosts lava heat temporarily',async()=>{
 const {Game}=await import('../src/game'),{ForgeField}=await import('../src/forge');
 const g=new Game();g.forges.set(27,{bricks:0,cycles:0});g.board[27]='forge';g.board[26]='lava';g.board[28]='water';
 let heat=0;const view=new ForgeField(()=>{},(_,value)=>heat=value);view.update(g,.1,false);assert.equal(heat,.3);
 const steam:Mesh[]=[];view.group.traverse(o=>{if(o instanceof Mesh&&o.name==='forge-water-steam')steam.push(o);});assert.equal(steam.filter(p=>p.visible).length,4);
 g.forges.get(27)!.bricks=2;view.update(g,.1,false);assert.ok(heat>.3);assert.equal(steam.filter(p=>p.visible).length,5);
 g.forges.get(27)!.bricks=10;view.update(g,2,false);assert.equal(heat,.3);assert.equal(steam.filter(p=>p.visible).length,4);
 g.board[26]=g.board[28]=null;view.update(g,.1,false);assert.equal(heat,0);assert.ok(steam.every(p=>!p.visible));view.dispose();
});
