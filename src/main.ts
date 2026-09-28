import {seenTips} from './seen-tips';
import {SoundEngine} from './sound';
import {Tutorial} from './tutorial';
import {EGG_GOALS,MAX_PETS} from './egg-goals';
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
host.innerHTML = `<header id="run-hud"><div id="hud"><span>SCORE</span><strong id="score">0</strong><span id="score-gain" aria-hidden="true"></span></div><div id="egg-goal" role="progressbar"><img alt=""/><div class="egg-track"><i></i></div><strong></strong><span class="egg-pending"></span></div></header><section id="board" aria-label="Eight by eight board"></section>
  <div id="egg-unlocked" role="status" hidden><img alt=""/><strong>Egg Unlocked</strong></div>
  <nav id="tray" aria-label="Available tiles"></nav><p id="inventory-end-note">No space left.</p>
  <div id="ghost" aria-hidden="true" hidden></div>
  <p id="status" role="status" class="sr-only"></p>
  <aside id="game-over" hidden aria-labelledby="end-title"><button id="close-game-over" type="button" aria-label="Close Game Over and review board"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button><h1 id="end-title">Game Over</h1><div class="end-scores"><p><span>Score</span><strong id="final-score">0</strong></p><i aria-hidden="true"></i><p><span>Best</span><strong id="best-score">0</strong></p></div><button id="play-again" type="button">Play again <span aria-hidden="true">↻</span></button></aside>`;
const sound=new SoundEngine();
const soundButton=document.createElement('button');soundButton.id='sound-toggle';soundButton.type='button';
soundButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="sound-waves" d="M16 8q5 4 0 8m3-11q8 7 0 14"/><path class="sound-off" d="m16 9 6 6m0-6-6 6"/></svg>';
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
  announcedEggs=game.rewardsDealt;renderTray();unlock.hidden=false;
  unlock.getAnimations().forEach(a=>a.cancel());
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)unlock.animate([{opacity:0,transform:'translate(-50%, 8px) scale(.9)'},{opacity:1,transform:'translate(-50%, -2px) scale(1.03)',offset:.7},{opacity:1,transform:'translate(-50%, 0) scale(1)'}],{duration:480,easing:'cubic-bezier(.2,.8,.3,1)'});
  clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>{unlock.hidden=true;},2800);
}
let shownCombo=0;
const again=document.querySelector<HTMLButtonElement>('#play-again')!;
let shownScore=0;
let best=0;
try { best=Math.max(0,Number(localStorage.getItem('splashy-rock-best'))||0); } catch {}
let endTimer:ReturnType<typeof setTimeout>|undefined;
function updateScore(){
  const gain=game.score-shownScore;scoreLabel.textContent=game.score.toLocaleString();
  if(gain>0){gainLabel.textContent=`+${gain}`;gainLabel.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)gainLabel.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-14px)'}],{duration:750,fill:'forwards',easing:'cubic-bezier(.2,.7,.3,1)'});}
  // Fit the number inside its reserved column without moving the goal bar.
  const scoreWidth=scoreLabel.clientWidth;
  scoreLabel.style.fontSize=`${Math.min(25,scoreWidth/Math.max(1,scoreLabel.textContent!.length)/.62)}px`;
  shownScore=game.score;
  const earned=game.earnedEggs,index=Math.min(earned,MAX_PETS-1),target=EGG_GOALS[index],previous=index?EGG_GOALS[index-1]:0;
  const progress=earned===MAX_PETS?1:Math.max(0,Math.min(1,(game.score-previous)/(target-previous)));
  goal.style.setProperty('--progress',String(progress));goal.querySelector('strong')!.textContent=earned===MAX_PETS?'64 / 64':target.toLocaleString();
  const pending=Math.max(0,earned-game.rewardsDealt);goal.classList.toggle('ready',pending>0);
  goal.querySelector('.egg-pending')!.textContent=pending?`+${pending}`:'';
  goal.setAttribute('aria-valuemin',String(previous));goal.setAttribute('aria-valuemax',String(target));goal.setAttribute('aria-valuenow',String(Math.min(game.score,target)));goal.setAttribute('aria-label',earned===MAX_PETS?'All egg rewards earned':`Next egg at ${target.toLocaleString()} points`);
}
function showEnd(won=false){
  sound.play(won?'win':'over');
  tutorial.dismiss();tutorial.dismissGoal();
  best=Math.max(best,game.score);try{localStorage.setItem('splashy-rock-best',String(best));}catch{}
  document.querySelector('#end-title')!.textContent=won?'The game is beat!':'Game Over';
  document.querySelector('#final-score')!.textContent=game.score.toLocaleString();document.querySelector('#best-score')!.textContent=best.toLocaleString();
  endDialog.append(again);host!.classList.remove('reviewing');
  endDialog.hidden=false;host!.classList.add('ended');host!.classList.toggle('won',won);
}
function settled(){
  if(!game.won&&game.finishIfWon()){clearTimeout(endTimer);aftermaths.forEach(a=>a.cancel());aftermaths.clear();reactions.dispose();sweeps.dispose();updateScore();showEnd(true);return;}
  // Every committed change (placement, stone creation, either sweep phase)
  // reconciles reactions before deciding whether the board has settled.
  if (!game.over) reactions.schedule();
  if(!reactions.busy&&!sweeps.busy&&game.combo>0){
    const multiplier=game.combo;const bonus=game.finishChain();
    if(multiplier>1)combo.finish(bonus);
    shownCombo=0;
  }
  tutorial.settled(!reactions.busy&&!sweeps.busy);
  game.claimEggRewards();announceEggs();
  updateScore();
  updateTrayWarnings();
  if(game.over||reactions.busy||sweeps.busy||aftermaths.size>0||game.petsBusy||game.hasLegalMove()){
    clearTimeout(endTimer);endTimer=undefined;return;
  }
  // Walking animation updates must not continually postpone this final check.
  if(endTimer!==undefined)return;
  endTimer=setTimeout(()=>{
    endTimer=undefined;
    if(!game.finishIfBlocked(reactions.busy||sweeps.busy||aftermaths.size>0||!!game.petsBusy))return;
    showEnd();
    status.textContent=`Game Over. Final score ${game.score}. You can still try the remaining pieces, or play again.`;
  },400);
}
const world = new World(board);
const combo=new ComboCallout(board,cell=>world.cellScreen(cell));
// The clearing explanation also recognizes players who finished before completion tracking.
const game = new Game(Math.random,()=>seenTips.has('intro-complete')||seenTips.has('clearing'));
world.game=game;world.onPetChange=settled;world.onSound=(cue,cell)=>sound.play(cue,1,cell===undefined?0:(cell%8/7-.5)*.6);
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
  reactions.schedule(depth+1,owner);
  refreshPreview();
},settled);
const reactions = new StoneReactions(game, (cell,owner) => {
  world.addStone(cell);
  if(game.combo>=2&&game.combo>shownCombo){shownCombo=game.combo;combo.show(game.combo,cell);sound.play('combo',game.combo);}
  sweeps.schedule(owner);
  refreshPreview();
},settled);

