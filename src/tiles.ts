import * as THREE from 'three';
import type { Tile } from './game';
export const COLORS = {
  water: { fill: '#248ab2', edge: '#a3ded7' },
  lava: { fill: '#bb482d', edge: '#ffb957' },
  stone: { fill: '#876e53', edge: '#f8d9c1' },
};
// Placement ghosts deliberately contain no stone-reaction forecasting.
export function createTile(tile: Tile, _preview = true, valid = true) {
  const group=new THREE.Group(),size=1.95;
  const colors=valid?COLORS[tile]:{fill:'#893a32',edge:'#f88c36'};
  const plane=(w:number,h:number,color:string,opacity:number,x=0,z=0)=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.17,z);group.add(mesh);
  };
  plane(size,size,colors.fill,.58);
  for(const sign of [-1,1]){plane(size,.0625,colors.edge,1,0,sign*.95);plane(.0625,size,colors.edge,1,sign*.95,0);}
  group.children.slice(1).forEach(part=>part.position.y+=.005);
  return group;
}
export function disposeGroup(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
  });
  group.removeFromParent();
}
