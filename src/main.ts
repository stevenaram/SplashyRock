import {forgeIcon} from './forge';
import {seedForgeTest,forgeTestControls} from './forge-test';
import {seedBushTest,bushTestControls} from './bush-test';
import {NoSpaceSequence} from './no-space';
import {noticeRail} from './notice-rail';
import {HighScore} from './high-score';
import {BossSpawnQueue} from './boss-spawns';
import {BossRewardCallout} from './boss-reward';
import {bossTestMode,scoreTestMode,sandboxMode,bushTestMode,forgeTestMode} from './test-mode';
import {scoreTestControls} from './score-test';
import {seedBossTest,bossTestControls} from './boss-test';
import {gemIcon,REVIVE_COST} from './gems';
import {Progression} from './progression';
import {ProgressUI} from './progress-ui';
import {seenTips} from './seen-tips';
import {SoundEngine} from './sound';
import {Tutorial} from './tutorial';
import {REWARD_GOALS,REWARD_TYPES} from './egg-goals';
import {eggIcon} from './egg';
import {Aftermath} from './aftermath';
import './style.css';
import { ComboCallout } from './combo-callout';
import { pieceIcon } from './piece-icon';
import { World } from './world';
import { Game, type Piece } from './game';
import { StoneReactions, SandSweeps } from './reactions';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Missing game container');
host.innerHTML = `<header id="run-hud"><div id="hud-wallets"><div id="hud-best" aria-label="Best score"><svg viewBox="0 0 24 20" aria-hidden="true"><path d="m2 5 5 4 5-7 5 7 5-4-3 12H5z"/><path d="M5 19h14"/></svg><strong>0</strong></div></div><div id="hud"><span>SCORE</span><strong id="score"><span id="score-digits">0</span></strong><span id="score-gain" aria-hidden="true"></span></div><div id="egg-goal" role="progressbar"><img alt=""/><div class="egg-track"><i></i></div><strong></strong><span class="egg-pending"></span></div></header><section id="board" aria-label="Eight by eight board"></section>
  <div id="egg-unlocked" role="status" hidden><img alt=""/><strong>Egg Unlocked</strong></div>
  <nav id="tray" aria-label="Available tiles"></nav><p id="inventory-end-note">No space left.</p>
  <div id="ghost" aria-hidden="true" hidden></div>
  <p id="status" role="status" class="sr-only"></p>
  <aside id="game-over" hidden aria-labelledby="end-title"><button id="close-game-over" type="button" aria-label="Close Game Over and review board"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button><h1 id="end-title">Game Over</h1><div class="end-scores"><p><span>Score</span><strong id="final-score">0</strong></p><i aria-hidden="true"></i><p><span>Best</span><strong id="best-score">0</strong></p></div><div id="revive-offer"><button id="revive" type="button"><span>Revive</span><strong>${gemIcon} ${REVIVE_COST}</strong></button><p id="revive-detail">Turn the center 2×2 area into clearing stones.</p></div><button id="play-again" type="button">Play again <span aria-hidden="true">↻</span></button></aside>`;
