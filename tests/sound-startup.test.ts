import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoundEngine} from '../src/sound';
test('mobile tap completion retries interrupted audio while mute remains respected',()=>{
 const win=new EventTarget(),doc=Object.assign(new EventTarget(),{hidden:false});
 const originals=['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 Object.defineProperty(globalThis,'window',{value:win,configurable:true});Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
 let resumes=0;const context={createBufferSource:()=>({buffer:null,connect:()=>{},disconnect:()=>{},start:()=>{}}),createBuffer:()=>({}),sampleRate:44100,destination:{},state:'interrupted',resume:()=>{resumes++;return Promise.resolve();},close:()=>Promise.resolve(),suspend:()=>Promise.resolve()};
 const sound=new SoundEngine();
 try {
  Object.assign(sound,{context});
  win.dispatchEvent(new Event('touchend'));assert.equal(resumes,1);
  win.dispatchEvent(new Event('pointerup'));assert.equal(resumes,2);
  win.dispatchEvent(new Event('click'));assert.equal(resumes,3);
  doc.dispatchEvent(new Event('visibilitychange'));assert.equal(resumes,4);
  sound.muted=true;win.dispatchEvent(new Event('touchend'));assert.equal(resumes,4);
  sound.muted=false;context.state='running';win.dispatchEvent(new Event('click'));assert.equal(resumes,4);
  sound.dispose();context.state='interrupted';win.dispatchEvent(new Event('touchend'));assert.equal(resumes,4);
 } finally {sound.dispose();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
