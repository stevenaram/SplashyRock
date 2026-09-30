import * as T from 'three';
/** Two widening foam ribbons trail astern; the ocean scrolls beneath them. */
export function createShipWake(){
 const position:number[]=[],uv:number[]=[];
 for(const side of [-1,1])for(let i=0;i<32;i++){
  const vertex=(v:number,u:number)=>[side*(4.5+v*5)+(u-.5)*(.4+v*1.8),-.64,10.7+v*12];
  const a=i/32,b=(i+1)/32;
  for(const [v,u] of [[a,0],[b,0],[b,1],[a,0],[b,1],[a,1]]){position.push(...vertex(v,u));uv.push(u,v);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{age:{value:0}},vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`precision highp float;varying vec2 q;uniform float age;void main(){vec2 p=floor(q*vec2(12.,120.))/vec2(12.,120.);float ripple=sin(p.y*88.-age*5.+p.x*6.);float rim=pow(max(0.,1.-abs(p.x-.5)*2.),.7);float foam=smoothstep(.25,.82,ripple)*rim*(1.-p.y)*min(age/3.,1.);gl_FragColor=vec4(.60,.85,.85,foam*.56);}`});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;return mesh;
}
