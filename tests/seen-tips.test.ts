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
