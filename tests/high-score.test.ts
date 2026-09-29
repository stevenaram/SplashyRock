import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HighScore} from '../src/high-score';
test('best persists immediately, survives reload and cannot decrease across runs or tabs',()=>{
 let saved:string|null=null;const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value;}};
 const a=new HighScore(storage),b=new HighScore(storage);
 a.record(12345);assert.equal(new HighScore(storage).value,12345);
 b.record(100);assert.equal(saved,'12345');a.record(0);assert.equal(a.value,12345);
 b.record(20000);assert.equal(a.refresh(),20000);
});
test('invalid saved scores and unavailable storage do not break a run; sandbox stays in memory',()=>{
 const broken=new HighScore({getItem:()=>{throw Error();},setItem:()=>{throw Error();}});assert.equal(broken.record(300),300);
 const invalid=new HighScore({getItem:()=> 'Infinity',setItem:()=>{}});assert.equal(invalid.value,0);assert.equal(invalid.record(NaN),0);
 const sandbox=new HighScore();sandbox.record(500);assert.equal(sandbox.value,500);assert.equal(new HighScore().value,0);
});
