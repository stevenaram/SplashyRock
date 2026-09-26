import * as THREE from 'three';
import { TILE_SIZE } from './map';
import type { Tile } from './game';
import { rock, waterTexture } from './island';
export const COLORS = {
  water: { fill: '#238fb6', edge: '#73d8fa' },
  lava: { fill: '#984300', edge: '#ff7100' },
  stone: { fill: '#89715e', edge: '#f8d9c1' },
};
const textures = new Map<Tile, THREE.Texture>();
function surfaceTexture(tile: Tile) {
  if (!textures.has(tile)) {
    const texture = waterTexture(tile === 'lava');
    texture.repeat.set((TILE_SIZE - .09) / 8, (TILE_SIZE - .09) / 8);
    textures.set(tile, texture);
  }
  return textures.get(tile)!;
}
export function createTile(tile: Tile, preview = false, valid = true) {
  const group = new THREE.Group();
  const colors = valid ? COLORS[tile] : { fill: '#773333', edge: '#ff7777' };
  const size = TILE_SIZE - 0.09;
  const top = preview ? .10 : .055;
  if (!preview) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(size,.10,size), new THREE.MeshStandardMaterial({color:tile==='water'?'#367f98':tile==='lava'?'#633b31':'#9b8062',roughness:1}));
    base.position.y=0;base.receiveShadow=true;group.add(base);
  }
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: !preview && tile!=='stone' ? '#ffffff' : colors.fill,
    map: !preview && tile!=='stone' ? surfaceTexture(tile) : null,
    transparent: preview, opacity: preview ? .68 : 1, depthWrite: !preview,
  });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(size,size),fillMaterial);
  fill.rotation.x=-Math.PI/2;fill.position.y=top;group.add(fill);
  const border = new THREE.MeshBasicMaterial({color:colors.edge,transparent:preview,opacity:preview?.85:1,depthWrite:!preview});
  const edge=.085;
  for(const sign of [-1,1]) {
    const row=new THREE.Mesh(new THREE.PlaneGeometry(size,edge),border);row.rotation.x=-Math.PI/2;row.position.set(0,top+.006,sign*(size-edge)/2);group.add(row);
    const column=new THREE.Mesh(new THREE.PlaneGeometry(edge,size),border);column.rotation.x=-Math.PI/2;column.position.set(sign*(size-edge)/2,top+.006,0);group.add(column);
  }
  if (!preview && tile==='stone') {
    for(const [x,z,s,h,seed] of [[-.25,.1,.66,.64,42],[.45,.3,.38,.32,92],[.25,-.45,.40,.40,124]]) {
      const boulder=rock(seed===42?'#c5af91':'#a9947a',seed);boulder.scale.set(s,h,s);boulder.position.set(x,top+h*.43,z);boulder.rotation.y=seed;group.add(boulder);
    }
  }
  if (!preview && tile==='water') {
    const glintMaterial=new THREE.MeshBasicMaterial({color:'#b9eff1'});
    for(const [x,z,w] of [[-.48,-.48,.32],[.30,.4,.23],[-.38,-.36,.14]]) {
      const glint=new THREE.Mesh(new THREE.PlaneGeometry(w,1/32),glintMaterial);glint.rotation.x=-Math.PI/2;glint.position.set(x,top+.01,z);group.add(glint);
    }
  }
  group.position.y=.025;
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
