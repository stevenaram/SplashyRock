import {neighborSource,forgeBasin,emptyForgeBasin} from './neighbor-rules';
import * as T from 'three';
import { SIZE, type Tile } from './game';

export const elementCode = (tile: Tile | null) => tile === 'water' ? 1 : tile === 'lava' ? 2 : tile === 'stone' ? 3 : tile === 'obsidian' ? 4 : 0;
export function exposedEdges(board: readonly (Tile | null)[], cell: number) {
  const x=cell%SIZE,y=Math.floor(cell/SIZE),tile=board[cell];
  return [x===0||board[cell-1]!==tile,x===SIZE-1||board[cell+1]!==tile,y===0||board[cell-SIZE]!==tile,y===SIZE-1||board[cell+SIZE]!==tile];
}

// One world-aligned surface for the entire board: neither UVs nor pool borders
// restart at tile boundaries. Occupancy is still the exact gameplay grid.
export class ConnectedSurface {
  readonly board: (Tile|null)[] = Array(64).fill(null);
  private readonly data = new Uint8Array(8*8*4);
  readonly texture = new T.DataTexture(this.data,8,8,T.RGBAFormat);
  private readonly burying=new Set<number>();
  private cooling=new Float32Array(64);
  private forgeHeat=new Float32Array(64);
  setForgeHeat(cell:number,heat:number){this.forgeHeat[cell]=Math.max(0,Math.min(1,heat));}
  private previousTime: number | null = null;
  private readonly targets=new Uint8Array(128);
  private readonly progress=new Float32Array(128);
  private readonly starts=new Float32Array(128);
  private readonly ages=new Float32Array(128);
  readonly material: T.ShaderMaterial;
  readonly mesh: T.Mesh;
  constructor() {
    this.texture.magFilter=this.texture.minFilter=T.NearestFilter;
    this.material=new T.ShaderMaterial({
      uniforms:{board:{value:this.texture},time:{value:0}},
      vertexShader:`varying vec2 world; void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader:`
        precision highp float; varying vec2 world; uniform sampler2D board; uniform float time;
        float kind(vec2 cell){if(any(lessThan(cell,vec2(0.)))||any(greaterThanEqual(cell,vec2(8.))))return 0.;return floor(texture2D(board,(cell+.5)/8.).r*255.+.5);}
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        void main(){
          vec2 p=floor((world+8.)*32.)/32.;vec2 cell=floor(p/2.);vec2 f=mod(p,2.);float k=kind(cell);
          float left=kind(cell-vec2(1,0)),right=kind(cell+vec2(1,0)),up=kind(cell-vec2(0,1)),down=kind(cell+vec2(0,1));
          if(k<.5){
            // A calm, full-cell sand treatment: no partial shoreline masks.
            vec2 reveal=texture2D(board,(cell+.5)/8.).gb;
            bool wet=reveal.x>.001,hot=reveal.y>.001;
            if(!wet&&!hot)discard;
            // Preserve the map's fine grid while covering the entire interior.
            if(min(min(f.x,2.-f.x),min(f.y,2.-f.y))<.03125)discard;
            // Lava adds only tiny embedded coals. Discard elsewhere so the
            // actual underlying sand, lighting, and texture remain untouched.
            float coal=10.,coalHalo=10.,seed=hash(cell);vec2 emberLocal=vec2(0.);float emberSeed=0.;
            if(hot){
              for(int i=0;i<2;i++){
                float n=float(i);
                vec2 center=i==0?vec2(.55,1.38):vec2(1.42,.52);
                center+=(vec2(hash(cell+n+13.),hash(cell+n+29.))-.5)*.25;
                vec2 d=f-center;
                float angle=hash(cell+n+51.)*6.28;
                d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;
                float size=1.08+hash(cell+n+63.)*.3;
                float arrival=smoothstep(n*.12,1.,reveal.y);
                d/=size*max(.001,arrival);
                // A faceted main ember and two smaller chips form a compact,
                // irregular cluster. Broad faces survive the pixel renderer.
                coalHalo=min(coalHalo,length(d*vec2(.88,1.10))-.285);
                vec2 q=abs(d);
                float mainEmber=max(q.x*.86+q.y*.5,q.y)-.14;
                float chipA=length((d-vec2(.16,.085))*vec2(1.,1.3))-.067;
                float chipB=length((d+vec2(.10,.15))*vec2(1.3,1.))-.052;
                float shape=min(mainEmber,min(chipA,chipB));
                if(shape<coal){coal=shape;emberLocal=d;emberSeed=hash(cell+n+81.);}
              }
            }
            // Small irregular depressions hold shallow water, leaving the
            // original beach visible everywhere between the tidepools.
            float pool=10.;vec2 poolLocal=vec2(0.);
            if(wet){
              for(int i=0;i<2;i++){
                float n=float(i);
                vec2 center=i==0?vec2(.56,.61):vec2(1.39,1.37);
                center+=(vec2(hash(cell+n+4.),hash(cell+n+19.))-.5)*.24;
                vec2 d=f-center;
                float angle=hash(cell+n+71.)*6.28;
                d=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d;
                float arrival=smoothstep(n*.15,1.,reveal.x);
                float radius=((i==0?.25:.18)+hash(cell+n+37.)*.035)*arrival;
                // Broad, asymmetric basins rather than matching oval dots.
                float basin=length(d*vec2(.83,1.22))-radius+sin(d.x*11.+seed*4.)*.024*arrival;
                if(arrival<.02)basin=10.;
                if(basin<pool){pool=basin;poolLocal=d;}
              }
            }
            if(pool>.028&&coalHalo>.025)discard;
            vec3 c=vec3(185.,197.,170.)/255.;
            if(pool<-.015)c=vec3(141.,189.,184.)/255.;
            if(pool<-.095)c=vec3(110.,172.,178.)/255.;
            // A single soft reflection on one side leaves the pool readable
            // as a shallow depression, without a bright ring around every edge.
            float glint=sin(poolLocal.x*13.+time*.55+seed*6.28);
            if(pool<-.045&&poolLocal.y<-.045&&glint>.82)c=vec3(.639,.871,.843);
            if(hot&&coalHalo<.025){
              // A small ochre heat bed grounds the brighter, raised-looking
              // ember facets without outlining them in black.
              c=vec3(210.,185.,130.)/255.;
              if(coalHalo<-.035)c=vec3(217.,180.,125.)/255.;
              if(coal<0.)c=vec3(187.,72.,45.)/255.;
              if(coal<0.&&emberLocal.x+emberLocal.y*.6>-.025)c=vec3(248.,140.,54.)/255.;
              if(coal<-.035&&emberLocal.x+emberLocal.y*.6>.04)c=vec3(255.,185.,87.)/255.;
              float heat=.5+.5*sin(time*1.2+emberSeed*6.28);
              float fissure=abs(emberLocal.x*.7+emberLocal.y+.018*sin(emberLocal.x*32.));
              if(coal<-.018&&(fissure<.013+heat*.007||emberLocal.y<-.085))c=vec3(255.,224.,151.)/255.;
              if(coal<-.028&&fissure<.009)c=vec3(248.,217.,193.)/255.;
            }
            gl_FragColor=vec4(pow((c+.055)/1.055,vec3(2.4)),1.);
            #include <colorspace_fragment>
            return;
          }
          float edge=10.;if(left!=k)edge=min(edge,f.x);if(right!=k)edge=min(edge,2.-f.x);if(up!=k)edge=min(edge,f.y);if(down!=k)edge=min(edge,2.-f.y);
          // A tiny stepped chamfer on exposed corners softens the pool silhouette.
          float corner=10.;if(left!=k&&up!=k)corner=min(corner,f.x+f.y);if(right!=k&&up!=k)corner=min(corner,2.-f.x+f.y);if(left!=k&&down!=k)corner=min(corner,f.x+2.-f.y);if(right!=k&&down!=k)corner=min(corner,4.-f.x-f.y);if(corner<.12)discard;
          vec3 c;
          if(k<1.5){
            float swell=sin(p.x*2.1+p.y*1.3+time*.65)+sin(p.y*3.4-p.x*.6-time*.45);
            c=swell>1.25 ? vec3(.18,.60,.75):vec3(.14,.54,.70);
            float ribbon=sin(p.y*12.+sin(p.x*3.1+time*.5)*1.2-time*1.1);
            if(ribbon>.97&&noise(vec2(p.x*2.,floor(p.y*6.)))>.63)c=vec3(.48,.82,.84);
            if(edge<.16)c=vec3(.23,.70,.77);
            if(edge<.0625)c=vec3(.65,.89,.87);
          }else if(k<2.5){
            float n=noise(p*2.2+vec2(time*.10,-time*.065));
            float crust=noise(p*3.5+noise(p*.7)*2.+vec2(time*.035,0));
            c=crust>.61?vec3(.35,.15,.17):n<.32?vec3(.65,.19,.12):n<.57?vec3(.89,.29,.10):vec3(1.,.48,.13);
            if(abs(n-.48)<.04)c=vec3(1.,.69,.24);
            if(abs(n-.48)<.012)c=vec3(1.,.86,.48);
            float furnace=texture2D(board,(cell+.5)/8.).g;
            c=mix(c,vec3(1.,.56,.16),furnace*.38);
            if(furnace>.01&&abs(n-.48)<.04)c=mix(c,vec3(1.,.95,.70),furnace*.8);
            if(edge<.125)c=vec3(.95,.39,.12);
            if(edge<.0625)c=vec3(1.,.70,.29);
          }else if(k>3.5){
            // World-aligned, unlit volcanic glass; shared edges join into one slab.
            vec2 shard=floor(p*3.);float facet=hash(shard);
            c=facet<.28?vec3(.075,.055,.12):facet<.65?vec3(.14,.10,.21):vec3(.24,.17,.33);
            vec2 grain=fract(p*3.);float seam=min(grain.x,grain.y);
            if(seam<.09)c*=.65;
            if(grain.y>.87&&facet>.55)c=vec3(.39,.29,.51);
            if(hash(floor(p*16.))>.96)c+=vec3(.06,.04,.08);
            if(edge<.125)c=vec3(.29,.21,.40);
            if(edge<.0625)c=vec3(.53,.40,.65);
            float heat=texture2D(board,(cell+.5)/8.).a;
            float crust=smoothstep(heat-.07,heat+.07,noise(p*3.7)*.8+.1);
            c=mix(mix(vec3(.83,.23,.08),vec3(1.,.65,.24),step(.47,noise(p*5.))),c,crust);
          }else{
            c=vec3(.50,.43,.34);if(noise(p*7.)>.72)c=vec3(.61,.52,.40);
            if(edge<.0625)c=vec3(.973,.851,.757);
          }
          gl_FragColor=vec4(pow(c,vec3(2.2)),1.);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new T.Mesh(new T.PlaneGeometry(16,16),this.material);this.mesh.rotation.x=-Math.PI/2;this.mesh.position.y=.065;
  }
  set(cell:number,tile:Tile|null){
    if(tile==='obsidian'&&this.board[cell]!=='obsidian')this.cooling[cell]=1;
    if(tile!=='obsidian')this.cooling[cell]=0;
    if(this.board[cell]==='stone'&&tile===null)this.burying.add(cell);
    if(tile!==null){
      this.burying.delete(cell);
      for(let element=0;element<2;element++){
        const i=cell*2+element;this.targets[i]=0;this.progress[i]=0;this.starts[i]=0;this.ages[i]=0;
        this.data[cell*4+element+1]=0;
      }
    }
    this.board[cell]=tile;this.data[cell*4]=elementCode(tile);this.data[cell*4+3]=tile==='obsidian'?Math.round(this.cooling[cell]*255):255;this.texture.needsUpdate=true;
  }
  finishBurial(cell:number){this.burying.delete(cell);}
  resetInfluences(){
    this.burying.clear();this.forgeHeat.fill(0);this.targets.fill(0);this.progress.fill(0);this.starts.fill(0);this.ages.fill(0);this.previousTime=null;
    for(let cell=0;cell<64;cell++){this.data[cell*4+1]=0;this.data[cell*4+2]=0;}
    this.texture.needsUpdate=true;
  }
  update(time:number,reducedMotion=false){
    const dt=this.previousTime===null?0:Math.max(0,Math.min(.05,time-this.previousTime));
    this.previousTime=time;this.material.uniforms.time.value=reducedMotion?0:time;
    let changed=false;
    for(let cell=0;cell<64;cell++){
      const heat=reducedMotion?0:Math.max(0,this.cooling[cell]-dt/ .65);this.cooling[cell]=heat;const heatByte=this.board[cell]==='obsidian'?Math.round(heat*255):255;if(this.data[cell*4+3]!==heatByte){this.data[cell*4+3]=heatByte;changed=true;}
      const x=cell%8,y=Math.floor(cell/8);
      const neighbors=[x>0?cell-1:-1,x<7?cell+1:-1,y>0?cell-8:-1,y<7?cell+8:-1];
      for(let element=0;element<2;element++){
        const index=cell*2+element;
        const basin=forgeBasin(this.board,cell),kind=element===0?'water':'lava';
        const desired=this.board[cell]===null&&!this.burying.has(cell)&&(basin?emptyForgeBasin(this.board,cell,kind):neighbors.some(n=>neighborSource(this.board,n,kind)))?1:0;
        if(desired!==this.targets[index]){
          this.targets[index]=desired;this.starts[index]=this.progress[index];
          // A small spatial stagger leads into, rather than delaying, stone's 500ms reaction.
          this.ages[index]=desired?-((cell*17+element*11)%4)*.025:0;
        }
        this.ages[index]+=dt;
        const t=Math.max(0,Math.min(1,this.ages[index]/(desired?.30:.18)));
        const eased=1-Math.pow(1-t,3);
        this.progress[index]=reducedMotion||this.board[cell]!==null||(basin&&!desired)?desired:this.starts[index]+(desired-this.starts[index])*eased;
        const value=element===0&&this.board[cell]==='lava'&&forgeBasin(this.board,cell)?Math.max(.3,this.forgeHeat[cell]):this.progress[index];
        const byte=Math.round(value*255),offset=cell*4+element+1;
        if(this.data[offset]!==byte){this.data[offset]=byte;changed=true;}
      }
    }
    if(changed)this.texture.needsUpdate=true;
  }
}
