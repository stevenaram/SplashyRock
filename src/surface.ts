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
            // A calm, full-cell sand treatment: no partial shoreline masks.
            bool wet=left==1.||right==1.||up==1.||down==1.;
            bool hot=left==2.||right==2.||up==2.||down==2.;
            if(!wet&&!hot)discard;
            // Preserve the map's fine grid while covering the entire interior.
            if(min(min(f.x,2.-f.x),min(f.y,2.-f.y))<.03125)discard;
            // Directional shoreline profiles. Each shared source edge sends a
            // rounded wash into the cell; adjacent sources join into coves.
            float wd=10.,hd=10.;
            float tide=sin(time*.65)*.035;
            float waveX=sin(p.x*3.6+sin(p.x*1.3))*.12+sin(p.x*7.2)*.035;
            float waveY=sin(p.y*3.6+sin(p.y*1.3))*.12+sin(p.y*7.2)*.035;
            if(left==1.)wd=min(wd,f.x+waveY+tide);if(right==1.)wd=min(wd,2.-f.x-waveY+tide);if(up==1.)wd=min(wd,f.y+waveX+tide);if(down==1.)wd=min(wd,2.-f.y-waveX+tide);
            if(left==2.)hd=min(hd,f.x+waveY*.7);if(right==2.)hd=min(hd,2.-f.x-waveY*.7);if(up==2.)hd=min(hd,f.y+waveX*.7);if(down==2.)hd=min(hd,2.-f.y-waveX*.7);
            vec3 damp=vec3(.682,.737,.667),dampLight=vec3(.765,.773,.635);
            vec3 warm=vec3(.800,.690,.510),warmLight=vec3(.867,.753,.569);
            vec3 mineral=vec3(.780,.737,.627),mineralLight=vec3(.859,.816,.690);
            // The far side stays lightly conditioned sand. The shallow wash
            // curves out of its source instead of running in arbitrary stripes.
            vec3 c=wet?dampLight:warmLight;
            if(wet&&hot)c=mineralLight;
            if(wd<1.45)c=dampLight;
            if(hd<1.45)c=warmLight;
            if(wd<.8&&wd<hd)c=damp;
            if(hd<.8&&hd<wd)c=warm;
            // A narrow translucent-looking water lip and softly scalloped foam
            // make the source direction readable even at phone scale.
            if(wd<.24&&wd<hd)c=vec3(.45,.79,.81);
            if(wd>.20&&wd<.27&&wd<hd)c=vec3(.64,.87,.84);
            // Lava singes only its immediate rim; the rest stays sandy and free.
            if(hd<.12&&hd<wd)c=vec3(.64,.54,.38);
            if(hd<.055&&hd<wd)c=vec3(.88,.68,.38);
            // Broad mineral clouds soften mixed influence without a diagonal
            // divider, arrow, or drawn symbol across the playable square.
            if(wet&&hot&&wd>.35&&hd>.35){
              float mineralCloud=noise(p*2.2);
              if(abs(wd-hd)<.6+mineralCloud*.35)c=mineral;
              if(abs(wd-hd)<.22&&mineralCloud>.55)c=mineralLight;
            }
            // Very sparse paired sand grains, anchored to world pixels.
            vec2 grain=floor(p*16.);
            if(hash(grain)>.997&&min(wd,hd)>.4)c=wet&&hot?mineralLight:wet?dampLight:warmLight;
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
