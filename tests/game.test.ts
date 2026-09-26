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

test('every shape can be randomly dealt in either element', () => {
  SHAPES.forEach((shape, index) => {
    for (const elementRandom of [0.1, 0.9]) {
      let calls = 0;
      const game = new Game(() => calls++ % 2 === 0 ? (index + 0.5) / SHAPES.length : elementRandom);
      assert.ok(game.inventory.every(p => p?.shape === shape && p.tile === (elementRandom < 0.5 ? 'water' : 'lava')));
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
  assert.equal(calls, 6);
  assert.equal(game.place(2, 63), true);
  assert.equal(calls, 12);
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

test('filled rows do not clear', () => {
  const game = new Game();
  for (let cell = 0; cell < 64; cell++) {
    game.inventory[0] = piece('single');
    assert.equal(game.place(0, cell), true);
  }
  assert.equal(game.board.filter(Boolean).length, 64);
  assert.equal(game.place(1, 0), false);
});
