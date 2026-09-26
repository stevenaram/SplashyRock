import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game';

test('deals three independent random tiles and refills only after all three are used', () => {
  let calls = 0;
  const game = new Game(() => calls++ % 2 ? 0.8 : 0.2);
  assert.deepEqual(game.inventory, ['water', 'lava', 'water']);
  assert.equal(game.place(1, 12), true);
  assert.deepEqual(game.inventory, ['water', null, 'water']);
  assert.equal(game.place(1, 13), false);
  assert.equal(game.place(0, 12), false);
  assert.equal(game.place(0, 0), true);
  assert.equal(calls, 3);
  assert.equal(game.place(2, 63), true);
  assert.equal(calls, 6);
  assert.deepEqual(game.inventory, ['lava', 'water', 'lava']);
  assert.equal(game.board[12], 'lava');
});
test('rejects invalid cells and leaves filled rows in place', () => {
  const game = new Game(() => 0);
  for (const cell of [-1, 64, 1.5, NaN]) assert.equal(game.place(0, cell), false);
  for (let cell = 0; cell < 64; cell++) assert.equal(game.place(cell % 3, cell), true);
  assert.equal(game.board.filter(Boolean).length, 64);
  const inventory = [...game.inventory];
  assert.equal(game.place(1, 0), false);
  assert.deepEqual(game.inventory, inventory);
});
