# Splashy Rock

A minimal Three.js map, ready to build on. Uses the same TypeScript + Vite + Three.js foundation as Diggy Splash, with its 8×8 grid (two world units per cell), 34° perspective lens, and fixed 60° camera tilt.

The board is a sandy island with water (blue) and lava (orange) pieces. Drag a piece from the three-slot tray onto the board, or tap a piece and then a cell. Every occupied square of the shape must fit on an empty board cell; gaps in the shape are preserved. A snapped preview shows the destination; red indicates a collision or a piece extending beyond the board. Touch drags lift the preview above the finger. All three pieces must be used before the tray refills. Rows do not clear.

The tray sits below the board in portrait and to the side in landscape. The camera fits the full grid to the remaining space with a small gutter.

Map construction lives in `src/map.ts`; camera and rendering in `src/world.ts`; board and inventory rules in `src/game.ts`; pointer interaction in `src/main.ts`. No gameplay or assets are imported from Diggy Splash.

Run `npm install`, then `npm run dev`. Run `npm test` for placement and inventory checks, and `npm run build` for a checked production build.

Live game: https://stevenaram.github.io/SplashyRock/

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The workflow can also be started manually from the Actions tab.

## Shape catalog

`src/shapes.ts` contains all 17 distinct shapes from the 20 reference drawings, with their original orientations. The repeated diagonal pairs and repeated up-pointing split piece share catalog entries. Each shape can be dealt in either water or lava.

- Four three-square corners.
- Two diagonal pairs.
- Five-square cross, vertical three, horizontal three, and single square.
- Four five-square cups, opening right, left, down, and up.
- Three disconnected three-square pieces pointing up, right, and left.

The pointer anchors the center cell of the shape's bounding box; the full footprint is highlighted before release. Tests verify the catalog against all 20 reference drawings and cover every shape's occupancy, bounds, gaps, and atomic placement.

## Stone reaction

An empty cell sharing an edge with at least one water tile and one lava tile becomes stone 500 ms after the qualifying placement. Diagonal neighbors do not count. Existing water, lava, and stone are never replaced. A cell filled during the delay remains its placed element. Stone uses the supplied swatch color `#F8D9C1` for its outline with a darker brown fill (`#89715E`) and a cluster of low-poly boulders, blocks future placement, and is never dealt in the tray. Placement previews show only the held piece, with no forecast of stone reactions. `src/reactions.ts` owns the delayed callbacks and cancels them on disposal.

## Island art

The original camera, grid coordinates, framing, and responsive tray layout are preserved. A procedural sandy island sits under the grid, surrounded by a polygonal beach, wet sand, foam, turquoise shallows, and blue ocean. Palms, shells, and beach rocks are decorative and stay outside the playable footprint. Placed pieces use textured water, glowing-colored lava fissures, and faceted stone clusters.

`src/island.ts` generates the low-poly scenery and pixel textures at 32 texels per world unit, using nearest filtering and deterministic seeds. No external image assets or additional dependencies are required. A capped 30 fps animation loop drives water, lava, shoreline motion, ripples, splashes, and steam; it pauses while the page is hidden and respects reduced-motion preferences. Static shadows are refreshed only when needed.

## Connected pixel surfaces

Water and lava connect across same-element cell boundaries, including pieces placed in separate turns. A single world-aligned surface shader removes internal borders and animates continuous pools at 32 texels per world unit. Lava and water remain distinct; their shared empty neighbors still turn to stone after 500 ms.

The entire Three.js scene is rendered through a nearest-neighbor pixel pass calibrated to 512 logical pixels across the 16-unit board (capped at the screen's resolution), then mapped to a fixed 34-color palette. This applies to geometry, lighting, shadows, particles, and textures. Placement adds short pixel splashes and ripples; stone formation adds a small steam puff. No effects appear in the placement forecast.
