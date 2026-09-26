import * as THREE from 'three';
import { BOARD_EXTENT, createMap, gridWorld, TILE_SIZE } from './map';
import { SIZE, footprint, type Piece } from './game';
import { createTile, disposeGroup } from './tiles';

export class World {
  readonly scene = new THREE.Scene();
  // Same lens and fixed viewing angle as Diggy Splash.
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private preview: THREE.Group | null = null;
  private previewKey = "";
  private readonly raycaster = new THREE.Raycaster();
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLElement) {
    this.scene.background = new THREE.Color('#1e1e1e');
    this.scene.add(createMap());
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  cellAt(clientX: number, clientY: number): number | null {
    const rect = this.host.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(
      (clientX - rect.left) / rect.width * 2 - 1,
      1 - (clientY - rect.top) / rect.height * 2,
    ), this.camera);
    const point = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!point) return null;
    const column = Math.floor((point.x + BOARD_EXTENT / 2) / TILE_SIZE);
    const row = Math.floor((point.z + BOARD_EXTENT / 2) / TILE_SIZE);
    return column >= 0 && column < SIZE && row >= 0 && row < SIZE ? row * SIZE + column : null;
  }

  private pieceMesh(cell: number, piece: Piece, preview = false, valid = true) {
    const group = new THREE.Group();
    for (const [x, y] of footprint(piece, cell)) {
      const mesh = createTile(piece.tile, preview, valid);
      mesh.position.x = gridWorld(x);
      mesh.position.z = gridWorld(y);
      group.add(mesh);
    }
    return group;
  }

  addStone(cell: number) {
    const mesh = createTile('stone');
    mesh.position.x = gridWorld(cell % SIZE);
    mesh.position.z = gridWorld(Math.floor(cell / SIZE));
    this.scene.add(mesh);
    this.render();
  }

  addPiece(cell: number, piece: Piece) {
    this.scene.add(this.pieceMesh(cell, piece));
    this.render();
  }

  showPreview(cell: number | null, piece: Piece | null, valid = true) {
    const key = cell === null || !piece ? '' : `${cell}-${piece.tile}-${piece.shape.id}-${valid}`;
    if (key === this.previewKey) return;
    if (this.preview) disposeGroup(this.preview);
    this.preview = null;
    this.previewKey = key;
    if (cell !== null && piece) {
      this.preview = this.pieceMesh(cell, piece, true, valid);
      this.scene.add(this.preview);
    }
    this.render();
  }

  private render() { this.renderer.render(this.scene, this.camera); }

  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();

    const distance = Math.max(11.6, 14.5 / this.camera.aspect)
      / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const orientation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 3, 0, 0, 'YXZ'),
    );
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
    const target = new THREE.Vector3();
    this.camera.up.set(0, 1, 0).applyQuaternion(orientation);
    const update = () => {
      this.camera.position.copy(direction).multiplyScalar(distance).add(target);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld(true);
    };
    update();

    const half = BOARD_EXTENT / 2;
    const corners = [-half, half].flatMap(x =>
      [-half, half].map(z => new THREE.Vector3(x, 0, z)));
    // Center the projected footprint, as in Diggy Splash's camera framing.
    for (let pass = 0; pass < 3; pass++) {
      const points = corners.map(point => point.clone().project(this.camera));
      const midX = (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2;
      const midY = (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2;
      const depth = target.clone().project(this.camera).z;
      target.copy(new THREE.Vector3(midX, midY, depth).unproject(this.camera));
      update();
    }
    const points = corners.map(point => point.clone().project(this.camera));
    this.camera.zoom = Math.min(
      (1 - 24 / width) / Math.max(...points.map(p => Math.abs(p.x))),
      (1 - 24 / height) / Math.max(...points.map(p => Math.abs(p.y))),
    );
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.observer.disconnect();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => materials.add(material));
      }
    });
    materials.forEach(material => material.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
