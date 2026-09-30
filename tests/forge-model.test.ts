import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import {createForge} from '../src/forge';
test('forge model batches painted detail while retaining ten animated bricks and moving machinery',()=>{
 const model=createForge();let meshes=0;model.group.traverse(o=>{if(o instanceof Mesh){meshes++;assert.ok(o.geometry.attributes.position.count>0);}});
 assert.equal(model.bricks.length,10);assert.equal(model.gears.length,2);assert.equal(model.pistons.length,2);assert.ok(meshes<25,`Expected batched forge, got ${meshes} meshes`);assert.ok(model.bricks.every(b=>!b.visible));model.dispose();
});
