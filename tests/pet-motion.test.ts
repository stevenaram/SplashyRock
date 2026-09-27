import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PetMotion} from '../src/pet-motion';
import {Game,type Tile} from '../src/game';
import {SHAPES} from '../src/shapes';
const single=SHAPES.find(s=>s.id==='single')!;
const board=()=>Array<Tile|null>(64).fill(null);
test('movement is linear, continuous across tile boundaries, and stops after exactly three steps',()=>{
 const b=board(),arrivals:number[]=[];const p=new PetMotion(0,'lava',b,c=>arrivals.push(c),()=>0);
 p.addMove();p.update(.2);const x=p.x;p.update(.2);assert.ok(Math.abs(p.x-2*x)<1e-8);
 p.update(3*2/1.7-.4);assert.equal(p.completed,3);assert.equal(p.queued,0);assert.equal(arrivals.length,1);
 const position=[p.x,p.y];p.update(100);assert.deepEqual([p.x,p.y],position);
});
test('moves queue during travel and each three-step sequence earns one footprint',()=>{
 let marks=0;const p=new PetMotion(0,'water',board(),()=>marks++,()=>0);p.addMove();p.update(.5);p.addMove();p.addMove();p.update(30);
 assert.equal(p.completed,9);assert.equal(marks,3);assert.equal(p.queued,0);
});
for(const element of ['water','lava'] as const)test(`${element} crosses its own tiles, avoids the opposite element and diagonal corner cuts`,()=>{
 const b=board();b[1]=element==='lava'?'water':'lava';b[8]=element;const p=new PetMotion(0,element,b,()=>{},()=>0);p.addMove();p.update(.1);assert.equal(p.next,8);
 p.update(2);assert.notEqual(p.cell,1);
});
test('blocked pet keeps queued steps and resumes when a route becomes available',()=>{
 const b=Array<Tile|null>(64).fill('water');b[0]=null;const p=new PetMotion(0,'lava',b,()=>{},()=>0);p.addMove();p.update(50);
 assert.equal(p.busy,false);assert.equal(p.queued,3);assert.equal(p.completed,0);
 b[1]=null;p.update(10);assert.equal(p.completed,3);
});
test('new opposing tile during travel causes a linear retreat without spending the step',()=>{
 const b=board(),p=new PetMotion(0,'lava',b,()=>{},()=>0);p.addMove();p.update(.4);assert.equal(p.next,1);const x=p.x;b[1]='water';p.update(.2);
 assert.ok(Math.abs(p.x-x/2)<1e-8);assert.equal(p.completed,0);p.update(.3);assert.equal(p.next,8);assert.equal(p.queued,3);
});
test('all wandering remains within the grid and can use diagonals',()=>{
 let r=0;const p=new PetMotion(0,'water',board(),()=>{},()=>{r=(r+.373)%1;return r;});let diagonal=false;
 for(let i=0;i<2000;i++){if(i%10===0)p.addMove();p.update(.1);assert.ok(p.x>=0&&p.x<=7&&p.y>=0&&p.y<=7);if(p.next!==null&&p.next%8!==p.cell%8&&Math.floor(p.next/8)!==Math.floor(p.cell/8))diagonal=true;}assert.ok(diagonal);
});
test('pet paw combines only with opposite orthogonal influence and is consumed by stone',()=>{
 for(const element of ['water','lava'] as const){const g=new Game();g.board[28]=element==='lava'?'water':'lava';assert.ok(g.leavePetMark(27,element));assert.ok(g.canFormStone(27));assert.ok(g.formStone(27));assert.equal(g.petMarks[27],null);assert.equal(g.board[27],'stone');}
 const g=new Game();g.board[36]='water';g.leavePetMark(27,'lava');assert.equal(g.canFormStone(27),false);
});
test('marks skip occupied cells, same-element neighbors, and existing marks',()=>{
 const g=new Game();g.board[0]='water';assert.equal(g.leavePetMark(0,'lava'),false);assert.equal(g.leavePetMark(1,'water'),false);assert.ok(g.leavePetMark(20,'water'));assert.equal(g.leavePetMark(20,'lava'),false);
});
test('marks expire after three successful placements, never from time or rejected placement',()=>{
 const g=new Game();g.leavePetMark(27,'lava');g.inventory=[{tile:'water',shape:single},null,null];g.place(0,-1);assert.ok(g.petMarks[27]);
 for(let i=0;i<3;i++){g.inventory=[{tile:'water',shape:single},null,null];g.place(0,i);assert.equal(!!g.petMarks[27],i<2);}
});
test('clearing and covering a marked cell remove its influence; replay removes queue and marks',()=>{
 const g=new Game();g.leavePetMark(27,'lava');g.clearCells([27]);assert.equal(g.petMarks[27],null);g.leavePetMark(27,'lava');g.inventory=[{tile:'water',shape:single},null,null];g.place(0,27);assert.equal(g.petMarks[27],null);
 g.inventory=[{tile:'pet',petElement:'water',shape:single},null,null];g.place(0,20);assert.equal(g.pet?.queued,3);assert.equal(g.pet?.element,'water');g.leavePetMark(19,'water');g.restart();assert.equal(g.pet,null);assert.ok(g.petMarks.every(m=>!m));
});
test('random rewards include both named pet types, in the middle slot',()=>{
 const seen=new Set();for(const random of [()=>.2,()=>.8]){const g=new Game(random);g.score=5000;g.inventory=[{tile:'water',shape:single},null,null];g.place(0,0);const p=g.inventory[1]!;seen.add(p.petElement);assert.equal(p.shape.name,p.petElement==='lava'?'Lava Pet':'Water Pet');}assert.deepEqual(seen,new Set(['lava','water']));
});

test('a blocked inventory waits for usable pet steps but not a trapped pet',()=>{
 const g=new Game();g.inventory=[{tile:'lava',shape:single}];g.board.fill('lava');g.pet=new PetMotion(0,'lava',g.board,()=>{},()=>0);g.pet.addMove();assert.equal(g.finishIfBlocked(false),false);g.pet.update(10);assert.equal(g.finishIfBlocked(false),true);
 g.over=false;g.board.fill('water');g.pet=new PetMotion(0,'lava',g.board,()=>{},()=>0);g.pet.addMove();assert.equal(g.finishIfBlocked(false),true);
});
