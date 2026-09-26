import * as THREE from 'three';
import { TILE_SIZE } from './map';
import type { Tile } from './game';
export const COLORS = {
  water: { fill: '#4d8195', edge: '#73d8fa' },
  lava: { fill: '#984300', edge: '#ff7100' },
  stone: { fill: '#f8d9c1', edge: '#f8d9c1' },
};
export function createTile(tile: Tile, preview = false, valid = true) {
  const group = new THREE.Group();
  const colors = valid ? COLORS[tile] : { fill: '#773333', edge: '#ff7777' };
  const size = TILE_SIZE - 0.09;
  const mesh = (w: number, h: number, color: string, x = 0, z = 0) => {
    const part = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color, transparent: preview, opacity: preview ? 0.68 : 1, depthWrite: !preview,
    }));
    part.rotation.x = -Math.PI / 2;
    part.position.set(x, 0, z);
    group.add(part);
  };
  mesh(size, size, colors.fill);
  const edge = 0.10;
  for (const sign of [-1, 1]) {
    mesh(size, edge, colors.edge, 0, sign * (size - edge) / 2);
    mesh(edge, size, colors.edge, sign * (size - edge) / 2, 0);
  }
  // Lift the border slightly above the fill, avoiding coplanar flicker.
  group.children.slice(1).forEach(part => { part.position.y = 0.005; });
  group.position.y = preview ? 0.06 : 0.025;
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
