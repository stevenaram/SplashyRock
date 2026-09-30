import * as T from 'three';
import {createPetModel} from './pet';
import type {Element} from './game';
const portraits=new Map<Element,T.CanvasTexture>();
// Bake the actual painted game model once per element, not once per tile/frame.
export function petPortrait(element:Element){
 const existing=portraits.get(element);if(existing)return existing;
 const renderer=new T.WebGLRenderer({alpha:true,antialias:false});renderer.setSize(64,64);renderer.setPixelRatio(1);
 const scene=new T.Scene(),pet=createPetModel(element);scene.add(pet.root);
 const camera=new T.OrthographicCamera(-.85,.85,.85,-.85,.1,20);camera.position.set(.4,1.4,-4);camera.lookAt(0,.66,-.2);
 renderer.render(scene,camera);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;canvas.getContext('2d')!.drawImage(renderer.domElement,0,0);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();pet.root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);materials.add(o.material as T.Material);}});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());pet.textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();
 portraits.set(element,texture);return texture;
}
