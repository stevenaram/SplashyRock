import './style.css';
import { ComboCallout } from './combo-callout';
import { pieceIcon } from './piece-icon';
import { World } from './world';
import { Game, type Piece } from './game';
import { StoneReactions, SandSweeps } from './reactions';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Missing game container');
host.innerHTML = `<section id="board" aria-label="Eight by eight board"><div id="hud"><span>SCORE</span><strong id="score">0</strong><span id="score-gain" aria-hidden="true"></span></div></section>
  <nav id="tray" aria-label="Available tiles"></nav>
  <div id="ghost" aria-hidden="true" hidden></div>
  <p id="status" role="status" class="sr-only"></p>
  <aside id="game-over" hidden aria-labelledby="end-title"><div><h1 id="end-title">No more moves</h1><p><span id="final-score">0</span> points · Best <span id="best-score">0</span></p></div><button id="play-again" type="button">Play again <span aria-hidden="true">↗</span></button></aside>`;
const board = document.querySelector<HTMLElement>('#board')!;
const tray = document.querySelector<HTMLElement>('#tray')!;
const ghost = document.querySelector<HTMLElement>('#ghost')!;
const status = document.querySelector<HTMLElement>('#status')!;
const scoreLabel=document.querySelector<HTMLElement>('#score')!;
const gainLabel=document.querySelector<HTMLElement>('#score-gain')!;
const endDialog=document.querySelector<HTMLElement>('#game-over')!;
let shownCombo=0;
const again=document.querySelector<HTMLButtonElement>('#play-again')!;
let shownScore=0;
let best=0;
try { best=Math.max(0,Number(localStorage.getItem('splashy-rock-best'))||0); } catch {}
let endTimer:ReturnType<typeof setTimeout>|undefined;
function updateScore(){
  const gain=game.score-shownScore;scoreLabel.textContent=game.score.toLocaleString();
  if(gain>0){gainLabel.textContent=`+${gain}`;gainLabel.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion: reduce)').matches)gainLabel.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-14px)'}],{duration:750,fill:'forwards',easing:'cubic-bezier(.2,.7,.3,1)'});}
  shownScore=game.score;
}
function settled(){
  // Every committed change (placement, stone creation, either sweep phase)
  // reconciles reactions before deciding whether the board has settled.
  world.syncPetMarks();
  if (!game.over) reactions.schedule();
  if(!reactions.busy&&!sweeps.busy&&game.combo>0){
    const multiplier=game.combo;const bonus=game.finishChain();
    if(multiplier>1)combo.finish(bonus);
    shownCombo=0;
  }
  updateScore();
  clearTimeout(endTimer);
  if(game.over||reactions.busy||sweeps.busy||game.pet?.busy||game.hasLegalMove())return;
  endTimer=setTimeout(()=>{
    if(!game.finishIfBlocked(reactions.busy||sweeps.busy||!!game.pet?.busy))return;
    world.removePet();
    best=Math.max(best,game.score);
    try{localStorage.setItem('splashy-rock-best',String(best));}catch{}
    document.querySelector('#final-score')!.textContent=game.score.toLocaleString();
    document.querySelector('#best-score')!.textContent=best.toLocaleString();
    endDialog.hidden=false;host!.classList.add('ended');
    status.textContent=`No more moves. Final score ${game.score}. You can still try the remaining pieces, or play again.`;
  },400);
}
const world = new World(board);
const combo=new ComboCallout(board,cell=>world.cellScreen(cell));
const game = new Game();
world.game=game;world.onPetChange=settled;
const events = new AbortController();
let selected: number | null = null;
let drag: { pointer: number; x: number; y: number; moved: boolean; offset: number } | null = null;
let target: number | null = null;
let trayMarkup="";
let trayPieces:(Piece|null)[]=[];
const refreshPreview = () => {
  const piece = selected === null ? null : game.inventory[selected];
  if (piece && target !== null) world.showPreview(target, piece, game.canPlace(piece, target));
};
const sweeps = new SandSweeps(game, (cells, origin, phase, depth) => {
  world.sandSweep(game.board,cells,origin,phase);
  reactions.schedule(depth+1);
  refreshPreview();
},settled);
const reactions = new StoneReactions(game, cell => {
  world.syncPetMarks();
  world.addStone(cell);
  if(game.combo>=2&&game.combo>shownCombo){shownCombo=game.combo;combo.show(game.combo,cell);}
  sweeps.schedule();
  refreshPreview();
},settled);

again.addEventListener('click',()=>{
  clearTimeout(endTimer);reactions.dispose();sweeps.dispose();cancel();
  world.removePet();game.restart();world.syncPetMarks();world.syncBoard(game.board,false);endDialog.hidden=true;host!.classList.remove('ended');
  shownCombo=0;combo.reset();
  shownScore=0;gainLabel.textContent='';updateScore();renderTray();
  tray.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
}, {signal:events.signal});


function renderTray() {
  const markup = game.inventory.map((piece, index) => `<button class="slot ${piece?.tile ?? 'used'}" data-slot="${index}"
    data-pet="${piece?.petElement??''}" data-shape="${piece?.shape.id ?? ''}" aria-label="${piece ? `${piece.tile} ${piece.shape.name}, piece ${index + 1}` : 'Used piece'}" aria-pressed="${selected === index}"
    ${piece ? '' : 'disabled'}>${piece ? pieceIcon(piece) : ''}</button>`).join('');
  const fresh=game.inventory.map((piece,i)=>!!piece&&piece!==trayPieces[i]);
  if(markup===trayMarkup&&!fresh.some(Boolean))return;
  trayMarkup=markup;tray.innerHTML=markup;trayPieces=[...game.inventory];
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
  target = world.cellAt(x, y);
  world.showPreview(target, piece, target !== null && game.canPlace(piece, target));
  ghost.className = piece.tile;
  if (ghost.dataset.shape !== piece.shape.id) {
    ghost.innerHTML = pieceIcon(piece);
    ghost.dataset.shape = piece.shape.id;
  }
  ghost.hidden = target !== null || !drag?.moved;
  ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}
function place() {
  if (game.over || selected === null || target === null) return false;
  const piece = game.inventory[selected] as Piece;
  if (!game.place(selected, target)) return false;
  world.addPiece(target, piece);
  reactions.schedule();
  status.textContent = `${piece.tile} ${piece.shape.name} placed. ${game.inventory.filter(Boolean).length} tiles available.`;
  selected = null;
  clearPreview();
  renderTray();
  settled();
  return true;
}
tray.addEventListener('pointerdown', event => {
  if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  event.preventDefault();
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
    place();
    selected = null;
  }
  drag = null;
  clearPreview();
  renderTray();
}, { signal: events.signal });
function cancel() {
  drag = null;
  selected = null;
  clearPreview();
  renderTray();
}
window.addEventListener('pointercancel', cancel, { signal: events.signal });
window.addEventListener('blur', cancel, { signal: events.signal });
window.addEventListener('resize', cancel, { signal: events.signal });
window.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); }, { signal: events.signal });
// Tap a tray tile, then tap the board is also supported.
board.addEventListener('pointerdown', event => {
  if (selected === null || drag) return;
  updateTarget(event.clientX, event.clientY);
  place();
}, { signal: events.signal });
tray.addEventListener('click', event => {
  if (event.detail !== 0) return;
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (button && !button.disabled) { selected = Number(button.dataset.slot); renderTray(); }
}, { signal: events.signal });
renderTray();
if (import.meta.hot) import.meta.hot.dispose(() => { events.abort(); reactions.dispose(); sweeps.dispose(); clearTimeout(endTimer); combo.dispose(); world.dispose(); });
