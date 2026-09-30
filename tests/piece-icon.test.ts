import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pieceIcon} from '../src/piece-icon';
import {SHAPES} from '../src/shapes';

function vertices(path:string){
 const tokens=path.match(/[a-z]|-?\d+(?:\.\d+)?/gi)!;
 let x=0,y=0;const points:number[][]=[];
 for(let i=0;i<tokens.length;){
  const command=tokens[i++];
  if(command==='M'){x=Number(tokens[i++]);y=Number(tokens[i++]);}
  else if(command==='h')x+=Number(tokens[i++]);
  else if(command==='v')y+=Number(tokens[i++]);
  else if(command==='H')x=Number(tokens[i++]);
  else if(command==='V')y=Number(tokens[i++]);
  else if(command==='z')continue;
  else assert.fail(`Unsupported foliage command: ${command}`);
  points.push([x,y]);
 }
 return points;
}

test('every bush shape keeps identical foliage inside each occupied tile, including offset columns and holes',()=>{
 let reference:number[][]|undefined;
 for(const shape of SHAPES){
  const icon=pieceIcon({tile:'bush',shape});
  const paths=[...icon.matchAll(/<path d="([^"]+)" fill="#80b866"/g)];
  assert.equal(paths.length,shape.cells.length,shape.id);
  paths.forEach((path,i)=>{
   const [cx,cy]=shape.cells[i];
   const local=vertices(path[1]).map(([x,y])=>[x-cx*24,y-cy*24]);
   assert.ok(local.every(([x,y])=>x>0&&x<24&&y>0&&y<24),`${shape.id}: foliage escapes tile ${cx},${cy}`);
   reference??=local;assert.deepEqual(local,reference,`${shape.id}: foliage must translate with its tile`);
  });
 }
});
test('water and lava inventory icons do not include bush foliage',()=>{
 for(const shape of SHAPES)for(const tile of ['water','lava'] as const)assert.ok(!pieceIcon({tile,shape}).includes('#80b866'));
});
