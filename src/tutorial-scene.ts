import * as T from 'three';
import {ConnectedSurface} from './surface';
import {Effects} from './effects';
import {sandTexture,stoneCluster} from './island';
import {PixelRenderer} from './pixel-renderer';

// Shares the game's rocks, liquid shaders and clearing effects; no game state.
export class TutorialScene {
  private renderer=new T.WebGLRenderer({antialias:false});
  private pixels=new PixelRenderer();
  private scene=new T.Scene();
  private camera=new T.PerspectiveCamera(34,1,.1,100);
  private surface=new ConnectedSurface();
  private effects=new Effects();
  private rock:T.Group|null=null;
  private texture=sandTexture(16);
  private observer:ResizeObserver;
  private frame=0;
  private previous=0;
  private time=0;
  private stage=0;
  private active=false;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private readonly center=36;
  private readonly neighbors=[35,28,44,37];
  constructor(private host:HTMLElement,private onPhase:(phase:number)=>void){
    this.renderer.domElement.setAttribute('aria-hidden','true');host.append(this.renderer.domElement);
    this.scene.background=new T.Color('#17465a');
    this.scene.add(new T.HemisphereLight('#fff6da','#538b94',1.45));
    const sun=new T.DirectionalLight('#fff3d6',1.65);sun.position.set(-12,22,-9);this.scene.add(sun);
    const sand=new T.Mesh(new T.PlaneGeometry(16,16),new T.MeshBasicMaterial({map:this.texture}));sand.rotation.x=-Math.PI/2;sand.position.set(0,-.015,0);this.scene.add(sand);
    const vertices:number[]=[];for(let i=0;i<=8;i++){const n=-8+i*2;vertices.push(n,.005,-8,n,.005,8,-8,.005,n,8,.005,n);}
    this.scene.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3)),new T.LineBasicMaterial({color:'#ad955f',transparent:true,opacity:.65})));
    this.scene.add(this.surface.mesh,this.effects.group);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
  }
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.position.set(1,14,9);this.camera.lookAt(1,0,1);this.camera.zoom=Math.min(w/h,1)*1.45;this.camera.updateProjectionMatrix();this.pixels.resize(w,h,Math.min(w,h));}
  private removeRock(){if(!this.rock)return;this.rock.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.rock.removeFromParent();this.rock=null;}
  private reset(){this.effects.clear();this.removeRock();for(let i=0;i<64;i++)this.surface.set(i,null);for(const c of [35,28,44])this.surface.set(c,'water');for(const c of [29,45])this.surface.set(c,'lava');this.surface.resetInfluences();this.stage=0;this.time=0;this.onPhase(0);}
  private advance(){
    if(this.stage===0){this.surface.set(37,'lava');this.effects.burst(37,'lava');}
    if(this.stage===1){this.surface.set(this.center,'stone');this.rock=stoneCluster(this.center);this.scene.add(this.rock);this.effects.burst(this.center,'stone');this.onPhase(1);}
    if(this.stage===2){this.surface.set(this.center,null);this.effects.sand(this.center);this.effects.sandWave(this.center);this.onPhase(2);}
    if(this.stage===3){for(const c of this.neighbors){const tile=this.surface.board[c];this.surface.set(c,null);if(tile==='water'||tile==='lava')this.effects.evaporate(c,tile);}this.surface.finishBurial(this.center);}
    this.stage++;
  }
  show(phase=0){this.stop();this.active=true;this.reset();if(phase>0){this.advance();this.advance();this.time=1.2;}if(phase===2){this.advance();this.time=1.7;}this.resize();this.previous=performance.now();this.frame=requestAnimationFrame(this.tick);}
  stop(){this.active=false;cancelAnimationFrame(this.frame);}
  private tick=(now:number)=>{
    if(!this.active)return;this.frame=requestAnimationFrame(this.tick);if(now-this.previous<1000/30)return;
    const dt=Math.min(.05,(now-this.previous)/1000)*.7;this.previous=now;if(document.hidden)return;
    this.time+=dt;
    const thresholds=[.7,1.2,1.7,1.98];while(this.stage<4&&this.time>=thresholds[this.stage])this.advance();
    if(this.rock){if(this.stage===2){const p=Math.min(1,(this.time-1.2)/.32);this.rock.scale.y=1-Math.pow(1-p,3)+Math.sin(p*Math.PI)*.12;}else if(this.stage>=3){const p=Math.min(1,(this.time-1.7)/.18);this.rock.position.y=.07-p*p*.5;this.rock.scale.setScalar(1-p*p*.55);if(p===1)this.removeRock();}}
    this.surface.update(now/1000,this.reduced.matches);this.effects.update(dt);
    this.pixels.render(this.renderer,this.scene,this.camera);
    if(this.time>5.2)this.reset();
  };
  dispose(){this.stop();this.observer.disconnect();this.removeRock();this.effects.dispose();this.surface.texture.dispose();this.texture.dispose();this.scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});this.pixels.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
