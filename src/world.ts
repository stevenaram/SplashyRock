import {BOAT_HULL_BRICKS,BOAT_WALL_BRICKS} from './boat';
import {BoatView} from './boat-view';
import {ForgeField} from './forge';
import {BushField} from './bush-view';
import {BossView} from './boss-view';
import type {SoundCue} from './sound';
import * as THREE from 'three';
import { BOARD_EXTENT, createMap, gridWorld, TILE_SIZE } from './map';
import { SIZE, footprint, type Piece, type Tile, type Game, type Element } from './game';
import { createTile, disposeGroup } from './tiles';
import { createIsland, stoneCluster, charredBush } from './island';
import { ConnectedSurface } from './surface';
import { Effects } from './effects';
import {PetWalker} from './pet';
import {PetBatch} from './pet-batch';
import { PixelRenderer } from './pixel-renderer';

export class World {
  private readonly boat:BoatView;
  private boatFrame={x:8,minZ:-8,maxZ:8,height:0};
  private launchAge=0;
  private launchObjects:{object:THREE.Object3D;position:THREE.Vector3}[]=[];
  private readonly map=createMap();
  private shardSweeps=new Set<number>();
  private bushes=new BushField();
  private leafSweeps=new Set<number>();
  private fireSweeps=new Set<number>();
  private bossViews=new Map<number,BossView>();
  readonly scene = new THREE.Scene();
  // Same lens and fixed viewing angle as Diggy Splash.
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: false });
  private readonly forges=new ForgeField(c=>this.onSound('forge',c),(c,heat)=>this.surface.setForgeHeat(c,heat));
  private readonly stones = new THREE.Group();
  private readonly surface = new ConnectedSurface();
  private readonly effects = new Effects();
  private readonly pixels = new PixelRenderer();
  private arrivals: {group: THREE.Group;age:number}[] = [];
  private departures: {group:THREE.Group;age:number}[]=[];
  private pets:PetWalker[]=[];
  private readonly petBatch=new PetBatch();
  game:Game|null=null;
  onPetChange:()=>void=()=>{};
  onFirstPetAbility:(element:Element)=>void=()=>{};
  onObsidian:()=>void=()=>{};
  onSound:(cue:SoundCue,cell?:number,level?:number)=>void=()=>{};
  removePet(){this.petBatch.clear();this.pets.forEach(p=>p.dispose());this.pets=[];}
  private frame = 0;
  private previousTime = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private island: THREE.Group;
  private preview: THREE.Group | null = null;
  private previewKey = "";
  private readonly raycaster = new THREE.Raycaster();
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLElement) {
    this.boat=new BoatView(host);this.scene.add(this.boat.group);
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
    this.scene.add(this.map,this.petBatch.group);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.classList.add('world-canvas');
    host.parentElement!.append(this.renderer.domElement);
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
    if(!this.game?.won&&this.launchObjects.length){for(const {object,position} of this.launchObjects)object.position.copy(position);this.launchObjects=[];this.launchAge=0;}
    this.surface.update(ms/1000,this.reducedMotion.matches);
    this.petBatch.prepare();
    let petsChanged=false;
    if(!this.game?.won)for(const pet of this.pets){
      const revision=pet.motion.revision,busy=pet.motion.busy,hatch=pet.motion.hatchRemaining,charge=pet.motion.leaping,used=pet.motion.abilitiesUsed;pet.update(dt,this.reducedMotion.matches);
      if(used===0&&pet.motion.abilitiesUsed>0&&pet.motion===this.game?.pets[0])this.onFirstPetAbility(pet.motion.element);
      if(hatch>.65&&pet.motion.hatchRemaining<=.65)this.onSound('hatch',pet.motion.cell);
      if(!charge&&pet.motion.leaping)this.onSound('charge',pet.motion.cell);
      if(revision!==pet.motion.revision||busy!==pet.motion.busy)petsChanged=true;
    }
    this.flushPetTiles();

    if(this.game){
      if(this.game.boatDeliveries.length)this.onSound('forge');this.boat.update(this.game,dt,this.reducedMotion.matches);
      for(const object of (this.island.userData.shipScenery??[]) as THREE.Object3D[])object.visible=this.game.boat.count<BOAT_HULL_BRICKS;
      for(const object of (this.island.userData.shipShore??[]) as THREE.Object3D[])object.visible=this.game.boat.count<BOAT_WALL_BRICKS;
      let reframed=false;for(const key of ['x','minZ','maxZ','height'] as const){const delta=this.boat.bounds[key]-this.boatFrame[key];if(Math.abs(delta)>.001){this.boatFrame[key]=this.reducedMotion.matches||Math.abs(delta)<.005?this.boat.bounds[key]:this.boatFrame[key]+delta*(1-Math.exp(-dt*6));reframed=true;}}if(reframed)this.resize();
      if(!this.forges.group.parent)this.scene.add(this.forges.group);this.forges.update(this.game,dt,this.reducedMotion.matches);
      if(!this.game.won&&this.game.updateBushBurnouts(dt))petsChanged=true;
      if(!this.game.won&&this.game.updateBoss(dt))petsChanged=true;
      for(const [id,view] of this.bossViews)if(!this.game.bosses.some(b=>b.id===id)){view.dispose();this.bossViews.delete(id);}
      for(const boss of this.game.bosses){let view=this.bossViews.get(boss.id);if(!view){view=new BossView(this.scene,this.host,(x,y,height)=>this.gridScreen(x,y,height),(cue,cell,level)=>this.onSound(cue,cell,level));this.bossViews.set(boss.id,view);}view.update(this.game,dt,this.reducedMotion.matches,boss);}
    }
    if(this.game){if(!this.bushes.group.parent)this.scene.add(this.bushes.group);this.bushes.update(this.game,time,this.reducedMotion.matches);for(const cell of this.game.berryEaten.splice(0)){this.onSound('berry',cell);if(!this.reducedMotion.matches)this.effects.burst(cell,'bush');}}
    if(this.game)for(const cell of this.game.obsidianEvents.splice(0)){if(this.game.board[cell]!=='obsidian')continue;this.surface.set(cell,'obsidian');this.onObsidian();this.onSound('steam',cell);if(!this.reducedMotion.matches)this.effects.evaporate(cell,'lava');}
    if(this.game?.won){
      if(!this.launchObjects.length){this.launchObjects=[this.boat.group,this.forges.group,this.bushes.group,this.surface.mesh,this.stones,this.map,...this.pets.map(p=>p.group)].map(object=>({object,position:object.position.clone()}));this.onSound('win');}
      this.launchAge+=dt;const t=Math.min(1,this.launchAge/2.4),ease=t*t*(3-2*t);
      for(const {object,position} of this.launchObjects)object.position.copy(position).add(new THREE.Vector3(0,this.reducedMotion.matches?0:Math.sin(t*Math.PI)*.12+ease*.12,this.reducedMotion.matches?0:-ease*1.5));
    }
    this.petBatch.sync(this.pets.map(p=>p.group));
    if(petsChanged)this.onPetChange();
    if (!this.reducedMotion.matches) {
      this.effects.update(dt);
      for(const group of this.stones.children)group.userData.animate?.(time);
      if(this.arrivals.length||this.departures.length)this.renderer.shadowMap.needsUpdate=true;
      this.arrivals=this.arrivals.filter(a=>{a.age+=dt;const t=Math.min(1,a.age/.32);const rise=1-Math.pow(1-t,3);const settle=Math.sin(t*Math.PI)*.12;a.group.scale.set(1-settle*.25,rise+settle,1-settle*.25);return t<1;});
      this.departures=this.departures.filter(a=>{a.age+=dt;const t=Math.min(1,a.age/.18);a.group.position.y=.07-t*t*.5;a.group.scale.setScalar(1-t*t*.55);if(t===1){disposeGroup(a.group);return false;}return true;});
      const update=this.island.userData.animate as ((time:number)=>void)|undefined;
      update?.(time);
    }
    this.render();
  };

  private flushPetTiles(){
    if(this.game)for(const cell of this.game.petTileEvents.splice(0)){
      const tile=this.game.board[cell];if(tile==='water'||tile==='lava')this.addPiece(cell,{tile,shape:{id:'pet-drop',name:'Pet tile',width:1,height:1,cells:[[0,0]]}});
    }
  }
  cellScreen(cell:number,height=.6) {
    return this.gridScreen(cell%SIZE,Math.floor(cell/SIZE),height);
  }
  gridScreen(x:number,y:number,height:number){
    const point=new THREE.Vector3(gridWorld(x),height,gridWorld(y)).project(this.camera);
    const view=this.renderer.domElement.getBoundingClientRect(),board=this.host.getBoundingClientRect();
    return {x:(point.x+1)*view.width/2+view.left-board.left,y:(1-point.y)*view.height/2+view.top-board.top};
  }

  cellAt(clientX: number, clientY: number): number | null {
    const rect = this.host.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const view=this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(
      (clientX - view.left) / view.width * 2 - 1,
      1 - (clientY - view.top) / view.height * 2,
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
      const mesh = createTile(piece.tile==='forge'?(x<cell%8?'lava':x>cell%8?'water':'forge'):piece.tile==='pet'?'stone':piece.tile, preview, valid);
      mesh.position.x = gridWorld(x);
      mesh.position.z = gridWorld(y);
      group.add(mesh);
    }
    return group;
  }

  addStone(cell: number, animate = true) {
    const leafy=this.game?.leafStones.has(cell)??false,fiery=this.game?.fireStones.has(cell)??false;
    if(this.game?.fireStones.has(cell)){this.fireSweeps.add(cell);if(animate&&!this.reducedMotion.matches){this.effects.ashPuff(cell);this.effects.fireCross(cell,false);}}
    const shards=this.game?.shardStones.has(cell)??false;if(shards)this.shardSweeps.add(cell);
    if(animate)this.onSound(shards?'stone':leafy?'leafStone':'stone',cell);
    this.surface.set(cell,fiery?'bush':'stone');
    const group=fiery?charredBush(cell):stoneCluster(cell);
    if(leafy)this.leafSweeps.add(cell);
    if(leafy&&!fiery){for(let i=0;i<9;i++){const leaf=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),new THREE.MeshBasicMaterial({color:shards?(i%2?'#a388c1':'#443452'):(i%2?'#75b565':'#387b48')}));const a=i*2.399;leaf.scale.set(1,.18,.55);leaf.position.set(Math.cos(a)*.48,.36+(i%3)*.08,Math.sin(a)*.48);leaf.rotation.set(.3,a,.4);group.add(leaf);}}
    group.userData.cell=cell;
    this.stones.add(group);
    if(animate&&!fiery&&!this.reducedMotion.matches){group.scale.y=.05;this.arrivals.push({group,age:0});}
    this.renderer.shadowMap.needsUpdate = true;
    if(animate && !this.reducedMotion.matches){if(leafy)this.effects.leaves(cell,false,shards);else this.effects.burst(cell,'stone');}
    if(animate)this.render();
  }

  syncBoard(board: readonly (Tile | null)[], animate = true) {
    const before=[...this.surface.board];
    for (const group of [...this.stones.children]) disposeGroup(group as THREE.Group);
    this.shardSweeps.clear();this.leafSweeps.clear();this.fireSweeps.clear();this.arrivals=[];this.departures.forEach(a=>disposeGroup(a.group));this.departures=[];
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
    const shards=this.shardSweeps.has(origin),leafy=this.leafSweeps.has(origin),fiery=this.fireSweeps.has(origin);
    if(leafy){if(phase==='stone'||cells.length)this.onSound(shards?'stone':'leaves',origin);if(fiery&&phase==='stone')this.onSound('lava',origin);}else if(cells.length)this.onSound(phase==='stone'?'sand':'steam',origin);
    for(const cell of cells){
      const previous=this.surface.board[cell];
      this.surface.set(cell,null);
      for(const group of [...this.stones.children]){
        if(group.userData.cell===cell){this.arrivals=this.arrivals.filter(a=>a.group!==group);if(this.reducedMotion.matches)disposeGroup(group as THREE.Group);else{this.scene.attach(group);this.departures.push({group:group as THREE.Group,age:0});}}
      }
      if(!this.reducedMotion.matches){if(previous==='water'||previous==='lava')this.effects.evaporate(cell,previous);else if(leafy)this.effects.leaves(cell,false,shards);else this.effects.sand(cell);}
    }
    if(phase==='neighbors'){this.fireSweeps.delete(origin);this.surface.finishBurial(origin);if(leafy){this.leafSweeps.delete(origin);if(!this.reducedMotion.matches)for(const c of [origin,...cells])this.effects.leaves(c,false,shards);}this.shardSweeps.delete(origin);}
    if(phase==='stone'&&!this.reducedMotion.matches){if(leafy){this.effects.leaves(origin,true,shards);if(fiery)this.effects.fireCross(origin);}else this.effects.sandWave(origin);}
    this.renderer.shadowMap.needsUpdate=true;
    this.render();
  }

  addPiece(cell: number, piece: Piece) {
    this.onSound(piece.tile==='pet'?'egg':piece.tile==='forge'?'stone':piece.tile,cell);
    if(piece.tile==='forge'){this.surface.set(cell,'forge');if(this.game)this.forges.update(this.game,0,this.reducedMotion.matches);return;}
    if(piece.tile==='pet'){if(this.game?.pet){const pet=new PetWalker(this.game.pet);this.pets.push(pet);this.scene.add(pet.group);}this.render();return;}
    const placed=footprint(piece,cell);
    for(const [x,y] of placed) {
      const index=y*8+x;this.effects.cancelEvaporation(index);this.surface.set(index,piece.tile);
      for(const stone of [...this.stones.children])if(stone.userData.cell===index){this.arrivals=this.arrivals.filter(a=>a.group!==stone);disposeGroup(stone as THREE.Group);}
      if(!this.reducedMotion.matches)this.effects.burst(index,piece.tile,piece.shape.id==='pet-drop');
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
    const { width, height, left:boardLeft, top:boardTop } = this.host.getBoundingClientRect();
    const fullWidth=document.documentElement.clientWidth,fullHeight=window.innerHeight;
    if (!width || !height) return;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(fullWidth, fullHeight, false);
    this.camera.clearViewOffset();
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

    const f=this.boatFrame;
    const corners=[-f.x,f.x].flatMap(x=>[f.minZ,f.maxZ].map(z=>new THREE.Vector3(x,f.height,z)));
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
    // Expand the same fitted camera beyond the playable viewport: the actual
    // ocean continues behind the HUD/tray without shrinking or moving the map.
    this.camera.setViewOffset(width,height,-boardLeft,-boardTop,fullWidth,fullHeight);
    const left=new THREE.Vector3(-8,0,0).project(this.camera);
    const right=new THREE.Vector3(8,0,0).project(this.camera);
    this.pixels.resize(fullWidth,fullHeight,(right.x-left.x)*fullWidth/2);
    this.render();
  }

  dispose() {
    this.boat.dispose();this.forges.dispose();
    this.bushes.dispose();this.bossViews.forEach(view=>view.dispose());this.bossViews.clear();
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
