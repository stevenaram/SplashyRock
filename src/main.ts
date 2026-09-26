import './style.css';
import { World } from './world';
import { Game, type Tile } from './game';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Missing game container');
host.innerHTML = `<section id="board" aria-label="Eight by eight board"></section>
  <nav id="tray" aria-label="Available tiles"></nav>
  <div id="ghost" aria-hidden="true" hidden></div>
  <p id="status" role="status" class="sr-only"></p>`;
const board = document.querySelector<HTMLElement>('#board')!;
const tray = document.querySelector<HTMLElement>('#tray')!;
const ghost = document.querySelector<HTMLElement>('#ghost')!;
const status = document.querySelector<HTMLElement>('#status')!;
const world = new World(board);
const game = new Game();
const events = new AbortController();
let selected: number | null = null;
let drag: { pointer: number; x: number; y: number; moved: boolean; offset: number } | null = null;
let target: number | null = null;

function renderTray() {
  tray.innerHTML = game.inventory.map((tile, index) => `<button class="slot ${tile ?? 'used'}" data-slot="${index}"
    aria-label="${tile ? `${tile} tile ${index + 1}` : 'Used tile'}" aria-pressed="${selected === index}"
    ${tile ? '' : 'disabled'}><span class="tile-icon"></span></button>`).join('');
}
function clearPreview() {
  target = null;
  ghost.hidden = true;
  world.showPreview(null, 'water');
}
function updateTarget(x: number, y: number) {
  if (selected === null) return;
  const tile = game.inventory[selected];
  if (!tile) return;
  target = world.cellAt(x, y);
  world.showPreview(target, tile, target !== null && game.canPlace(target));
  ghost.className = tile;
  ghost.hidden = target !== null || !drag?.moved;
  ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}
function place() {
  if (selected === null || target === null) return false;
  const tile = game.inventory[selected] as Tile;
  if (!game.place(selected, target)) return false;
  world.addTile(target, tile);
  status.textContent = `${tile} placed. ${game.inventory.filter(Boolean).length} tiles available.`;
  selected = null;
  clearPreview();
  renderTray();
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
if (import.meta.hot) import.meta.hot.dispose(() => { events.abort(); world.dispose(); });
