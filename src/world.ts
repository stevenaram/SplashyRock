import * as THREE from 'three';
import { BOARD_EXTENT, createMap } from './map';

export class World {
  readonly scene = new THREE.Scene();
  // Same lens and fixed viewing angle as Diggy Splash.
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
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
      0.95 / Math.max(...points.map(p => Math.abs(p.x))),
      0.80 / Math.max(...points.map(p => Math.abs(p.y))),
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
