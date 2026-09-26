import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, footprint, type Piece } from '../src/game';
import { SHAPES } from '../src/shapes';
const piece = (id: string, tile: Piece['tile'] = 'water'): Piece => ({shape: SHAPES.find(shape => shape.id === id)!, tile});
const pattern = (p: Piece) => Array.from({length:p.shape.height}, (_, y) =>
  Array.from({length:p.shape.width}, (_, x) => p.shape.cells.some(([cx, cy]) => cx === x && cy === y) ? '1' : '0').join('')).join('/');

test('every drawing in the reference is represented, including repeats and disconnected cells', () => {
  // All 20 drawings, row by row. Three drawings duplicate an earlier shape.
  const reference = [
    '10/11', '11/01', '11/10', '01/11',
    '10/01', '01/10', '10/01', '01/10',
    '010/111/010', '1/1/1', '111', '1',
    '11/10/11', '11/01/11', '111/101', '101/111',
    '010/101', '010/101', '10/01/10', '01/10/01',
  ];
  const actual = SHAPES.map(shape => pattern({shape, tile:'water'}));
  assert.deepEqual(new Set(actual), new Set(reference));
  assert.equal(actual.length, 17);
  assert.equal(new Set(actual).size, actual.length);
});

test('every shape can be dealt in either element and every tray has a 2:1 mix', () => {
  SHAPES.forEach((shape, index) => {
    for (const majority of [.1, .9]) for (const slot of [0,1,2]) {
      const values = [majority, (slot + .5)/3, ...Array(3).fill((index+.5)/SHAPES.length)];
      const game = new Game(() => values.shift()!);
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

for (const element of ['water', 'lava'] as const) for (const axis of ['row','column']) {
  test(`${element} ${axis} instantly resets the board and petrifies only the opposite element`, () => {
    const game = new Game();
    const line = Array.from({length:8}, (_, i) => axis === 'row' ? 16+i : i*8+2);
    for (const cell of line.slice(0,7)) game.board[cell] = element;
    const opposite = element === 'water' ? 'lava' : 'water';
    game.board[63] = opposite; game.board[62] = 'stone'; game.board[61] = element;
    game.inventory = [piece('single', element),piece('single', opposite),piece('single', element)];
    const second = game.inventory[1];
    assert.equal(game.place(0,line[7]),true);
    assert.equal(game.lastClear,element);
    assert.equal(game.boardRevision,1);
    assert.deepEqual(game.board, Array.from({length:64},(_,i)=>i===63||i===62?'stone':null));
    assert.equal(game.inventory[0],null);
    assert.equal(game.inventory[1],second);
  });
}
test('mixed, incomplete and stone-filled lines do not clear', () => {
  for (const blocker of ['lava','stone',null] as const) {
    const game = new Game(); game.board.fill('water',0,6);game.board[6]=blocker;
    game.inventory[0]=piece('single');game.place(0,7);
    assert.equal(game.lastClear,null);assert.equal(game.board[0],'water');
  }
});
test('simultaneous row and column completion resets once and final-slot refill stays mixed', () => {
  const game = new Game();
  for(let i=1;i<8;i++){game.board[i]='lava';game.board[i*8]='lava';}
  game.board[63]='water';game.inventory=[null,null,piece('single','lava')];
  game.place(2,0);
  assert.equal(game.boardRevision,1);assert.equal(game.board[63],'stone');
  assert.equal(game.inventory.filter(Boolean).length,3);
  assert.equal(new Set(game.inventory.map(p=>p!.tile)).size,2);
});

for (const axis of ['row','column']) {
  test(`a completed stone ${axis} clears only that line after a reaction`, () => {
    const game=new Game();
    const line=Array.from({length:8},(_,i)=>axis==='row'?24+i:i*8+3);
    const gap=line[3];
    line.forEach(cell=>{if(cell!==gap)game.board[cell]='stone';});
    const water=axis==='row'?gap-8:gap-1, lava=axis==='row'?gap+8:gap+1;
    game.board[water]='water';game.board[lava]='lava';game.board[63]='stone';
    assert.equal(game.formStone(gap),true);
    assert.ok(line.every(cell=>game.board[cell]==='stone'));
    assert.equal(game.pendingStoneLines.length,8);
    game.removeStoneCells(game.pendingStoneLines);
    assert.ok(line.every(cell=>game.board[cell]===null));
    assert.equal(game.board[water],'water');assert.equal(game.board[lava],'lava');assert.equal(game.board[63],'stone');
  });
}
test('element reset preserves old stone, then clears only complete stone rows and columns simultaneously', () => {
  const game=new Game();
  // Water completes top row. Existing lava becomes the intersection of a stone
  // row and column; a separate water/lava mix cannot clear these prematurely.
  game.board.fill('water',0,7);
  for(let x=0;x<8;x++)game.board[24+x]='stone';
  game.board[27]='lava';
  for(let y=1;y<8;y++)if(y!==3)game.board[y*8+3]='stone';
  // The top intersection becomes sand, so column 3 is deliberately incomplete.
  game.board[63]='stone';game.board[62]='lava';
  game.inventory[0]=piece('single','water');game.place(0,7);
  assert.equal(game.pendingStoneLines.length,8);
  game.removeStoneCells(game.pendingStoneLines);
  assert.ok(game.board.slice(24,32).every(v=>v===null));
  assert.equal(game.board[11],'stone');assert.equal(game.board[63],'stone');assert.equal(game.board[62],'stone');
});
test('multiple stone rows are marked simultaneously after conversion', () => {
  const game=new Game();
  // A full water row cannot intersect a stone column, but conversion can
  // complete multiple stone rows at once. Both must be detected before clearing.
  game.board.fill('water',0,7);
  for(const row of [3,4]) for(let x=0;x<8;x++)game.board[row*8+x]=x===3?'lava':'stone';
  game.board[63]='stone';game.inventory[0]=piece('single','water');game.place(0,7);
  assert.equal(game.pendingStoneLines.length,16);
  game.removeStoneCells(game.pendingStoneLines);
  assert.ok(game.board.slice(24,40).every(v=>v===null));
  assert.equal(game.board[63],'stone');
});
