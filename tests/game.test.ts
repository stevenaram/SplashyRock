import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, footprint, type Piece } from '../src/game';
import { SHAPES } from '../src/shapes';
const piece = (id: string, tile: Piece['tile'] = 'water'): Piece => ({shape: SHAPES.find(shape => shape.id === id)!, tile});
const pattern = (p: Piece) => Array.from({length:p.shape.height}, (_, y) =>
  Array.from({length:p.shape.width}, (_, x) => p.shape.cells.some(([cx, cy]) => cx === x && cy === y) ? '1' : '0').join('')).join('/');

test('every replacement drawing is represented with no old extra shapes', () => {
  const reference = [
    '0010/0111/1110/0100', '0100/1110/0111/0010',
    '110/111/011', '011/111/110', '011/111/110', '110/111/011',
    '10/11', '11/01', '11/10', '01/11', '1', '111/111/111',
    '011/110/100', '110/011/001', '010/111/111/010',
    '010/111/010', '1/1/1', '001/011/110', '111', '100/110/011',
    '11/10/11', '11/01/11', '111/101', '0110/1111/0110', '101/111',
  ];
  const actual = SHAPES.map(shape => pattern({shape, tile:'water'}));
  assert.deepEqual(new Set(actual), new Set(reference));
  assert.equal(actual.length, 23);
  assert.equal(new Set(actual).size, actual.length);
});

test('every shape can be dealt in either element and every tray has a 2:1 mix', () => {
  SHAPES.forEach((shape, index) => {
    for (const majority of [.1, .9]) for (const slot of [0,1,2]) {
      const values = [majority, (slot + .5)/3, ...Array(3).fill((index+.5)/SHAPES.length)];
      const game = new Game(() => values.shift()??.1);
      // Only the third and subsequent hands draw from the full shape pool.
      const refill=()=>{game.board.fill(null);game.board[1]='lava';game.inventory=[piece('single'),null,null];game.place(0,0);game.board.fill(null);};
      refill();values.splice(0,values.length,majority,(slot+.5)/3,...Array(3).fill((index+.5)/SHAPES.length));refill();
      assert.ok(game.inventory.every(p => p?.shape === shape));
      const water = game.inventory.filter(p => p?.tile === 'water').length;
      assert.equal(water, majority < .5 ? 2 : 1);
      assert.equal(game.inventory[slot]?.tile, majority < .5 ? 'lava' : 'water');
    }
  });
});

test('refills only after all three pieces are used; rejects reuse and overlap', () => {
  let calls = 0;
  const game = new Game(() => { calls++; return 0; });
  game.inventory = [piece('single'), piece('single', 'lava'), piece('single')];
  assert.equal(game.place(1, 12), true);
  assert.equal(game.inventory[1], null);
  assert.equal(game.place(1, 13), false);
  assert.equal(game.place(0, 12), false);
  assert.equal(game.place(0, 0), true);
  assert.equal(calls, 5);
  assert.equal(game.place(2, 63), true);
  assert.equal(calls, 10);
  assert.equal(game.inventory.filter(Boolean).length, 3);
  assert.equal(game.board[12], 'lava');
});

test('all shapes place exactly their cells, and collision at any cell is atomic', () => {
  for (const shape of SHAPES) {
    const p: Piece = {shape, tile:'lava'};
    const cells = footprint(p, 27).map(([x,y]) => y * 8 + x);
    const game = new Game();
    game.inventory[0] = p;
    assert.equal(game.place(0, 27), true);
    assert.deepEqual(game.board.flatMap((tile, i) => tile ? [i] : []), [...cells].sort((a,b) => a-b));
    for (const cell of cells) {
      const blocked = new Game();
      blocked.inventory[0] = p;
      blocked.board[cell] = 'water';
      const before = [...blocked.board];
      assert.equal(blocked.place(0, 27), false);
      assert.deepEqual(blocked.board, before);
      assert.equal(blocked.inventory[0], p);
    }
  }
});

