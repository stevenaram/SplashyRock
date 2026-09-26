import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game';
import {SHAPES} from '../src/shapes';
const single=SHAPES.find(s=>s.id==='single')!;
function finishTray(game:Game){game.inventory=[{tile:'water',shape:single},null,null];assert.equal(game.place(0,0),true);game.board[0]=null;}
test('5000-point reward arrives in the next fresh tray, with pet in the middle and both elements',()=>{
 const game=new Game(()=>.2);game.score=4998;finishTray(game);assert.ok(game.inventory.every(p=>p?.tile!=='pet'));
 // The placement itself can cross the threshold before dealing.
 finishTray(game);assert.equal(game.score,5000);assert.equal(game.inventory[1]?.tile,'pet');
 assert.deepEqual(new Set([game.inventory[0]?.tile,game.inventory[2]?.tile]),new Set(['water','lava']));
 assert.deepEqual(game.inventory[1]?.shape.cells,[[0,0]]);
});
test('pet is cosmetic, consumes its slot, and does not block subsequent pieces or earn points',()=>{
 const game=new Game(()=>.2);game.score=5000;finishTray(game);const pet=game.inventory[1]!;
 game.board[9]='lava';assert.equal(game.canPlace(pet,9),false);assert.equal(game.place(1,-1),false);
 const before=[...game.board],score=game.score,versions=[...game.versions];
 assert.equal(game.place(1,27),true);assert.equal(game.petPlaced,true);assert.equal(game.inventory[1],null);
 assert.deepEqual(game.board,before);assert.deepEqual(game.versions,versions);assert.equal(game.score,score);
 assert.equal(game.canPlace({tile:'water',shape:single},27),true);
});
test('pet reward is once per run and resets on replay',()=>{
 const game=new Game(()=>.7);game.score=5000;finishTray(game);assert.equal(game.inventory[1]?.tile,'pet');
 game.place(1,27);game.score=15000;finishTray(game);assert.ok(game.inventory.every(p=>p?.tile!=='pet'));
 game.restart();assert.equal(game.petPlaced,false);assert.equal(game.petRewardDealt,false);
 game.score=5000;finishTray(game);assert.equal(game.inventory[1]?.tile,'pet');
});
test('reaching 5000 during a chain preserves the current tray until it is used',()=>{
 const game=new Game(()=>.2),tray=game.inventory;game.score=4990;game.combo=2;game.chainPoints=20;game.finishChain();
 assert.equal(game.inventory,tray);assert.ok(game.inventory.every(p=>p?.tile!=='pet'));
 finishTray(game);assert.equal(game.inventory[1]?.tile,'pet');
});
