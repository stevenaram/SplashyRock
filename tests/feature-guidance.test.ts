import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {forgeSuggestion,forgeNeeds,ForgeFuelGuidance,forgeRescueSuggestion} from '../src/feature-guidance';
const forge:Piece={tile:'forge',shape:{id:'forge',name:'Forge',width:3,height:1,cells:[[0,0],[1,0],[2,0]]}};
test('forge hand guide prefers third column and two rows above bottom, falls back legally, and does not constrain placement',()=>{
 const g=new Game();assert.equal(forgeSuggestion(g,forge),42);assert.ok(g.canPlace(forge,27));g.board[41]='bush';const c=forgeSuggestion(g,forge)!;assert.ok(g.canPlace(forge,c));assert.notEqual(c,42);assert.ok(Math.hypot(c%8-2,Math.floor(c/8)-5)<=1.5);g.board.fill('obsidian');assert.equal(forgeSuggestion(g,forge),undefined);
});
test('forge guidance distinguishes both missing inputs from individual missing fuel',()=>{
 const g=new Game();g.board[27]='forge';g.forges.set(27,{bricks:0,cycles:0});assert.deepEqual(forgeNeeds(g),['forge-both']);g.board[26]='lava';assert.deepEqual(forgeNeeds(g),['forge-water']);g.board[26]=null;g.board[28]='water';assert.deepEqual(forgeNeeds(g),['forge-lava']);g.board[26]='lava';assert.deepEqual(forgeNeeds(g),[]);
});

test('missing fuel waits two normal turns and all aftermath, resetting separately when refilled',()=>{
 const g=new Game(),guide=new ForgeFuelGuidance();g.board[27]='forge';g.forges.set(27,{bricks:0,cycles:0});
 assert.deepEqual(guide.update(g,true),[]);g.moves+=3;assert.deepEqual(guide.update(g,true),[]);
 g.shapeMoves=1;assert.deepEqual(guide.update(g,true),[]);g.shapeMoves=2;assert.deepEqual(guide.update(g,false),[]);assert.deepEqual(guide.update(g,true),['forge-both']);
 g.board[26]='lava';assert.deepEqual(guide.update(g,false),[]);assert.deepEqual(guide.update(g,true),['forge-water']);
 g.board[26]=null;guide.update(g,false);g.shapeMoves=3;assert.deepEqual(guide.update(g,true),['forge-water']);g.shapeMoves=4;assert.deepEqual(guide.update(g,true),['forge-both']);
 guide.reset();assert.deepEqual(guide.update(g,true),[]);
});

test('forge rescue chooses one basin-only legal shape, ignoring blocked pieces and eggs',()=>{
 const g=new Game();g.board.fill('obsidian');g.board[27]='forge';g.forges.set(27,{bricks:0,cycles:0});g.board[26]='lava';g.board[28]='water';
 const single=(tile:Piece['tile']):Piece=>({tile,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}});
 g.inventory=[single('bush'),single('water'),single('lava'),single('pet')];
 assert.deepEqual(forgeRescueSuggestion(g),{slot:1,cell:28});
 g.inventory[1]=null;assert.deepEqual(forgeRescueSuggestion(g),{slot:2,cell:26});
 g.board[0]=null;assert.equal(forgeRescueSuggestion(g),undefined);
 g.board[0]='obsidian';g.inventory[2]=null;assert.equal(forgeRescueSuggestion(g),undefined);
});
