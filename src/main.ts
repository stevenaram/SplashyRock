import './style.css';
import { World } from './world';

const host = document.querySelector<HTMLElement>('#game');
if (!host) throw new Error('Missing game container');
const world = new World(host);
if (import.meta.hot) import.meta.hot.dispose(() => world.dispose());