const sound=new SoundEngine();
const soundButton=document.createElement('button');soundButton.id='sound-toggle';soundButton.type='button';
soundButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9h5l5-4v14l-5-4H2z"/><path class="sound-waves" d="M15 8q4 4 0 8m3-11q6 7 0 14"/><path class="sound-off" d="m15 9 6 6m0-6-6 6"/></svg>';
const refreshSound=()=>{soundButton.classList.toggle('muted',sound.muted);soundButton.setAttribute('aria-label',sound.muted?'Enable sound':'Mute sound');soundButton.setAttribute('aria-pressed',String(!sound.muted));};
refreshSound();host.append(soundButton);soundButton.addEventListener('click',()=>{sound.toggle();refreshSound();});
const board = document.querySelector<HTMLElement>('#board')!;
const tray = document.querySelector<HTMLElement>('#tray')!;
const ghost = document.querySelector<HTMLElement>('#ghost')!;
const status = document.querySelector<HTMLElement>('#status')!;
const scoreLabel=document.querySelector<HTMLElement>('#score')!;
const gainLabel=document.querySelector<HTMLElement>('#score-gain')!;
const endDialog=document.querySelector<HTMLElement>('#game-over')!;
board.append(endDialog);
const goal=document.querySelector<HTMLElement>('#egg-goal')!;
(goal.querySelector('img') as HTMLImageElement).src=eggIcon();
const unlock=document.querySelector<HTMLElement>('#egg-unlocked')!;
(unlock.querySelector('img') as HTMLImageElement).src=eggIcon();
let announcedEggs=0;
let unlockTimer:ReturnType<typeof setTimeout>|undefined;
function announceEggs(){
  if(game.rewardsDealt<=announcedEggs)return;
  sound.play('reward');
  unlock.querySelector('strong')!.textContent=REWARD_TYPES[game.rewardsDealt-1]==='forge'?'Obsidian Forge Unlocked':'Egg Unlocked';
  (unlock.querySelector('img') as HTMLImageElement).src=REWARD_TYPES[game.rewardsDealt-1]==='forge'?forgeIcon():eggIcon();
  announcedEggs=game.rewardsDealt;renderTray();unlock.hidden=false;
  unlock.getAnimations().forEach(a=>a.cancel());
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)unlock.animate([{opacity:0,transform:'translateY(8px) scale(.9)'},{opacity:1,transform:'translateY(-2px) scale(1.03)',offset:.7},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:480,easing:'cubic-bezier(.2,.8,.3,1)'});
  clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>{unlock.hidden=true;},2800);
}
let shownCombo=0;
const again=document.querySelector<HTMLButtonElement>('#play-again')!;
const reviveButton=document.querySelector<HTMLButtonElement>('#revive')!;
let progressStorage:Storage|undefined;try{progressStorage=localStorage;}catch{}
const progression=new Progression(sandboxMode?undefined:progressStorage);
let playedBeyondIntro=false;
let reviveInFlight=false;
let shownScore=0;
let placementGain=0;
let gainTimer:ReturnType<typeof setTimeout>|undefined;
function resetGain(){placementGain=0;clearTimeout(gainTimer);gainLabel.getAnimations().forEach(a=>a.cancel());gainLabel.textContent='';gainLabel.style.opacity='0';}
let bestStorage:Storage|undefined;
try {if(!sandboxMode)bestStorage=localStorage;}catch{}
const highScore=new HighScore(bestStorage);
let best=highScore.value;
let endTimer:ReturnType<typeof setTimeout>|undefined;
function updateBest(){
  const bestHud=document.querySelector<HTMLElement>('#hud-best')!;
  bestHud.querySelector('strong')!.textContent=best.toLocaleString();
  bestHud.setAttribute('aria-label',`Best score: ${best.toLocaleString()}`);
}
function updateScore(){
  best=highScore.record(game.score);
  updateBest();
  const gain=game.score-shownScore;const digits=document.querySelector<HTMLElement>('#score-digits')!;digits.textContent=game.score.toLocaleString();
  if(gain>0){
    placementGain+=gain;gainLabel.textContent=`+${placementGain.toLocaleString()}`;
    clearTimeout(gainTimer);gainLabel.getAnimations().forEach(a=>a.cancel());gainLabel.style.opacity='1';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)gainLabel.animate([{opacity:1,transform:'translateY(0) scale(1.08)'},{opacity:1,transform:'translateY(-2px) scale(1)',offset:.25},{opacity:0,transform:'translateY(-14px) scale(1)'}],{duration:1100,fill:'forwards',easing:'cubic-bezier(.2,.7,.3,1)'});
    else gainTimer=setTimeout(()=>{gainLabel.style.opacity='0';},1100);
  }
  // Fit the number inside its reserved column without moving the goal bar.
  const scoreWidth=scoreLabel.clientWidth;
  scoreLabel.style.fontSize=`${Math.min(window.innerHeight<=500?36:48,scoreWidth/Math.max(1,scoreLabel.textContent!.length)/.62)}px`;
  const digitBounds=digits.getBoundingClientRect(),hudBounds=scoreLabel.parentElement!.getBoundingClientRect();
  gainLabel.style.left=`${digitBounds.right-hudBounds.left+9}px`;
  gainLabel.style.top=`${digitBounds.top-hudBounds.top+digitBounds.height*.28}px`;
  shownScore=game.score;
  const earned=REWARD_GOALS.filter(n=>game.score>=n).length,index=Math.min(earned,REWARD_GOALS.length-1),target=REWARD_GOALS[index],previous=index?REWARD_GOALS[index-1]:0;
  goal.classList.toggle('forge-goal',REWARD_TYPES[index]==='forge');
  (goal.querySelector('img') as HTMLImageElement).src=REWARD_TYPES[index]==='forge'?forgeIcon():eggIcon();
  const progress=earned===REWARD_GOALS.length?1:Math.max(0,Math.min(1,(game.score-previous)/(target-previous)));
  goal.style.setProperty('--progress',String(progress));goal.querySelector('strong')!.textContent=earned===REWARD_GOALS.length?'✓':target.toLocaleString();
  const pending=Math.max(0,earned-game.rewardsDealt);goal.classList.toggle('ready',pending>0);
  goal.querySelector('.egg-pending')!.textContent=pending?`+${pending}`:'';
  goal.setAttribute('aria-valuemin',String(previous));goal.setAttribute('aria-valuemax',String(target));goal.setAttribute('aria-valuenow',String(Math.min(game.score,target)));goal.setAttribute('aria-label',earned===REWARD_GOALS.length?'All egg and forge rewards earned':`Next ${REWARD_TYPES[index]==='forge'?'forge':'egg'} at ${target.toLocaleString()} score`);
}
function refreshRevive(){
  const eligible=game.reviveTargets().length>0;
  document.querySelector<HTMLElement>('#revive-offer')!.hidden=false;
  reviveButton.disabled=reviveInFlight||!eligible||progression.gems<REVIVE_COST;
  document.querySelector('#revive-detail')!.textContent=!eligible?'Revive unavailable.':progression.gems<REVIVE_COST?'Earn gems through achievements to revive.':'Turn the center 2×2 area into clearing stones.';
}
function checkAchievements(){
  if(sandboxMode){game.featureAchievementEvents={};return;}
  const awards=progression.observe(game,{calm:!reactions.busy&&!sweeps.busy&&!(game.petsBusy||game.bushesBusy)&&aftermaths.size===0,allowCleanBoard:playedBeyondIntro&&!tutorial.guiding,suppressed:game.reviving});
  if(awards.length){progressUI.earned(awards);sound.play('reward');refreshRevive();}
}
function showEnd(won=false){
  refreshRevive();
  if(!won)sound.play('over');
  tutorial.dismiss();tutorial.dismissGoal();
  best=highScore.record(game.score);
  updateBest();
  document.querySelector('#end-title')!.textContent=won?'Boat complete!':'Game Over';
  document.querySelector('#close-game-over')!.setAttribute('aria-label',won?'Close victory and view your boat':'Close Game Over and review board');
  endDialog.style.setProperty('--end-digits',String(Math.max(game.score.toLocaleString().length,best.toLocaleString().length)));
  document.querySelector('#final-score')!.textContent=game.score.toLocaleString();document.querySelector('#best-score')!.textContent=best.toLocaleString();
  document.querySelector('#revive-offer')!.prepend(reviveButton);endDialog.append(again);host!.classList.remove('reviewing');
  endDialog.hidden=false;host!.classList.add('ended');host!.classList.toggle('won',won);
}
function settled(){
  game.reconcileObsidian();
  game.reconcileBushes();
  for(const events of [game.bossGrowthEvents,game.bossLiquidEvents]){
    const pending=events.splice(0);
    for(const element of ['water','lava'] as const){const cells=pending.filter(e=>e.element===element&&game.board[e.cell]===element).map(e=>e.cell);if(cells.length)world.addPiece(0,{tile:element,shape:{id:'boss-growth',name:'Pool surge',width:1,height:1,cells:cells.map(c=>[c%8,Math.floor(c/8)])}});}
  }



  for(const reward of game.bossRewards.splice(0)){bossReward.show(reward);sound.play('reward');}
  if(game.bossStoneEvents.length){for(const cell of game.bossStoneEvents.splice(0))world.addStone(cell);sweeps.schedule();}
  if(game.reviving){
    progression.observe(game,{calm:false,allowCleanBoard:false,suppressed:true});
    if(sweeps.busy)return;
    game.finishRevive();reviveInFlight=false;renderTray();updateScore();
  }
  checkAchievements();
  // Completing the ship unlocks an ongoing voyage, not a terminal game-over.
  if(!reactions.busy&&!sweeps.busy&&aftermaths.size===0&&game.finishIfWon())updateScore();
  // Every committed change (placement, stone creation, either sweep phase)
  // reconciles reactions before deciding whether the board has settled.
  if (!game.over) reactions.schedule();
  if(!reactions.busy&&!sweeps.busy&&!game.bushesBusy&&!game.bossesExpanding&&!game.pets.some(p=>p.hasAbilityFor(game.comboRun))&&game.combo>0){
    const multiplier=game.combo;const bonus=game.finishChain();
    if(multiplier>1)combo.finish(bonus);
    shownCombo=0;
  }
  bossSpawns.update([...aftermaths,...reactions.activeAftermaths,...sweeps.activeAftermaths]);
  if(game.bossAchievementEvents.length)checkAchievements();
  if(!reactions.busy&&!sweeps.busy&&!aftermaths.size&&!game.petsBusy&&!game.bushesBusy&&!game.bossesExpanding&&!game.bossesDying)game.settleBushFires();
  tutorial.settled(!reactions.busy&&!sweeps.busy);
  game.claimEggRewards();announceEggs();
  updateScore();
  updateTrayWarnings();
  if(game.over||game.bossesDying||game.bossesExpanding||reactions.busy||sweeps.busy||aftermaths.size>0||(game.petsBusy||game.bushesBusy)||game.hasLegalMove()){
    clearTimeout(endTimer);endTimer=undefined;return;
  }
  // Walking animation updates must not continually postpone this final check.
  if(endTimer!==undefined)return;
  endTimer=setTimeout(()=>{
    endTimer=undefined;
    if(!game.finishIfBlocked(game.bossesDying||game.bossesExpanding||reactions.busy||sweeps.busy||aftermaths.size>0||!!(game.petsBusy||game.bushesBusy)))return;
    tutorial.dismiss();tutorial.dismissGoal();combo.reset();
    noSpace.start(()=>showEnd());
    status.textContent=`Game Over. Final score ${game.score}. You can still try the remaining pieces, or play again.`;
  },400);
}
const world = new World(board);
const bossReward=new BossRewardCallout(board,(x,y)=>world.gridScreen(x,y,1));
const combo=new ComboCallout(board,cell=>world.cellScreen(cell));
// The clearing explanation also recognizes players who finished before completion tracking.
const game = new Game(Math.random,()=>seenTips.has('intro-complete')||seenTips.has('clearing'));
const bossSpawns=new BossSpawnQueue(game);
const noSpace=new NoSpaceSequence(board,game,(x,y)=>world.gridScreen(x,y,.16),(cue,level)=>sound.play(cue,level));
world.game=game;world.onPetChange=settled;world.onSound=(cue,cell,level=1)=>sound.play(cue,level,cell===undefined?0:(cell%8/7-.5)*.6);
const aftermaths=new Set<Aftermath>();
const events = new AbortController();
// Suppress native selection/callouts without cancelling button taps or keyboard clicks.
const preventNativeGesture=(event:Event)=>{if(event.cancelable)event.preventDefault();};
for(const type of ['contextmenu','selectstart','dragstart','gesturestart','gesturechange','gestureend']){
  host.addEventListener(type,preventNativeGesture,{passive:false,signal:events.signal});
}
host.addEventListener('touchmove',preventNativeGesture,{passive:false,signal:events.signal});
const tutorial=new Tutorial(board,goal,tray,game,cell=>world.cellScreen(cell,0));
world.onFirstPetAbility=element=>tutorial.showPetAbility(element);
world.onObsidian=()=>tutorial.showObsidian();
const progressUI=new ProgressUI(progression,()=>{cancel();sound.play('ui');});
const disposeNotices=noticeRail(goal,tray);
let selected: number | null = null;
let drag: { pointer: number; x: number; y: number; moved: boolean; offset: number } | null = null;
let target: number | null = null;
let trayMarkup="";
let trayPieces:(Piece|null)[]=[];
const refreshPreview = () => {
  const piece = selected === null ? null : game.inventory[selected];
  if (piece && target !== null) world.showPreview(target, piece, (game.canPlace(piece, target)&&tutorial.permits(piece,target)));
};
const sweeps = new SandSweeps(game, (cells, origin, phase, depth, owner) => {
  world.sandSweep(game.board,cells,origin,phase);
  if(!game.reviving)reactions.schedule(depth+1,owner);
  refreshPreview();
},settled);
const reactions = new StoneReactions(game, (cell,owner) => {
  world.addStone(cell);
  if(game.combo>=2&&game.combo>shownCombo){shownCombo=game.combo;combo.show(game.combo,cell);sound.play('combo',game.combo);}
  sweeps.schedule(owner);
  refreshPreview();
},settled);

