import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,Plane,Ray} from 'three';
import {deckReveal,launchPose} from '../src/ship-launch';
import {BoatProgress,BOAT_TOTAL_BRICKS,BOAT_BLUEPRINT} from '../src/boat';
test('last pet delivery finishes structure without reserving floor work',()=>{
 const progress=new BoatProgress();progress.setProgress(BOAT_TOTAL_BRICKS-1);const id=progress.reserve()!;
 assert.equal(BOAT_BLUEPRINT[id].deck,false);progress.deliver(id);assert.ok(progress.complete);assert.equal(progress.reserve(),null);
});
test('floor sweeps diagonally from top left to bottom right before launch motion',()=>{
 assert.equal(deckReveal(0,0),0);assert.ok(deckReveal(0,.3)>0);assert.equal(deckReveal(63,.3),0);
 assert.equal(deckReveal(8,.5),deckReveal(1,.5));
 for(let c=0;c<64;c++)assert.equal(deckReveal(c,3),1);
 assert.equal(launchPose(2).pitch,0);assert.equal(launchPose(2).roll,0);
 assert.ok(Math.abs(launchPose(4).pitch)>0);assert.equal(launchPose(4,true).roll,0);assert.equal(deckReveal(63,0,true),1);
});
test('world hit tests round-trip every cell on the dipping and swaying deck',()=>{
 for(const age of [3.5,4,6,10,35]){const pose=launchPose(age),ship=new Group();ship.rotation.set(pose.pitch,0,pose.roll);ship.position.y=pose.heave;ship.updateMatrixWorld(true);
 const plane=new Plane(new Vector3(0,1,0),0).applyMatrix4(ship.matrixWorld);
 for(let cell=0;cell<64;cell++){const local=new Vector3((cell%8-3.5)*2,0,(Math.floor(cell/8)-3.5)*2),target=ship.localToWorld(local.clone()),origin=new Vector3(0,25,25),ray=new Ray(origin,target.clone().sub(origin).normalize()),hit=ray.intersectPlane(plane,new Vector3())!;assert.ok(ship.worldToLocal(hit).distanceTo(local)<1e-8);}
 }
});
