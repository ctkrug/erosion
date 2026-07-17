# Backlog

Stories are marked `[ ]` to start. Every story lists concrete, verifiable
acceptance criteria — build implements to them, QA attacks them.

## Epic 1 — Core erosion simulation (the wow moment)

- [x] **1.1 Live erosion carves the terrain (WOW MOMENT)**
  - Dragging the erosion-strength slider from 0 to max on the default seed
    visibly changes the heightmap's silhouette within ~3 seconds.
  - Setting strength back to 0 halts further erosion (heightmap stops
    changing) while noise regeneration still works.
  - The droplet simulation runs per animation frame without blocking the
    main thread beyond the default frame budget (~16ms) at default droplet
    count.

- [x] **1.2 Droplet hydraulic erosion simulation core**
  - `erodeStep(heightmap, params)` mutates the heightmap in place, tracing a
    droplet downhill via the local gradient and applying erosion/deposition.
  - Unit test confirms total heightmap mass (sum of all heights) stays within
    a small tolerance after N droplets — erosion and deposition roughly
    balance rather than the field draining to zero or exploding.
  - Given a synthetic bowl heightmap vs. a synthetic uniform slope, droplets
    measurably deepen the bowl's local minimum and deposit sediment at the
    slope's run-out zone (covered by a unit test on both fixtures).

- [x] **1.3 Noise heightmap parameter controls**
  - Changing the seed regenerates a visibly different heightmap; the same
    seed with the same parameters always regenerates the identical map.
  - Octave/frequency/lacunarity/persistence sliders regenerate the heightmap
    live, without a page reload.

- [x] **1.4 Design polish — control console & viewport bezel**
  - Every slider and select has themed hover/focus-visible/active states
    matching `docs/DESIGN.md` tokens — no unstyled native widgets.
  - The viewport renders with the brass bezel + inset shadow treatment from
    `docs/DESIGN.md` at both 1440px and 390px widths.

## Epic 2 — WebGL rendering

- [x] **2.1 WebGL2 mesh renderer for the heightmap**
  - The heightmap renders as a shaded 3D mesh with per-vertex normals (not a
    flat 2D texture preview).
  - The canvas renders at `devicePixelRatio × CSS size` and recomputes on
    window resize without stretching or blurring.

- [ ] **2.2 Camera orbit/zoom controls**
  - Mouse drag orbits the camera around the terrain's center; scroll/pinch
    zooms in and out, bounded to a sane min/max distance.
  - Touch drag and pinch produce equivalent orbit/zoom behavior on a phone
    viewport.

- [x] **2.3 Elevation- and slope-based color ramp**
  - Low elevation renders in the water tone, mid elevation in rock/grass
    tones, high elevation in the snowcap tone, per `docs/DESIGN.md`.
  - Steep slopes get a visibly distinct rock tint compared to flat areas at
    the same elevation.

- [ ] **2.4 Live mesh update loop tied to the erosion simulation**
  - The vertex buffer updates every frame the simulation runs, with no full
    page or WebGL context reinitialization.
  - Frame rate stays above 30fps at the default droplet batch size on a
    mid-tier laptop (manually verified and noted in QA).

## Epic 3 — Interaction, feedback & sound

- [ ] **3.1 Brass control console with live readouts**
  - Every slider displays its current numeric value live next to the
    control as it's dragged.
  - The console collapses to the bottom-sheet drawer layout at 390px width
    per `docs/DESIGN.md`'s layout intent.

- [ ] **3.2 Contour-ring signature flourish + status readout**
  - The contour-ring pulse animates outward from the viewport bezel when
    erosion strength moves off zero.
  - A status label transitions between "stable," "eroding…," and "converged"
    text states as the simulation runs and settles.
  - `prefers-reduced-motion` disables the pulse animation while still
    updating the status text.

- [ ] **3.3 Synth WebAudio SFX + mute toggle**
  - A rate-throttled "trickle" tick sound fires during active erosion
    (not once per individual droplet).
  - The mute toggle's state persists to `localStorage` across reloads.
  - The `AudioContext` is created lazily on first user gesture, and the app
    does not throw in environments without WebAudio (e.g. the test runner).

- [x] **3.4 Design polish — responsive composition pass**
  - No horizontal scroll or overlapping elements at 390px, 768px, or 1440px.
  - A custom favicon and wordmark match `docs/DESIGN.md`'s brass/slate
    direction — no default globe icon.

## Epic 4 — Polish, reset & ship readiness

- [x] **4.1 Reset / regenerate controls**
  - A "regenerate terrain" action reseeds noise and clears erosion state
    back to a fresh heightmap.
  - The reset action's affordance uses the rust-red danger token from
    `docs/DESIGN.md`.

- [x] **4.2 Static build & subpath-hosting readiness**
  - `npm run build` outputs a single `dist/` directory whose `index.html`
    and asset references contain no leading-`/` (absolute) paths.
  - The built `dist/` output loads and renders correctly when served from a
    non-root subpath locally.

- [ ] **4.3 Landing polish & README screenshot**
  - `README.md` includes an actual screenshot or GIF of the live erosion
    effect in action.
  - `docs/DESIGN.md` is cross-checked against the shipped UI, with any
    discrepancy either fixed or explicitly noted in QA.