game.onBushBurnout=run=>{const owner=new Aftermath(()=>{aftermaths.delete(owner);settled();},run);aftermaths.add(owner);return()=>owner.release();};
game.onLeafStone=(cell,run)=>{
  const owner=new Aftermath(settled,run);world.addStone(cell);
  if(game.combo>=2&&game.combo>shownCombo){shownCombo=game.combo;combo.show(game.combo,cell);sound.play('combo',game.combo);}
  sweeps.schedule(owner);reactions.schedule(1,owner);owner.release();
};

// Attribute each pet's reactions immediately, before another pet can land this frame.
game.onPetPlacement=run=>{
  const owner=new Aftermath(settled,run);reactions.schedule(1,owner);owner.release();
};

document.querySelector('#close-game-over')!.addEventListener('click',()=>{
  sound.play('ui');cancel();endDialog.hidden=true;host!.classList.add('reviewing');board.append(again);board.append(reviveButton);
  again.focus({preventScroll:true});
}, {signal:events.signal});

reviveButton.addEventListener('click',()=>{
  if(reviveInFlight||!game.over||!game.reviveTargets().length)return;
  if(!progression.spend(REVIVE_COST)){refreshRevive();progressUI.render();return;}
  reviveInFlight=true;reviveButton.disabled=true;cancel();clearTimeout(endTimer);endTimer=undefined;
  playedBeyondIntro=false;const stones=game.beginRevive();
  endDialog.hidden=true;document.querySelector('#revive-offer')!.prepend(reviveButton);endDialog.append(again);host!.classList.remove('ended','reviewing');
  sound.play('stone');world.syncBoard(game.board,true);sweeps.schedule();progressUI.render();
  status.textContent=`Revived for ${REVIVE_COST} Gems. ${stones.length} center tiles became stone.`;
}, {signal:events.signal});
window.addEventListener('storage',()=>{refreshRevive();best=highScore.refresh();updateBest();},{signal:events.signal});
let testBossElement:'water'|'lava'|'both'='water';
function restartRun(){
  noSpace.cancel();
  playedBeyondIntro=false;reviveInFlight=false;
  sound.stop();sound.play('restart');
  aftermaths.forEach(a=>a.cancel());aftermaths.clear();
  clearTimeout(endTimer);endTimer=undefined;reactions.dispose();sweeps.dispose();cancel();
  bossSpawns.reset();world.removePet();game.restart();world.syncBoard(game.board,false);endDialog.hidden=true;host!.classList.remove('ended','won','reviewing');document.querySelector('#revive-offer')!.prepend(reviveButton);endDialog.append(again);
  shownCombo=0;combo.reset();bossReward.reset();announcedEggs=0;clearTimeout(unlockTimer);unlock.hidden=true;
  if(bossTestMode){seedBossTest(game,world,testBossElement);announcedEggs=game.rewardsDealt;}
  if(bushTestMode){seedBushTest(game,world);announcedEggs=game.rewardsDealt;}
  if(forgeTestMode){seedForgeTest(game,world);announcedEggs=game.rewardsDealt;}
  shownScore=game.score;resetGain();tutorial.start();updateScore();renderTray();
  tray.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
}
again.addEventListener('click',restartRun,{signal:events.signal});