test('bounds never wrap to adjacent rows, and holes may straddle occupied cells', () => {
  const game = new Game();
  for (const shape of SHAPES) {
    const p: Piece = {shape, tile:'water'};
    for (let anchor = 0; anchor < 64; anchor++) {
      const expected = footprint(p, anchor).every(([x,y]) => x >= 0 && x < 8 && y >= 0 && y < 8);
      assert.equal(game.canPlace(p, anchor), expected, `${shape.id} at ${anchor}`);
    }
    for (const cell of [-1, 64, 1.5, NaN]) assert.equal(game.canPlace(p, cell), false);
  }
  const cup = piece('cup-up');
  game.inventory[0] = cup;
  // Anchor 27: cup occupies x=2..4, y=2..3; hole at (3,2).
  game.board[19] = 'lava';
  assert.equal(game.place(0, 27), true);
  assert.equal(game.board[19], 'lava');
});

for (const element of ['water','lava'] as const) for (const axis of ['row','column']) {
  test(`full ${element} ${axis} has no clearing, conversion, or score bonus`, () => {
    const game=new Game(),line=Array.from({length:8},(_,i)=>axis==='row'?16+i:i*8+2);
    for(const cell of line.slice(0,7))game.board[cell]=element;
    game.board[63]=element==='water'?'lava':'water';game.board[62]='stone';
    const before=[...game.board];game.inventory[0]=piece('single',element);
    assert.equal(game.place(0,line[7]),true);before[line[7]]=element;
    assert.deepEqual(game.board,before);assert.equal(game.score,1);assert.equal(game.boardRevision,0);
  });
}
for (const axis of ['row','column']) {
  test(`completing a stone ${axis} has no special line effect`,()=>{
    const game=new Game(),line=Array.from({length:8},(_,i)=>axis==='row'?24+i:i*8+3),gap=line[3];
    line.forEach(cell=>{if(cell!==gap)game.board[cell]='stone';});
    game.board[axis==='row'?gap-8:gap-1]='water';game.board[axis==='row'?gap+8:gap+1]='lava';
    const before=[...game.board];assert.equal(game.formStone(gap),true);before[gap]='stone';
    assert.deepEqual(game.board,before);assert.equal(game.score,20);
  });
}

test('opening hands ramp from singles to threes to unrestricted shapes, and reset on replay',()=>{
 for(const random of [()=>0,()=>.49,()=>.99]){
  const g=new Game(random);
  const sizes=()=>g.inventory.map(p=>p!.shape.cells.length);
  const next=()=>{g.board.fill(null);g.inventory=[piece('single'),null,null];g.place(0,0);g.board.fill(null);};
  assert.deepEqual(sizes(),[1,1,3]);assert.notEqual(g.inventory[0]!.tile,g.inventory[1]!.tile);
  next();assert.deepEqual(sizes().slice(0,2),[3,3]);assert.ok(sizes()[2]>3);
  next();assert.ok(g.inventory.every(p=>p!.shape===SHAPES[Math.floor(random()*SHAPES.length)]));
  g.restart();assert.deepEqual(sizes(),[1,1,3]);next();assert.deepEqual(sizes().slice(0,2),[3,3]);assert.ok(sizes()[2]>3);
 }
});

test('returning players use the full shape pool immediately and preserve mixed elements',()=>{
 for(let i=0;i<SHAPES.length;i++){
  const value=(i+.5)/SHAPES.length;
  const g=new Game(()=>value,()=>true);
  for(let run=0;run<2;run++){
   assert.ok(g.inventory.every(p=>p!.shape===SHAPES[i]));
   assert.equal(new Set(g.inventory.map(p=>p!.tile)).size,2);
   g.board.fill(null);g.inventory=[piece('single'),null,null];g.place(0,0);
   assert.ok(g.inventory.every(p=>p!.shape===SHAPES[i]));
   g.restart();
  }
 }
});
test('finishing the tutorial switches subsequent runs to unrestricted hands',()=>{
 let completed=false;
 const g=new Game(()=>0,()=>completed);
 assert.deepEqual(g.inventory.map(p=>p!.shape.cells.length),[1,1,3]);
 completed=true;g.restart();
 assert.ok(g.inventory.every(p=>p!.shape===SHAPES[0]));
 assert.equal(new Set(g.inventory.map(p=>p!.tile)).size,2);
});
