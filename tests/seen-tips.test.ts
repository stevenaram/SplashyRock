import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SeenTips} from '../src/seen-tips';

test('tips persist independently across new sessions',()=>{
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  const first=new SeenTips(storage);
  assert.equal(first.has('intro'),false);
  first.mark('intro');first.mark('blocked-shape');first.mark('egg-drag');first.mark('obsidian');
  const next=new SeenTips(storage);
  assert.equal(next.has('intro'),true);assert.equal(next.has('egg-drag'),true);
  assert.equal(next.has('blocked-shape'),true);assert.equal(next.has('obsidian'),true);
  assert.equal(next.has('pet-ability'),false);
  next.mark('pet-ability');
  assert.equal(first.has('pet-ability'),true);
});
test('unavailable storage keeps once-only behavior in the current session',()=>{
  const tips=new SeenTips({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(tips.has('egg-goal'),false);
  tips.mark('egg-goal');
  assert.equal(tips.has('egg-goal'),true);
});

test('obsidian is shared across sandbox and normal sessions without saving other sandbox tips',()=>{
 const data=new Map<string,string>();
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 const sandbox=()=>new SeenTips(storage,id=>id==='obsidian');
 const first=sandbox();assert.equal(first.has('obsidian'),false);
 first.mark('obsidian');first.mark('intro');
 assert.equal(first.has('obsidian'),true);
 assert.equal(sandbox().has('obsidian'),true);
 const normal=new SeenTips(storage);assert.equal(normal.has('obsidian'),true);assert.equal(normal.has('intro'),false);
});
test('combined forge explanation suppresses both individual tips across reloads',()=>{
 const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 const tips=new SeenTips(storage);tips.mark('forge-both');
 for(const session of [tips,new SeenTips(storage)])for(const id of ['forge-both','forge-lava','forge-water'] as const)assert.equal(session.has(id),true);
});
test('individual forge tips suppress the combined version but allow the other input once',()=>{
 for(const first of ['forge-lava','forge-water'] as const){
  const tips=new SeenTips(),other=first==='forge-lava'?'forge-water':'forge-lava';
  tips.mark(first);assert.equal(tips.has('forge-both'),true);assert.equal(tips.has(first),true);assert.equal(tips.has(other),false);
  tips.mark(other);assert.equal(tips.has(other),true);
 }
});
