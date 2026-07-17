# Vision

## The problem

Procedural terrain demos on the web almost universally stop at layered
Perlin/Simplex noise: a heightmap that looks bumpy and random, sometimes with a
color ramp for "snow" and "grass." It photographs fine in a screenshot but it
never reads as *real* terrain, because real terrain isn't random — it's the
residue of millions of years of water moving downhill, picking up sediment,
and dropping it somewhere else. Noise alone has no memory of water. Erosion is
what turns "random bumps" into "this looks like a place."

Most projects that do simulate erosion do it offline, as a preprocessing bake
you can't interact with — you get before/after screenshots, not something to
play with. That kills the moment where the physics clicks for the viewer.

## Who it's for

People who land on a portfolio/demo page and want something they can *touch*
in the first five seconds — hobbyist graphics programmers, generative-art
enthusiasts, and anyone curious what "erosion simulation" actually looks like
without opening Blender or reading a paper first. No account, no install, no
loading screen longer than the noise generation itself.

## The core idea

1. Generate a heightmap from layered Simplex noise (seed, octaves, frequency,
   lacunarity, persistence — all live-tunable).
2. Run a droplet-based hydraulic erosion simulation directly on that
   heightmap: spawn a droplet at a random (or brush-selected) point, step it
   downhill using the local gradient, track its water volume, speed, and
   sediment load, and let it erode the surface where it accelerates and
   deposit sediment where it slows or runs out of water. This is the
   well-known "virtual pipes" / droplet erosion model — simplified enough to
   run thousands of iterations per second on the CPU, real enough to produce
   the same drainage patterns and ridgelines as actual rain runoff.
3. Render the live heightmap as a proper shaded 3D mesh in WebGL2, recomputing
   vertex positions and normals as the simulation mutates the heightmap, so
   the carving is visible frame-by-frame rather than as a before/after swap.
4. Expose the erosion strength (droplets simulated per frame) as the headline
   slider: at 0 nothing happens; turning it up visibly starts carving valleys
   and ridgelines within a couple of seconds, converging toward a stable,
   geologically plausible terrain the longer it runs.

## Key design decisions

- **Vanilla JS + raw WebGL2, no three.js/babylon.** The erosion math and the
  render loop are both small enough to be fully inspectable in one codebase,
  and a raw GL2 context keeps the mesh update path (heightmap → vertex
  buffer) direct and cheap — no scene-graph overhead standing between the
  simulation and the frame it renders.
- **Droplet simulation runs on the CPU, in JS, per animation frame** — a
  bounded number of droplets per frame keeps the frame budget predictable
  without requiring a compute-shader/WebGPU dependency. This is the
  "batch size" slider: more droplets per frame = faster visible carving, at
  the cost of frame time.
- **The heightmap is the single source of truth.** Noise generation writes it,
  erosion mutates it in place, and the renderer reads it every frame to
  rebuild vertex Y-positions and normals. No duplicate state to keep in sync.
- **Everything is a live parameter, nothing requires a page reload.** Seed,
  octaves, erosion strength, and droplet count all rebuild or resume the
  simulation from the current UI state — the wow moment depends on sliders
  producing instant, visible feedback.
- **Deterministic, seedable noise and erosion.** Given the same seed and
  parameters, the simulation should be reproducible — useful for testing and
  for sharing an interesting terrain via a seed value later.

## What "v1 done" looks like

- A live WebGL2 scene renders a shaded terrain mesh generated from tunable
  layered noise, with camera orbit/zoom.
- An erosion-strength slider (plus droplet-count and iterations-per-frame
  controls) visibly carves valleys and ridgelines into the mesh in real time,
  converging to a stable, plausible terrain within a few seconds at max
  strength.
- Color responds to elevation and slope (water line, rock, snowcap) so the
  carved terrain reads as terrain, not a gray blob.
- The noise and erosion math are unit-tested independent of the GPU; the
  renderer is manually verified across desktop and phone widths.
- The whole thing builds to a single static, relative-path directory that
  runs with zero server-side component, ready to host at
  `apps.charliekrug.com/erosion`.
