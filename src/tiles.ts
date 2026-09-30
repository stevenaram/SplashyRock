import * as THREE from 'three';
import type { Tile } from './game';
export const COLORS = {
  forge:{fill:'#657581',edge:'#cfb48a'},
  obsidian:{fill:'#251c39',edge:'#8a71ac'},
  bush: {fill:'#36764b',edge:'#bee18a'},
  water: { fill: '#248ab2', edge: '#a3ded7' },
  lava: { fill: '#bb482d', edge: '#ffb957' },
  stone: { fill: '#876e53', edge: '#f8d9c1' },
};
// Placement ghosts deliberately contain no stone-reaction forecasting.
export function createTile(tile: Tile, _preview = true, valid = true) {
  const group=new THREE.Group(),size=2;
  const colors=valid?COLORS[tile]:{fill:'#893a32',edge:'#f88c36'};
  const plane=(w:number,h:number,color:string,opacity:number,x=0,z=0)=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.001,z);mesh.renderOrder=10;group.add(mesh);
  };
  plane(size,size,colors.fill,.58);
  for(const sign of [-1,1]){plane(size,.0625,colors.edge,1,0,sign*(1-.0625/2));plane(.0625,size,colors.edge,1,sign*(1-.0625/2),0);}
  group.children.slice(1).forEach(part=>part.position.y+=.001);
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
