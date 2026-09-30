# Splashy Rock

A minimal Three.js map, ready to build on. Uses the same TypeScript + Vite + Three.js foundation as Diggy Splash, with its 8×8 grid (two world units per cell), 34° perspective lens, and fixed 60° camera tilt.

The board is a sandy island with water (blue) and lava (orange) pieces. Drag a piece from the three-slot tray onto the board, or tap a piece and then a cell. Every occupied square of the shape must fit on an empty board cell; gaps in the shape are preserved. A snapped preview shows the destination; red indicates a collision or a piece extending beyond the board. Touch drags lift the preview above the finger. Every tray has two water pieces and one lava piece, or two lava pieces and one water piece, in random order. All three pieces must be used before the tray refills. Inventory icons use one shared divider per neighboring pair, without inset squares.

The tray sits below the board in portrait and to the side in landscape. The camera fits the full grid to the remaining space with a small gutter.

Map construction lives in `src/map.ts`; camera and rendering in `src/world.ts`; board and inventory rules in `src/game.ts`; pointer interaction in `src/main.ts`. No gameplay or assets are imported from Diggy Splash.

Run `npm install`, then `npm run dev`. Run `npm test` for placement and inventory checks, and `npm run build` for a checked production build.

Live game: https://stevenaram.github.io/SplashyRock/

GitHub Actions builds and deploys to GitHub Pages on every push to `main`. The workflow can also be started manually from the Actions tab.

## Shape catalog

`src/shapes.ts` contains the 23 distinct shapes from the replacement reference's 25 drawings, with their original orientations. The two seven-cell diagonal blocks are each drawn twice and share catalog entries. Each shape can be dealt in either water or lava.

- Four three-square corners, a single square, horizontal/vertical threes, and a five-square cross.
- Four five-square cups and four five-square staircases.
- Two seven-square diagonal blocks.
- Two diagonal double crosses, a tall cross, and a wide cross (eight squares each).
- A solid nine-square block.

Four-cell-wide or tall icons scale to fit the same tray slots and retain single shared dividers.

The pointer anchors the center cell of the shape's bounding box; the full footprint is highlighted before release. Tests verify the catalog against all 25 replacement reference drawings and cover every shape's occupancy, bounds, gaps, and atomic placement.

## Stone reaction

An empty cell sharing an edge with at least one water tile and one lava tile becomes stone 500 ms after the qualifying placement. Diagonal neighbors do not count. This neighboring-cell reaction does not replace occupied cells. A cell filled during the delay remains its placed element. Before its sand sweep, stone uses the supplied swatch color `#F8D9C1` for its outline with a darker brown fill (`#89715E`) and a cluster of low-poly boulders, blocks future placement, and is never dealt in the tray. Placement previews show only the held piece, with no forecast of stone reactions. `src/reactions.ts` owns the delayed callbacks and cancels them on disposal.

## Island art

The original camera, grid coordinates, framing, and responsive tray layout are preserved. A procedural sandy island sits under the grid, surrounded by a polygonal beach, wet sand, foam, turquoise shallows, and blue ocean. Palms, shells, and beach rocks are decorative and stay outside the playable footprint. Placed pieces use textured water, glowing-colored lava fissures, and faceted stone clusters.

`src/island.ts` generates the low-poly scenery and pixel textures at 32 texels per world unit, using nearest filtering and deterministic seeds. No external image assets or additional dependencies are required. A capped 30 fps animation loop drives water, lava, shoreline motion, ripples, splashes, and steam; it pauses while the page is hidden and respects reduced-motion preferences. Static shadows are refreshed only when needed.

## Connected pixel surfaces

Water and lava connect across same-element cell boundaries, including pieces placed in separate turns. A single world-aligned surface shader removes internal borders and animates continuous pools at 32 texels per world unit. Lava and water remain distinct; their shared empty neighbors still turn to stone after 500 ms.

The entire Three.js scene is rendered through a nearest-neighbor pixel pass calibrated to 512 logical pixels across the 16-unit board (capped at the screen's resolution), then mapped to a fixed 34-color palette. This applies to geometry, lighting, shadows, particles, and textures. Placement adds short pixel splashes and ripples; stone formation adds a small steam puff. No effects appear in the placement forecast.

## Sand sweeps (no line mechanics)

Full rows and columns of water, lava, or stone have no special effect. There are no line clears, board conversions, resets, or line bonuses.

Every newly created stone holds for 500 ms, then is covered in sand and cleared. A directional sand wave reaches its horizontal and vertical neighbors 280 ms later and clears occupied cells there. Diagonals are untouched. Overlapping waves award points only once per occupied cell. The normal neighboring-water/lava reaction remains the only source of new stone.

Placement previews sit on the grid plane with exact two-unit cell bounds and never forecast stone creation.

## Score and runs

- One point per square placed.
- Twenty points per stone formed by neighboring water/lava.
- Ten points per occupied square returned to sand by a stone sweep.

A run ends only when none of the remaining inventory pieces can legally fit anywhere, after pending reactions and both stages of sand sweeps have finished. The result panel shows final score, locally saved best score, and Play Again. Restart cancels all timers, clears the board and effects, resets the score, and deals a fresh mixed tray. Reduced-motion preferences suppress the animation without changing timing or rules.

### Boat construction sandbox

Open `?test=boat` (or `?test=forge`) for eight pets, the forge reward, score/gem/berry controls, ready-to-build setup, forge stock controls, and boat progress presets. The boat uses 1,985 individually delivered bricks: an outward-flared hull followed by the deck. Every normal shape assigns available forge bricks before berries; each delivery then attempts a bush-safe obsidian-shard blast. Canceling an unfinished delivery releases its construction reservation and refunds its carried brick when storage has room. The deck never occupies gameplay cells. Completing the boat and its pending reactions triggers the launch celebration and victory.
