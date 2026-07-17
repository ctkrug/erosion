# Architecture

A concise map of the codebase for anyone (including a future session) picking
this up cold. See [`docs/VISION.md`](VISION.md) for *why*, [`docs/DESIGN.md`](DESIGN.md)
for the visual direction, and [`docs/BACKLOG.md`](BACKLOG.md) for what's left.

## Data flow

```
controls.js (specs)
      │
      ▼
main.js ──builds sliders──▶ DOM (index.html)
      │
      ├─ regenerate ──▶ noise.js + heightmap.js ──▶ Float32Array heightmap
      │
      ├─ every rAF, if strength > 0:
      │     erosion.js:erodeStep() × strength, mutating the heightmap in place
      │
      ├─ mesh.js:updateMeshHeights() ──▶ positions/normals typed arrays
      │
      └─ renderer.js:TerrainRenderer ──▶ WebGL2 draw call
```

The heightmap (`Float32Array`, `size * size`, values roughly in `[0, 1]`, though
erosion can push individual cells slightly outside that range) is the single
source of truth. Noise writes it, erosion mutates it, the mesh module reads it
to rebuild vertex Y-positions and normals every frame erosion runs.

## Modules

- **`src/noise.js`** — deterministic 2D Simplex noise (`SimplexNoise2D`), fbm
  layering, and `createRng` (a shared seeded xorshift32 PRNG used anywhere
  else in the app that needs reproducible randomness).
- **`src/heightmap.js`** — `generateHeightmap(size, params)`: builds a
  normalized `[0, 1]` heightmap from layered noise.
- **`src/erosion.js`** — `erodeStep(heightmap, size, rng, params)`: simulates
  one droplet's full lifetime (the "virtual pipes" hydraulic erosion model),
  mutating the heightmap in place. Erosion/deposition amounts are hard-capped
  per step (`maxChangePerStep`) — without that cap the sim is numerically
  unstable (a cell eroded slightly deeper than its neighbor presents a bigger
  slope to the next droplet, compounding into runaway values within a few
  hundred droplets; see the commit that introduced the cap for the full story).
- **`src/mesh.js`** — pure heightmap → WebGL mesh conversion: `buildMesh`
  (full rebuild: positions/normals/uvs/indices) and `updateMeshHeights` (just
  positions/normals, called every erosion frame so indices/uvs aren't
  reallocated).
- **`src/mat4.js`** — minimal dependency-free 4x4 matrix math (identity,
  multiply, perspective, lookAt) for the camera. No three.js/gl-matrix, per
  `docs/VISION.md`'s "raw WebGL2" decision.
- **`src/renderer.js`** — `TerrainRenderer`: compiles the shader program
  (diffuse lighting + elevation/slope color ramp), owns the GL buffers, and
  exposes `setMesh` (topology change) / `updateMesh` (per-frame data refresh)
  / `render`. GPU-dependent — not covered by the unit suite, verified manually
  in a browser instead (see the QA section of the design standard).
- **`src/controls.js`** — declarative slider specs (`NOISE_CONTROLS`,
  `EROSION_CONTROLS`) that both `main.js`'s DOM builder and the tests read
  from, so bounds/defaults can't drift out of sync.
- **`src/main.js`** — orchestration: builds controls from specs, owns the
  `requestAnimationFrame` loop, wires noise-param changes to
  `regenerateHeightmap()`, wires the strength slider to the erosion loop and
  the status readout/contour-ring pulse, falls back to a designed error panel
  if WebGL2 isn't available.
- **`src/style.css`** — the design system from `docs/DESIGN.md`: color/spacing
  custom properties, the viewport bezel, the control console, responsive
  breakpoints at 860px/480px.

## Testing

Everything GPU-independent is unit-tested with Vitest (`npm test`):
noise determinism, heightmap normalization, erosion mass-conservation/
stability/carving behavior against synthetic fixtures, mesh geometry and
normal math, mat4 math, and control-spec invariants. `renderer.js` and the
DOM wiring in `main.js` are exercised manually in a browser (see the design
standard's QA self-review) since they need a real WebGL2 context and DOM.

## Build

`npm run build` runs `vite build` with `base: './'`, producing a static,
relative-path `dist/` — no server-side component, servable from a subpath
(e.g. `apps.charliekrug.com/erosion/`).

## Known gaps (see docs/BACKLOG.md)

- Camera is a fixed slow auto-rotate; no mouse/touch orbit/zoom yet.
- No WebAudio SFX or mute toggle yet.
- The control console stacks below the viewport on phone rather than the
  drag-handle bottom sheet described in `docs/DESIGN.md`.