let blockedSlots=0;
function updateTrayWarnings(){
  let count=0;
  tray.querySelectorAll<HTMLButtonElement>('.slot').forEach((button,index)=>{
    const piece=game.inventory[index],blocked=!!piece&&!game.pieceFits(piece);
    button.disabled=!piece;
    if(blocked)count++;
    button.classList.toggle('blocked',blocked);
    if(blocked&&!game.over)tutorial.showFitWarning(piece);
    button.setAttribute('aria-label',piece?`${piece.tile==='pet'?((piece.eggCount??1)>1?`${piece.eggCount} Mystery Eggs`:'Mystery Egg'):`${piece.tile} ${piece.shape.name}`}, piece ${index+1}${blocked?', cannot fit on the board right now':''}`:'Used piece');
  });
  if(count>blockedSlots&&!game.over)sound.play('warning');
  blockedSlots=count;
}
function renderTray() {
  tray.classList.toggle('expanded',game.inventory.length>3);
  const markup = game.inventory.map((piece, index) => `<button class="slot ${piece?.tile ?? 'used'}" data-slot="${index}"
    data-pet="${piece?.tile==='pet'?'egg':''}" data-shape="${piece?.shape.id ?? ''}" aria-label="${piece ? `${piece.tile} ${piece.shape.name}, piece ${index + 1}` : 'Used piece'}" aria-pressed="${selected === index}"
    ${piece ? '' : 'disabled'}>${piece ? pieceIcon(piece)+((piece.tile==='pet'||piece.tile==='forge')&&(piece.eggCount??1)>1?`<span class="egg-count" aria-hidden="true">${piece.eggCount}</span>`:'')+'<svg class="fit-warning" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z"/><path class="warning-mark" d="M11 9h2v6h-2zm0 8h2v2h-2z"/></svg>' : ''}</button>`).join('');
  const fresh=game.inventory.map((piece,i)=>!!piece&&piece!==trayPieces[i]);
  if(markup===trayMarkup&&!fresh.some(Boolean)){updateTrayWarnings();return;}
  if(trayPieces.length&&fresh.length===3&&fresh.every(Boolean))sound.play('deal');
  trayMarkup=markup;tray.innerHTML=markup;trayPieces=[...game.inventory];updateTrayWarnings();tutorial.refresh();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    tray.querySelectorAll<HTMLElement>('.slot').forEach((slot,i)=>{
      if(fresh[i])slot.animate([{opacity:0,transform:'translateY(14px) scale(.88)'},{opacity:1,transform:'translateY(-2px) scale(1.025)',offset:.72},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:320,delay:i*55,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'});
    });
  }
}
function clearPreview() {
  target = null;
  ghost.hidden = true;
  world.showPreview(null, null);
}
function updateTarget(x: number, y: number) {
  if (selected === null) return;
  const piece = game.inventory[selected];
  if (!piece) return;
  const previousTarget=target;
  target = world.cellAt(x, y);
  if(target!==null&&target!==previousTarget&&game.canPlace(piece,target))sound.play('snap');
  world.showPreview(target, piece, target !== null && (game.canPlace(piece, target)&&tutorial.permits(piece,target)));
  ghost.className = piece.tile;
  if (ghost.dataset.shape !== piece.shape.id) {
    ghost.innerHTML = pieceIcon(piece);
    ghost.dataset.shape = piece.shape.id;
  }
  ghost.hidden = (target !== null && piece.tile!=='pet') || !drag?.moved;
  ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}
function place() {
  if (selected === null || target === null) return false;
  const piece = game.inventory[selected] as Piece;
  if(!piece||(game.over&&(piece.tile!=='pet')))return false;
  if(!tutorial.permits(piece,target)){sound.play('reject');return false;}
  const oldMultiplier=game.combo,scoreBeforePlacement=game.score;
  if (!game.place(selected, target)){sound.play('reject');return false;}
  if(piece.tile!=='pet'&&piece.tile!=='forge'){resetGain();shownScore=scoreBeforePlacement;if(oldMultiplier>1)combo.finish(0);else combo.reset();shownCombo=0;}
  if(piece.tile!=='pet'&&piece.tile!=='forge'&&!tutorial.guiding)playedBeyondIntro=true;
  tutorial.placed(piece,target);
  world.addPiece(target, piece);
  if(game.over){selected=null;clearPreview();renderTray();return true;}
  const aftermath=new Aftermath(()=>{aftermaths.delete(aftermath);settled();},game.comboRun);
  if(piece.tile!=='pet'&&piece.tile!=='forge')game.queuePetActions(()=>{aftermath.retain();return()=>aftermath.release();});
  aftermaths.add(aftermath);
  reactions.schedule(1,aftermath);aftermath.release();
  status.textContent = `${piece.tile} ${piece.shape.name} placed. ${game.inventory.filter(Boolean).length} tiles available.`;
  selected = null;
  clearPreview();
  renderTray();
  settled();
  return true;
}
tray.addEventListener('pointerdown', event => {
  if (!event.isPrimary || drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  event.preventDefault();
  host!.classList.add('dragging');tutorial.beginDrag();sound.play('pick');
  selected = Number(button.dataset.slot);

  // Capture on the persistent tray so replacing its buttons cannot lose the drag.
  tray.setPointerCapture(event.pointerId);
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false, offset: event.pointerType === 'touch' ? 48 : 0 };
  renderTray();
}, { signal: events.signal });
window.addEventListener('pointermove', event => {
  if (drag) {
    if (event.pointerId !== drag.pointer) return;
    drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5;
    updateTarget(event.clientX, event.clientY - (drag.moved ? drag.offset : 0));
  } else if (selected !== null) updateTarget(event.clientX, event.clientY);
}, { signal: events.signal });
window.addEventListener('pointerup', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  if (drag.moved) {
    updateTarget(event.clientX, event.clientY - drag.offset);
    if(target===null||(game.over&&(selected===null||game.inventory[selected]?.tile!=='pet')))sound.play('reject');
    place();
    selected = null;
  }
  drag = null;
  host!.classList.remove('dragging');tutorial.endDrag();
  clearPreview();
  renderTray();
}, { signal: events.signal });
function cancel() {
  host!.classList.remove('dragging');tutorial.endDrag();
  drag = null;
  selected = null;
  clearPreview();
  renderTray();
}
window.addEventListener('pointercancel', cancel, { signal: events.signal });
window.addEventListener('blur', cancel, { signal: events.signal });
window.addEventListener('resize', ()=>{cancel();updateScore();}, { signal: events.signal });
window.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); }, { signal: events.signal });
// Tap a tray tile, then tap the board is also supported.
board.addEventListener('pointerdown', event => {
  if (!event.isPrimary || selected === null || drag) return;
  updateTarget(event.clientX, event.clientY);
  place();
}, { signal: events.signal });
tray.addEventListener('click', event => {
  if (event.detail !== 0) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (button && !button.disabled) { tutorial.beginDrag();sound.play('pick');selected = Number(button.dataset.slot);
 renderTray(); }
}, { signal: events.signal });
document.addEventListener('click',event=>{if((event.target as HTMLElement).closest('.tutorial-close,.tutorial-done,[data-phase],#goal-hint button'))sound.play('ui');},{signal:events.signal});
if(bossTestMode){seedBossTest(game,world,testBossElement);announcedEggs=game.rewardsDealt;}
  if(bushTestMode){seedBushTest(game,world);announcedEggs=game.rewardsDealt;}
  if(forgeTestMode){seedForgeTest(game,world);announcedEggs=game.rewardsDealt;}
