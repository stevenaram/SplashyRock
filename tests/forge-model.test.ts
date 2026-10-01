import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import {createForge} from '../src/forge';
test('forge model batches painted detail while retaining ten animated bricks and moving machinery',()=>{
 const model=createForge();let meshes=0;model.group.traverse(o=>{if(o instanceof Mesh){meshes++;assert.ok(o.geometry.attributes.position.count>0);}});
 assert.equal(model.bricks.length,10);assert.equal(model.gears.length,2);assert.equal(model.pistons.length,2);assert.ok(meshes<=36,`Expected batched forge, got ${meshes} meshes`);assert.ok(model.bricks.every(b=>!b.visible));model.dispose();
});
test('filled water basin steams even at capacity, and production boosts lava heat temporarily',async()=>{
 const {Game}=await import('../src/game'),{ForgeField}=await import('../src/forge');
 const g=new Game();g.forges.set(27,{bricks:0,cycles:0});g.board[27]='forge';g.board[26]='lava';g.board[28]='water';
 let heat=0;const view=new ForgeField(()=>{},(_,value)=>heat=value);view.update(g,.1,false);assert.equal(heat,.3);
 const steam:Mesh[]=[];view.group.traverse(o=>{if(o instanceof Mesh&&o.name==='forge-water-steam')steam.push(o);});assert.equal(steam.filter(p=>p.visible).length,4);
 g.forges.get(27)!.bricks=2;g.forges.get(27)!.cycles++;view.update(g,.1,false);assert.ok(heat>.3);assert.equal(steam.filter(p=>p.visible).length,5);
 g.forges.get(27)!.bricks=10;view.update(g,4,false);assert.equal(heat,.3);assert.equal(steam.filter(p=>p.visible).length,4);
 g.board[26]=g.board[28]=null;view.update(g,.1,false);assert.equal(heat,0);assert.ok(steam.every(p=>!p.visible));view.dispose();
});

test('production peaks on creation and winds down independently of collected bricks',async()=>{
 const {Game}=await import('../src/game'),{ForgeField,forgeProductionHeat}=await import('../src/forge');
 assert.equal(forgeProductionHeat(0),1);assert.ok(forgeProductionHeat(.6)>forgeProductionHeat(1.8));assert.equal(forgeProductionHeat(3.2),0);
 const g=new Game();g.forges.set(27,{bricks:2,cycles:1});g.board[27]='forge';g.board[26]='lava';g.board[28]='water';
 let heat=0;const view=new ForgeField(()=>{},(_,v)=>heat=v);view.update(g,0,false);assert.equal(heat,1);
 g.forges.get(27)!.bricks=0;view.update(g,1,false);assert.ok(heat>.3&&heat<1);
 view.update(g,3,false);assert.equal(heat,.3);view.dispose();
});
test('production bricks retain their size and stack position throughout cooldown',async()=>{
 const {Game}=await import('../src/game'),{ForgeField}=await import('../src/forge');
 const g=new Game();g.forges.set(27,{bricks:2,cycles:1});g.board[27]='forge';g.board[26]='lava';g.board[28]='water';
 const view=new ForgeField();view.update(g,0,false);
 const forge=view.group.children[0];const bricks=forge.children.filter(o=>o.type==='Group'&&o.children.some(c=>c instanceof Mesh&&c.geometry.type==='BoxGeometry'&&c.geometry.parameters.width===1.2));
 assert.equal(bricks.length,10);
 const positions=bricks.map(b=>b.position.y);
 view.update(g,.2,false);bricks.forEach((b,i)=>{assert.equal(b.scale.x,1);assert.equal(b.scale.y,1);assert.equal(b.position.y,positions[i]);});view.dispose();
});
