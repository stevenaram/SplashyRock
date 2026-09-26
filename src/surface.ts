import * as T from 'three';
import { SIZE, type Tile } from './game';

export const elementCode = (tile: Tile | null) => tile === 'water' ? 1 : tile === 'lava' ? 2 : tile === 'stone' ? 3 : 0;
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
            // Only orthogonal occupied neighbors influence playable sand. The
            // irregular contour flows out from their shared edge, at 32px/unit.
            float wet=10.,hot=10.;
            if(left==1.)wet=min(wet,f.x);if(right==1.)wet=min(wet,2.-f.x);if(up==1.)wet=min(wet,f.y);if(down==1.)wet=min(wet,2.-f.y);
            if(left==2.)hot=min(hot,f.x);if(right==2.)hot=min(hot,2.-f.x);if(up==2.)hot=min(hot,f.y);if(down==2.)hot=min(hot,2.-f.y);
            if(min(wet,hot)>3.)discard;
            // Leave the physical grid exposed, including the outer board edge.
            if(min(min(f.x,2.-f.x),min(f.y,2.-f.y))<.03125)discard;
            float grain=hash(floor(p*32.));
            float contour=(noise(p*3.)-.5)*.27;
            float w=1.-smoothstep(.12,1.9,wet+contour);
            float h=1.-smoothstep(.12,1.9,hot-contour);
            if(max(w,h)<.04)discard;
            vec3 sand=vec3(.824,.725,.510);
            vec3 damp=wet<.18?vec3(.30,.49,.48):w>.55?vec3(.48,.55,.50):w>.3?vec3(.61,.62,.51):vec3(.70,.65,.48);
            vec3 heated=hot<.18?vec3(.89,.44,.20):h>.55?vec3(.76,.53,.32):h>.3?vec3(.80,.64,.41):vec3(.80,.69,.46);
            vec3 c=sand;
            if(w>.05)c=mix(sand,damp,min(1.,w*2.));
            if(h>.05)c=mix(c,heated,min(1.,h*1.7));
            // Fine shoreline ribbons and scattered glowing fissures; never a
            // solid pool or tile outline, so this still reads as empty sand.
            float tide=.24+sin(time*.9+p.x*1.8+p.y*1.3)*.055;
            if(abs(wet+contour-tide)<.032&&noise(p*5.)>.48)c=vec3(.64,.77,.67);
            float crack=abs(noise(p*6.)-.5);
            if(h>.3&&crack<.026&&noise(p*2.)>.47)c=sin(time*1.2+p.x+p.y)>.2?vec3(1.,.72,.35):vec3(.90,.53,.22);
            // Where both influences meet, pale mineral flecks mark the future
            // reaction without showing a rock before the gameplay delay.
            if(wet<3.&&hot<3.){
              float seam=abs(wet-hot+contour*2.);
              if(seam<.23&&grain>.68)c=vec3(.973,.851,.757);
              else if(seam<.38&&grain>.86)c=vec3(.65,.67,.57);
            }
            if(grain>.965)c=mix(c,vec3(.94,.84,.65),.4);
            gl_FragColor=vec4(pow(c,vec3(2.2)),1.);
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
            if(edge<.125)c=vec3(.95,.39,.12);
            if(edge<.0625)c=vec3(1.,.70,.29);
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
  set(cell:number,tile:Tile|null){this.board[cell]=tile;this.data[cell*4]=elementCode(tile);this.data[cell*4+3]=255;this.texture.needsUpdate=true;}
  update(time:number){this.material.uniforms.time.value=time;}
}
