import * as THREE from 'three';
import { BOARD_EXTENT, createMap, gridWorld, TILE_SIZE } from './map';
import { SIZE, footprint, type Piece, type Tile, type Game } from './game';
import { createTile, disposeGroup } from './tiles';
import { createIsland, rock } from './island';
import { ConnectedSurface } from './surface';
import { Effects } from './effects';
import {PetWalker} from './pet';
import { PixelRenderer } from './pixel-renderer';

export class World {
  readonly scene = new THREE.Scene();
  // Same lens and fixed viewing angle as Diggy Splash.
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: false });
  private readonly stones = new THREE.Group();
  private readonly surface = new ConnectedSurface();
  private readonly effects = new Effects();
  private readonly pixels = new PixelRenderer();
  private arrivals: {group: THREE.Group;age:number}[] = [];
  private departures: {group:THREE.Group;age:number}[]=[];
  private pet:PetWalker|null=null;
  game:Game|null=null;
  onPetChange:()=>void=()=>{};
  syncPetMarks(){if(this.game)this.surface.petMarks=this.game.petMarks;}
  removePet(){this.pet?.dispose();this.pet=null;}
  private frame = 0;
  private previousTime = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private island: THREE.Group;
  private preview: THREE.Group | null = null;
  private previewKey = "";
  private readonly raycaster = new THREE.Raycaster();
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLElement) {
    this.scene.background = new THREE.Color('#168eac');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(new THREE.HemisphereLight('#fff6da', '#538b94', 1.45));
    const sun = new THREE.DirectionalLight('#fff3d6', 1.65);
    sun.position.set(-12, 22, -9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
    sun.shadow.normalBias = .035; sun.shadow.bias = -.0001;
    this.island = createIsland();
    this.scene.add(sun, this.island, this.surface.mesh, this.effects.group, this.stones);
    this.scene.add(createMap());
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  private animate = (ms: number) => {
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden || ms-this.previousTime < 1000/30) return;
    const dt=Math.min((ms-this.previousTime)/1000,.05);this.previousTime=ms;
    const time=this.reducedMotion.matches?0:ms/1000;
    this.surface.update(ms/1000,this.reducedMotion.matches);
    if(this.pet){
      const revision=this.pet.motion.revision,busy=this.pet.motion.busy;
      this.pet.update(dt,this.reducedMotion.matches);
      if(this.game)for(const cell of this.game.petTileEvents.splice(0)){
        const tile=this.game.board[cell];if(tile==='water'||tile==='lava')this.addPiece(cell,{tile,shape:{id:'pet-drop',name:'Pet tile',width:1,height:1,cells:[[0,0]]}});
      }
      if(revision!==this.pet.motion.revision||busy!==this.pet.motion.busy)this.onPetChange();
    }
    if (!this.reducedMotion.matches) {
      this.effects.update(dt);
      if(this.arrivals.length||this.departures.length)this.renderer.shadowMap.needsUpdate=true;
      this.arrivals=this.arrivals.filter(a=>{a.age+=dt;const t=Math.min(1,a.age/.32);const rise=1-Math.pow(1-t,3);const settle=Math.sin(t*Math.PI)*.12;a.group.scale.set(1-settle*.25,rise+settle,1-settle*.25);return t<1;});
      this.departures=this.departures.filter(a=>{a.age+=dt;const t=Math.min(1,a.age/.18);a.group.position.y=.07-t*t*.5;a.group.scale.setScalar(1-t*t*.55);if(t===1){disposeGroup(a.group);return false;}return true;});
      const update=this.island.userData.animate as ((time:number)=>void)|undefined;
      update?.(time);
    }
    this.render();
  };

  cellScreen(cell:number) {
    const point=new THREE.Vector3(gridWorld(cell%SIZE),.6,gridWorld(Math.floor(cell/SIZE))).project(this.camera);
    return {x:(point.x+1)*this.host.clientWidth/2,y:(1-point.y)*this.host.clientHeight/2};
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
      const mesh = createTile(piece.tile==='pet'?'stone':piece.tile, preview, valid);
      mesh.position.x = gridWorld(x);
      mesh.position.z = gridWorld(y);
      group.add(mesh);
    }
    return group;
  }

  addStone(cell: number, animate = true) {
    this.surface.set(cell,'stone');
    const group=new THREE.Group();group.position.set(gridWorld(cell%8),.07,gridWorld(Math.floor(cell/8)));
    for(const [x,z,size] of [[-.25,.1,.64],[.40,.25,.35],[.1,-.4,.36]]) {
      const boulder=rock('#bca471',cell+Math.round(size*100));boulder.scale.set(size,size*.85,size);boulder.position.set(x,size*.35,z);group.add(boulder);
    }
    group.userData.cell=cell;
    this.stones.add(group);
    if(animate&&!this.reducedMotion.matches){group.scale.y=.05;this.arrivals.push({group,age:0});}
    this.renderer.shadowMap.needsUpdate = true;
    if(animate && !this.reducedMotion.matches)this.effects.burst(cell,'stone');
    if(animate)this.render();
  }

  syncBoard(board: readonly (Tile | null)[], animate = true) {
    const before=[...this.surface.board];
    for (const group of [...this.stones.children]) disposeGroup(group as THREE.Group);
    this.arrivals=[];this.departures.forEach(a=>disposeGroup(a.group));this.departures=[];
    this.effects.clear();
    board.forEach((tile, cell) => {
      this.surface.set(cell, tile);
      if (tile === 'stone') {
        this.addStone(cell, false);
        if(animate&&before[cell]!=='stone'&&!this.reducedMotion.matches){
          const group=this.stones.children[this.stones.children.length-1] as THREE.Group;
          group.scale.y=.05;this.arrivals.push({group,age:0});this.effects.burst(cell,'stone');
        }
      }
      if(animate && before[cell] && tile===null && !this.reducedMotion.matches) this.effects.dissolve(cell,before[cell]!);
    });
    if(!animate)this.surface.resetInfluences();
    this.renderer.shadowMap.needsUpdate = true;
    this.render();
  }

  sandSweep(board: readonly (Tile | null)[], cells: readonly number[], origin: number, phase: 'stone'|'neighbors') {
    for(const cell of cells){
      const previous=this.surface.board[cell];
      this.surface.set(cell,null);
      for(const group of [...this.stones.children]){
        if(group.userData.cell===cell){this.arrivals=this.arrivals.filter(a=>a.group!==group);if(this.reducedMotion.matches)disposeGroup(group as THREE.Group);else{this.scene.attach(group);this.departures.push({group:group as THREE.Group,age:0});}}
      }
      if(!this.reducedMotion.matches){if(previous==='water'||previous==='lava')this.effects.evaporate(cell,previous);else this.effects.sand(cell);}
    }
    if(phase==='neighbors')this.surface.finishBurial(origin);
    if(phase==='stone'&&!this.reducedMotion.matches)this.effects.sandWave(origin);
    this.renderer.shadowMap.needsUpdate=true;
    this.render();
  }

  addPiece(cell: number, piece: Piece) {
    if(piece.tile==='pet'){this.removePet();this.pet=this.game?.pet?new PetWalker(this.game.pet):null;if(this.pet)this.scene.add(this.pet.group);this.render();return;}
    for(const [x,y] of footprint(piece,cell)) {
      const index=y*8+x;this.effects.cancelEvaporation(index);this.surface.set(index,piece.tile);
      if(!this.reducedMotion.matches)this.effects.burst(index,piece.tile);
    }
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

  private render() { this.pixels.render(this.renderer, this.scene, this.camera); }

  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setPixelRatio(1);
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
    const left=new THREE.Vector3(-8,0,0).project(this.camera);
    const right=new THREE.Vector3(8,0,0).project(this.camera);
    this.pixels.resize(width,height,(right.x-left.x)*width/2);
    this.render();
  }

  dispose() {
    this.removePet();
    cancelAnimationFrame(this.frame);
    this.pixels.dispose();
    this.effects.dispose();
    this.surface.texture.dispose();
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
    const textures = new Set<THREE.Texture>();
    materials.forEach(material => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    });
    textures.forEach(texture => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
