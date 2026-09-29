import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Effects} from '../src/effects';
test('layered placement and clearing effects finish without leaving scene objects',()=>{
 const effects=new Effects();
 effects.burst(27,'water',true);effects.burst(28,'lava',true);effects.burst(29,'stone');
 effects.sand(27);effects.sandWave(27);effects.dissolve(28,'lava');
 assert.ok(effects.group.children.length>0);
 for(let i=0;i<60;i++)effects.update(1/30);
 assert.equal(effects.group.children.length,0);
 effects.burst(0,'water');effects.sand(0);effects.sandWave(0);effects.clear();
 assert.equal(effects.group.children.length,0);effects.dispose();
});
test('sand waves remain within the board at corners',()=>{
 const effects=new Effects();effects.sandWave(0);
 assert.equal(effects.group.children.length,2);
 effects.update(.14);
 for(const mesh of effects.group.children){assert.ok(mesh.position.x>=-7);assert.ok(mesh.position.z>=-7);}
 effects.dispose();
});

test('evaporation batches steam, caps overlays, and cleans up after large cascades',()=>{
 const effects=new Effects();
 for(let i=0;i<64;i++)effects.evaporate(i,i%2?'water':'lava');
 assert.ok(effects.group.children.length<=17);
 for(let i=0;i<60;i++)effects.update(1/30);
 assert.equal(effects.group.children.length,0);
 effects.evaporate(27,'water');effects.clear();assert.equal(effects.group.children.length,0);
 effects.evaporate(28,'lava');for(let i=0;i<60;i++)effects.update(1/30);
 assert.equal(effects.group.children.length,0);effects.dispose();
});

test('evaporation is visible on its first frame and fully settles within half a second',()=>{
 const effects=new Effects();effects.evaporate(27,'water');effects.evaporate(28,'lava');
 effects.update(1/30);assert.ok(effects.group.children.length>0);
 for(let i=0;i<16;i++)effects.update(1/30);
 assert.equal(effects.group.children.length,0);effects.dispose();
});