const disposeBossTest=bossTestMode?bossTestControls(element=>{testBossElement=element;restartRun();},()=>{if(!game.over)game.pets.forEach(p=>{if(!p.busy)p.queueAbility(game.comboRun);});}):()=>{};
const disposeBushTest=bushTestMode?bushTestControls(restartRun,()=>{game.inventory=['water','lava','bush'].map(tile=>({tile,shape:{id:'single',name:'Single',width:1,height:1,cells:[[0,0]]}})) as import('./game').Piece[];renderTray();}):()=>{};
const disposeForgeTest=forgeTestMode?forgeTestControls(game,world,restartRun,renderTray,()=>{clearTimeout(endTimer);endTimer=undefined;endDialog.hidden=true;endDialog.append(again);document.querySelector('#revive-offer')!.prepend(reviveButton);host!.classList.remove('ended','won','reviewing');}):()=>{};
const disposeScoreTest=sandboxMode?scoreTestControls(amount=>{
  if(game.over)return false;
  game.score+=amount;game.claimEggRewards();settled();renderTray();return true;
},()=>game.score,()=>REWARD_GOALS[game.rewardsDealt],restartRun,amount=>{
  if(!progression.addTestGems(amount))return false;
  progressUI.render();refreshRevive();return true;
},()=>progression.gems,()=>game.berriesGrown,value=>{game.berriesGrown=value;},()=>game.bushShapeLimit):()=>{};
tutorial.start();updateScore();renderTray();
if (import.meta.hot) import.meta.hot.dispose(() => { aftermaths.forEach(a=>a.cancel());aftermaths.clear();events.abort();disposeBossTest();disposeBushTest();disposeScoreTest();disposeForgeTest();sound.dispose();tutorial.dispose();progressUI.dispose();disposeNotices();noSpace.dispose(); reactions.dispose(); sweeps.dispose(); clearTimeout(endTimer);clearTimeout(unlockTimer);clearTimeout(gainTimer); combo.dispose();bossReward.reset(); world.dispose(); });
