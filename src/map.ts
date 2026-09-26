import * as THREE from 'three';

// Diggy Splash's grid dimensions, kept separate for future game systems.
import { SIZE } from './game';
export { SIZE } from './game';
export const TILE_SIZE = 2;
export const BOARD_EXTENT = SIZE * TILE_SIZE;
export const gridWorld = (coordinate: number) =>
  (coordinate - (SIZE - 1) / 2) * TILE_SIZE;

export function createMap(): THREE.Group {
  const map = new THREE.Group();
  map.name = 'map';
  const material = new THREE.MeshBasicMaterial({ color: '#686868' });
  const thickness = 0.095;
  const geometry = new THREE.PlaneGeometry(BOARD_EXTENT + thickness, thickness);
  const half = BOARD_EXTENT / 2;

  // Flat strips retain a consistent visible weight across WebGL implementations.
  for (let index = 0; index <= SIZE; index++) {
    const coordinate = -half + index * TILE_SIZE;
    const row = new THREE.Mesh(geometry, material);
    row.rotation.x = -Math.PI / 2;
    row.position.set(0, 0, coordinate);
    const column = new THREE.Mesh(geometry, material);
    column.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    column.position.set(coordinate, 0, 0);
    map.add(row, column);
  }
  return map;
}
