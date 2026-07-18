# Erosion

**▶ Live demo — [apps.charliekrug.com/erosion](https://apps.charliekrug.com/erosion/)**

*Watch water carve terrain, live in your browser.*

[![CI](https://github.com/ctkrug/erosion/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/erosion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-c98a3f.svg)](LICENSE)

A real-time procedural terrain generator. Layered simplex noise builds a
heightmap, then an actual hydraulic erosion simulation (thousands of simulated
water droplets carrying and depositing sediment) carves it into valleys and
ridgelines live, in WebGL, as you drag a slider.

![Erosion carving a WebGL2 terrain mesh live](docs/screenshot.png)

This is not a noise-texture demo. The terrain you see genuinely erodes: droplets
spawn on the heightmap, flow downhill under a simplified physical model, pick up
sediment where they accelerate, and drop it where they slow down. Run enough of
them and a bumpy random field turns into something that looks geologically real.

## The wow moment

Push the erosion-strength slider from 0 toward its max on a freshly generated
noise field and watch it self-organize into river valleys and ridgelines within
a couple of seconds. No page reload, no precomputed animation, just the
simulation running live in front of you.

## Why it exists

Most procedural-terrain demos on the web stop at layered noise: pretty, but
static and obviously synthetic. Real terrain is not random. It is the residue of
water moving downhill over a very long time. Adding erosion physics is what makes
terrain look *carved* rather than *bumpy*, and doing it live (not as an offline
bake) is what makes it worth touching: drag one slider and rivers and ridges
appear.

## What it does

- **Live-tunable noise.** Seed, octaves, frequency, lacunarity, and persistence
  are all sliders, and the heightmap regenerates the instant you move one.
- **Real hydraulic erosion.** A droplet-based simulation (position, velocity,
  water volume, sediment capacity, per-step deposition and erosion) runs every
  animation frame the strength slider is above zero. Total heightmap mass is
  conserved exactly, so the terrain redistributes rather than drifts.
- **Raw WebGL2 rendering.** The heightmap draws as a shaded 3D mesh with
  per-vertex normals and an elevation and slope color ramp (water, grass, rock,
  snowcap), no three.js in the stack.
- **Orbit and zoom.** Mouse-drag and one-finger touch orbit the camera; scroll
  wheel and pinch zoom; a slow auto-rotate resumes after a couple of seconds of
  no input.
- **A status readout that means something.** It tracks the simulation's real
  state ("stable", "eroding…", or "converged" once the terrain settles), with a
  contour-ring flourish that pulses from the viewport bezel when erosion engages.
- **Synthesized sound.** WebAudio-generated SFX (no audio files): a throttled
  trickle during active erosion, a low thud on regenerate, and a rising chime
  when the terrain converges, with a mute toggle that persists across reloads.

## Run it locally

```
npm install
npm run dev      # local dev server
npm run build    # static build in dist/, relative-path assets
npm test         # vitest: noise, erosion, mesh, mat4, camera, audio, convergence, controls
```

## How it is built

- Vanilla JavaScript (ES modules), no framework.
- WebGL2 for rendering, raw GL with no three.js dependency, so the erosion math
  and the render loop are both fully inspectable in one small codebase.
- Vite for the dev server and static build.
- Vitest for unit tests. The noise and erosion logic is pure and testable
  independent of the GPU, and the nine core modules are covered at 100% line and
  branch.

See [`docs/VISION.md`](docs/VISION.md) for the full rationale,
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the code map, and
[`docs/DESIGN.md`](docs/DESIGN.md) for the visual direction.

## License

MIT. See [`LICENSE`](LICENSE).

---

More of Charlie's projects → [apps.charliekrug.com](https://apps.charliekrug.com)
</content>
</invoke>
