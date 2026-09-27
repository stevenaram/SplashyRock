import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {PetBatch} from '../src/pet-batch';
test('64 painted pets share geometry draw calls while retaining individual transforms and colors',()=>{
 const batch=new PetBatch(),roots:T.Group[]=[];
 for(let i=0;i<64;i++){const root=new T.Group();root.position.x=i;root.add(new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:i%2?'red':'blue'})));roots.push(root);}
 batch.sync(roots);assert.equal(batch.group.children.length,1);const instances=batch.group.children[0] as T.InstancedMesh;assert.equal(instances.count,64);
 const matrix=new T.Matrix4();instances.getMatrixAt(63,matrix);assert.equal(matrix.elements[12],63);const color=new T.Color();instances.getColorAt(63,color);assert.equal(color.getHexString(),'ff0000');
 batch.prepare();assert.ok(roots.every(root=>root.children[0].visible));roots[0].visible=false;batch.sync(roots);assert.equal(instances.count,63);batch.clear();assert.equal(batch.group.children.length,0);
 roots.forEach(r=>{const m=r.children[0] as T.Mesh;m.geometry.dispose();(m.material as T.Material).dispose();});
});
