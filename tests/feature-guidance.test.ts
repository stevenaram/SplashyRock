import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Piece} from '../src/game';
import {forgeSuggestion,forgeNeeds} from '../src/feature-guidance';
const forge:Piece={tile:'forge',shape:{id:'forge',name:'Forge',width:3,height:1,cells:[[0,0],[1,0],[2,0]]}};
test('forge hand guide prefers bottom left, falls back legally, and does not constrain placement',()=>{
 const g=new Game();assert.equal(forgeSuggestion(g,forge),57);assert.ok(g.canPlace(forge,27));g.board[56]='bush';const c=forgeSuggestion(g,forge)!;assert.ok(g.canPlace(forge,c));assert.ok(Math.floor(c/8)>=6);g.board.fill('obsidian');assert.equal(forgeSuggestion(g,forge),undefined);
});
test('forge guidance distinguishes both missing inputs from individual missing fuel',()=>{
 const g=new Game();g.board[27]='forge';g.forges.set(27,{bricks:0,cycles:0});assert.deepEqual(forgeNeeds(g),['forge-both']);g.board[26]='lava';assert.deepEqual(forgeNeeds(g),['forge-water']);g.board[26]=null;g.board[28]='water';assert.deepEqual(forgeNeeds(g),['forge-lava']);g.board[26]='lava';assert.deepEqual(forgeNeeds(g),[]);
});
