import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Element} from '../src/game';
import {largestPool} from '../src/boss';
import {PetMotion,PET_LEAP_MIN} from '../src/pet-motion';
function fixture(){
 const g=new Game(()=>.1,()=>true);
 for(const [i,element] of (['lava','water','lava'] as Element[]).entries()){
  g.inventory[0]={tile:'pet',petElement:element,shape:{id:'egg',name:'Egg',width:1,height:1,cells:[[0,0]]}};
  g.place(0,48+i);g.pet!.hatchRemaining=0;
 }
 for(const c of [18,19,20,26,27,28])g.board[c]='water';
 return g;
}
test('boss waits for three actual hatches, chooses opposite majority, and anchors largest cardinal pool',()=>{
 const g=fixture();g.pet!.hatchRemaining=1;assert.equal(g.trySpawnBoss(),false);g.pet!.hatchRemaining=0;
 assert.equal(g.trySpawnBoss(),true);assert.equal(g.boss!.element,'water');assert.deepEqual(new Set(g.boss!.pool),new Set([18,19,20,26,27,28]));assert.equal(g.trySpawnBoss(),false);
 const b=Array(64).fill(null);b[7]=b[8]='water';assert.equal(largestPool(b,()=>0).length,1);
});
test('attacking leap takes twice the normal duration and consumes one action without laying a tile',()=>{
 const board=Array(64).fill(null);let hits=0,tiles=0;
 const p=new PetMotion(27,'lava',board,()=>{tiles++;},()=>0,undefined,undefined,()=>({cells:[28],hit:()=>{hits++;}}));
 p.queueAbility();p.update(PET_LEAP_MIN);assert.equal(hits,0);assert.equal(p.attacking,true);assert.equal(p.leapProgress,.5);
 p.update(PET_LEAP_MIN);assert.equal(hits,1);assert.equal(tiles,0);assert.equal(p.queued,0);assert.equal(p.attacking,false);
});
test('opposite pets attack while matching pets still place tiles',()=>{
 const g=fixture();g.trySpawnBoss();const hp=g.boss!.hp;
 const lava=g.pets[0],water=g.pets[1];lava.queueAbility();water.queueAbility();lava.update(.01);water.update(.01);
 assert.equal(lava.attacking,true);assert.equal(water.attacking,false);lava.update(3);water.update(2);
 assert.equal(g.boss!.hp,hp-2);assert.equal(g.petTileEvents.length,1);
});
test('pool clearing damages boss once per original cell; defeat rewards stones and has a 12-shape cooldown',()=>{
 const g=fixture();g.trySpawnBoss();const hp=g.boss!.hp;
 g.clearCells([18]);assert.equal(g.boss!.hp,hp-1);g.clearCells([18]);assert.equal(g.boss!.hp,hp-1);
 g.clearCells([19,20,26,27,28]);assert.equal(g.boss,null);assert.equal(g.bossesDefeated,1);assert.equal(g.bossStoneEvents.length,1);assert.equal(g.board[g.bossStoneEvents[0]],'stone');
 g.board[10]='lava';assert.equal(g.trySpawnBoss(),false);g.shapeMoves+=11;assert.equal(g.trySpawnBoss(),false);g.shapeMoves++;assert.equal(g.trySpawnBoss(),true);
 g.restart();assert.equal(g.boss,null);assert.equal(g.bossesDefeated,0);assert.equal(g.bossStoneEvents.length,0);
});
test('empty boards defer spawning; bosses never spawn after game over',()=>{
 const g=fixture();g.board.fill(null);assert.equal(g.trySpawnBoss(),false);g.board[27]='lava';g.over=true;assert.equal(g.trySpawnBoss(),false);
});
test('a boss defeated mid-flight cannot receive stale damage or turn an attack into a pet tile',()=>{
 const g=fixture();g.trySpawnBoss();const pet=g.pets[0];pet.queueAbility();pet.update(.01);g.clearCells([...g.boss!.pool]);pet.update(3);
 assert.equal(g.bossesDefeated,1);assert.equal(pet.queued,0);assert.equal(g.petTileEvents.length,0);
});