document.querySelector('#close-game-over')!.addEventListener('click',()=>{
  sound.play('ui');cancel();endDialog.hidden=true;host!.classList.add('reviewing');board.append(again);
  again.focus({preventScroll:true});
}, {signal:events.signal});

again.addEventListener('click',()=>{
  sound.stop();sound.play('restart');
  aftermaths.forEach(a=>a.cancel());aftermaths.clear();
  clearTimeout(endTimer);endTimer=undefined;reactions.dispose();sweeps.dispose();cancel();
  world.removePet();game.restart();world.syncBoard(game.board,false);endDialog.hidden=true;host!.classList.remove('ended','won','reviewing');endDialog.append(again);
  shownCombo=0;combo.reset();announcedEggs=0;clearTimeout(unlockTimer);unlock.hidden=true;
  shownScore=0;gainLabel.textContent='';tutorial.start();updateScore();renderTray();
  tray.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
}, {signal:events.signal});


let blockedSlots=0;
function updateTrayWarnings(){
  let count=0;
  tray.querySelectorAll<HTMLButtonElement>('.slot').forEach((button,index)=>{
    const piece=game.inventory[index],blocked=!!piece&&!game.pieceFits(piece);
    if(blocked)count++;
    button.classList.toggle('blocked',blocked);
    if(blocked&&!game.over)tutorial.showFitWarning(piece);
    button.setAttribute('aria-label',piece?`${piece.tile==='pet'?'Mystery Egg':`${piece.tile} ${piece.shape.name}`}, piece ${index+1}${blocked?', cannot fit on the board right now':''}`:'Used piece');
  });
  if(count>blockedSlots&&!game.over)sound.play('warning');
  blockedSlots=count;
}
function renderTray() {
  tray.classList.toggle('expanded',game.inventory.length>3);
  const markup = game.inventory.map((piece, index) => `<button class="slot ${piece?.tile ?? 'used'}" data-slot="${index}"
    data-pet="${piece?.tile==='pet'?'egg':''}" data-shape="${piece?.shape.id ?? ''}" aria-label="${piece ? `${piece.tile} ${piece.shape.name}, piece ${index + 1}` : 'Used piece'}" aria-pressed="${selected === index}"
    ${piece ? '' : 'disabled'}>${piece ? pieceIcon(piece)+'<svg class="fit-warning" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z"/><path class="warning-mark" d="M11 9h2v6h-2zm0 8h2v2h-2z"/></svg>' : ''}</button>`).join('');
  const fresh=game.inventory.map((piece,i)=>!!piece&&piece!==trayPieces[i]);
  if(markup===trayMarkup&&!fresh.some(Boolean)){updateTrayWarnings();return;}
  if(trayPieces.length&&fresh.length===3&&fresh.every(Boolean))sound.play('deal');
  trayMarkup=markup;tray.innerHTML=markup;trayPieces=[...game.inventory];updateTrayWarnings();
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
  if (game.over || selected === null || target === null) return false;
  const piece = game.inventory[selected] as Piece;
  const pets=[...game.pets];
  if(!tutorial.permits(piece,target)){sound.play('reject');return false;}
  if (!game.place(selected, target)){sound.play('reject');return false;}
  tutorial.placed(piece,target);
  world.addPiece(target, piece);
  const aftermath=new Aftermath(()=>{aftermaths.delete(aftermath);settled();});
  if(piece.tile!=='pet')for(const pet of pets)pet.queueAbility();
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
    if(target===null||game.over)sound.play('reject');
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
tutorial.start();updateScore();renderTray();
if (import.meta.hot) import.meta.hot.dispose(() => { aftermaths.forEach(a=>a.cancel());aftermaths.clear();events.abort();sound.dispose();tutorial.dispose(); reactions.dispose(); sweeps.dispose(); clearTimeout(endTimer);clearTimeout(unlockTimer); combo.dispose(); world.dispose(); });
