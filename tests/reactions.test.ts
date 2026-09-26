import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';
import { SHAPES } from '../src/shapes';
import { StoneReactions } from '../src/reactions';

test('all pairs of orthogonal water/lava neighbors produce a shared stone cell', () => {
  const neighbors = [19, 26, 28, 35];
  for (const water of neighbors) for (const lava of neighbors) {
    if (water === lava) continue;
    const game = new Game();
    game.board[water] = 'water';
    game.board[lava] = 'lava';
    assert.equal(game.canFormStone(27), true);
    assert.equal(game.formStone(27), true);
    assert.equal(game.board[27], 'stone');
    assert.equal(game.board[water], 'water');
    assert.equal(game.board[lava], 'lava');
    assert.equal(game.formStone(27), false);
  }
});

test('diagonals, row wrapping, single elements and occupied cells do not react', () => {
  const game = new Game();
  game.board[18] = 'water'; game.board[36] = 'lava';
  assert.equal(game.canFormStone(27), false);
  game.board.fill(null);
  game.board[7] = 'water'; game.board[9] = 'lava';
  assert.equal(game.canFormStone(8), false);
  game.board.fill(null);
  game.board[26] = 'water'; game.board[28] = 'water';
  assert.equal(game.canFormStone(27), false);
  game.board[28] = 'lava';
  for (const occupied of ['water', 'lava', 'stone'] as const) {
    game.board[27] = occupied;
    assert.equal(game.formStone(27), false);
    assert.equal(game.board[27], occupied);
  }
  for (const invalid of [-1, 64, NaN, 1.5]) assert.equal(game.formStone(invalid), false);
});

test('edge and corner cells can react without out-of-bounds neighbors', () => {
  const game = new Game();
  game.board[1] = 'water'; game.board[8] = 'lava';
  assert.equal(game.formStone(0), true);
  game.board[55] = 'water'; game.board[62] = 'lava';
  assert.equal(game.formStone(63), true);
});

test('stone appears at 500ms, not during preview, and blocks future placement', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const game = new Game();
  game.board[26] = 'water';
  const lava = {tile:'lava' as const, shape:SHAPES.find(shape => shape.id === 'single')!};
  game.inventory[0] = lava;
  const shown: number[] = [];
  const reactions = new StoneReactions(game, cell => shown.push(cell));
  assert.equal(game.canPlace(lava, 28), true); // Preview is read-only.
  t.mock.timers.tick(1000);
  assert.equal(game.board[27], null);
  game.place(0, 28);
  reactions.schedule();
  t.mock.timers.tick(499);
  assert.equal(game.board[27], null);
  assert.deepEqual(shown, []);
  reactions.schedule(); // Further placements must not reset the first timer.
  t.mock.timers.tick(1);
  assert.equal(game.board[27], 'stone');
  assert.deepEqual(shown, [27]);
  assert.equal(game.canPlace(lava, 27), false);
  reactions.dispose();
});

test('multiple shared neighbors react; late occupied cells are preserved; cleanup cancels timers', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const game = new Game();
  game.board[27] = 'water'; game.board[36] = 'lava';
  assert.deepEqual(game.stoneCandidates(), [28,35]);
  const shown: number[] = [];
  const reactions = new StoneReactions(game, cell => shown.push(cell));
  reactions.schedule();
  game.board[28] = 'water';
  t.mock.timers.tick(500);
  assert.equal(game.board[28], 'water');
  assert.deepEqual(shown, [35]);
  game.board[28] = null;
  reactions.schedule(); reactions.dispose();
  t.mock.timers.tick(500);
  assert.equal(game.board[28], null);
});

test('a reaction scheduled in a previous run cannot alter the restarted board',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const game=new Game();
  game.board[26]='water';game.board[28]='lava';const reactions=new StoneReactions(game,()=>assert.fail('Old run reaction'));
  reactions.schedule();game.restart();game.board[26]='water';game.board[28]='lava';t.mock.timers.tick(500);
  assert.equal(game.board[27],null);reactions.dispose();
});
