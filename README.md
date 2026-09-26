# Splashy Rock

A minimal Three.js map, ready to build on. Uses the same TypeScript + Vite + Three.js foundation as Diggy Splash, with its 8×8 grid (two world units per cell), 34° perspective lens, and fixed 60° camera tilt.

The initial scene contains only a gray grid on a charcoal background. Map construction lives in `src/map.ts`; camera, responsive framing, and rendering live in `src/world.ts`. No gameplay or assets are imported from Diggy Splash.

Run `npm install`, then `npm run dev`. Run `npm run build` for a checked production build.

Live game: https://stevenaram.github.io/SplashyRock/

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The workflow can also be started manually from the Actions tab.
