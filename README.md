# Splashy Rock

A minimal Three.js map, ready to build on. Uses the same TypeScript + Vite + Three.js foundation as Diggy Splash, with its 8×8 grid (two world units per cell), 34° perspective lens, and fixed 60° camera tilt.

The board uses a gray grid on charcoal with water (blue) and lava (orange) tiles. Drag a tile from the three-slot tray onto an empty cell, or tap a tile and then a cell. A snapped preview shows the destination; red indicates an occupied cell. Touch drags lift the preview above the finger. All three tiles must be used before the tray refills. Rows do not clear.

The tray sits below the board in portrait and to the side in landscape. The camera fits the full grid to the remaining space with a small gutter.

Map construction lives in `src/map.ts`; camera and rendering in `src/world.ts`; board and inventory rules in `src/game.ts`; pointer interaction in `src/main.ts`. No gameplay or assets are imported from Diggy Splash.

Run `npm install`, then `npm run dev`. Run `npm test` for placement and inventory checks, and `npm run build` for a checked production build.

Live game: https://stevenaram.github.io/SplashyRock/

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The workflow can also be started manually from the Actions tab.
