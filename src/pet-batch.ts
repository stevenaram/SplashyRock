import * as T from 'three';

// Animated pieces of every pet share instanced draw calls. Wakes and fading
// shells remain separate; their special transparency is short-lived or tiny.
export class PetBatch {
 readonly group=new T.Group();
 private hidden:T.Mesh[]=[];
 private batches=new Map<string,T.InstancedMesh>();
 prepare(){this.hidden.forEach(mesh=>mesh.visible=true);this.hidden=[];}
 sync(roots:readonly T.Group[]){
  const buckets=new Map<string,T.Mesh[]>();
  const visit=(object:T.Object3D)=>{
   if(!object.visible)return;
   if(object instanceof T.Mesh&&object.material instanceof T.MeshBasicMaterial&&!object.material.transparent){
    const geometry=object.geometry as T.BufferGeometry&{parameters?:unknown};
    const key=geometry.type+JSON.stringify(geometry.parameters)+':'+(object.material.map?.name??'solid')+':'+object.material.side;
    const list=buckets.get(key)??[];list.push(object);buckets.set(key,list);
   }
   object.children.forEach(visit);
  };
  roots.forEach(root=>{root.updateMatrixWorld(true);visit(root);});
  this.batches.forEach(batch=>batch.count=0);
  for(const [key,meshes] of buckets){
   let batch=this.batches.get(key);
   if(!batch||batch.instanceMatrix.count<meshes.length){
    if(batch){batch.removeFromParent();(batch.material as T.Material).dispose();batch.dispose();}
    const material=(meshes[0].material as T.MeshBasicMaterial).clone();material.color.set('#ffffff');
    batch=new T.InstancedMesh(meshes[0].geometry,material,Math.max(64,2**Math.ceil(Math.log2(meshes.length))));batch.frustumCulled=false;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(batch);this.batches.set(key,batch);
   }
   batch.count=meshes.length;
   meshes.forEach((mesh,index)=>{batch!.setMatrixAt(index,mesh.matrixWorld);batch!.setColorAt(index,(mesh.material as T.MeshBasicMaterial).color);mesh.visible=false;this.hidden.push(mesh);});
   batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
  }
 }
 clear(){this.prepare();this.batches.forEach(batch=>{batch.removeFromParent();(batch.material as T.Material).dispose();batch.dispose();});this.batches.clear();}
}
