import * as T from 'three';

// Pixelated geometry, shadows and particles as well as pixel textures. All
// output is remapped to this small art palette (no smooth shaded gradients).
const palette=['#103447','#17465a','#205b70','#26758b','#248ab2','#2d9ac0','#4aaec8','#72c9cf','#a3ded7','#d4eee0',
'#263e36','#365849','#4c7855','#70955d','#a3b573',
'#655347','#876e53','#a38a60','#bca471','#d2b982','#e4cc98','#f0dfb1','#f8d9c1',
'#54333a','#893a32','#bb482d','#e5632c','#f88c36','#ffb957','#ffe097',
'#b9c5aa','#8dbdb8','#6eacb2','#d9b47d','#e6a35f','#ffd28b',
'#555c60','#788080','#a6aaa0','#d4d1b6',
'#130e1f','#241a36','#3d2b54','#644a82','#8870a6'];
export class PixelRenderer {
  private readonly target=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
  private readonly scene=new T.Scene();
  private readonly camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  private readonly material=new T.ShaderMaterial({
    uniforms:{image:{value:this.target.texture},palette:{value:palette.map(hex=>new T.Color(hex))}},
    vertexShader:'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec3 palette[${palette.length}];
    void main(){vec3 c=texture2D(image,vUv).rgb;float best=100.;vec3 chosen=c;for(int i=0;i<${palette.length};i++){vec3 d=c-palette[i];float distance=dot(d*d,vec3(.27,.53,.20));// Reserve the six subtle influence colors for their exact shader output;
    // nearby scenery shades must retain the original island palette.
    if(i>=30&&i<36&&distance>.00002)continue;
    if(distance<best){best=distance;chosen=palette[i];}}gl_FragColor=vec4(chosen,1.);
    #include <colorspace_fragment>
    }`,
    depthTest:false,depthWrite:false,
  });
  constructor(){this.scene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));}
  resize(width:number,height:number,boardWidth:number){
    // 16 world units across the board -> 512 logical pixels, capped by display.
    const scale=Math.min(1,512/boardWidth);
    this.target.setSize(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));
  }
  render(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){renderer.setRenderTarget(this.target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(this.scene,this.camera);}
  dispose(){this.target.dispose();this.material.dispose();(this.scene.children[0] as T.Mesh).geometry.dispose();}
}
