# Design

## 1. Aesthetic direction

**Erosion is a field-survey instrument: a topographic surveyor's desk at dusk** —
warm brass control knobs and contour-line paper tones set against a deep
slate-blue "instrument housing," like a cartographer's plane-table crossed with
a scientific instrument panel. Not a game, not a dashboard: a precision tool
for watching geology happen.

This avoids the dark-glassy-card look by leaning into a **warm brass + cartographic
paper** palette instead of blue/purple neon, and avoids flat editorial/paper
looks by keeping the terrain viewport itself as a moody, deep instrument
housing with brass linework — the contrast between the warm control surface
and the cool viewport is the whole personality.

## 2. Tokens

**Color**
- `--bg`: `#171b20` (deep slate-blue-black — the instrument housing)
- `--surface-1`: `#1f252d` (control panel surface)
- `--surface-2`: `#262e38` (raised control surface / panel cards)
- `--text`: `#ede4d3` (warm parchment white)
- `--text-muted`: `#9aa3ad` (cool muted gray-blue, for secondary labels)
- `--accent`: `#c98a3f` (brass/amber — sliders, active states, wordmark glyph)
- `--accent-support`: `#5fa3a3` (muted teal — water/erosion indicator, contrast to brass)
- `--success`: `#7fb069` (moss green — stable/converged terrain state)
- `--danger`: `#c1543c` (rust red — reset/destructive actions)

**Type**
- Display: `"Fraunces"` (Google Fonts) — a warm, high-contrast serif for the
  wordmark and headings, evoking old survey-report typography.
- UI: `"IBM Plex Sans"` (Google Fonts) — clean, slightly technical grotesque
  for labels, slider values, and body copy. System fallback stack:
  `-apple-system, "Segoe UI", sans-serif`.
- Scale: 1.25 ratio — 13 / 16 / 20 / 25 / 31 / 39px.

**Spacing / shape / motion**
- Spacing unit: 8px scale (8/16/24/32/48/64).
- Corner radius: 6px on controls and panels (slightly rounded, not pill-shaped
  — instrument-panel feel, not app-store feel).
- Shadow/depth: soft inset shadow on recessed controls (sliders, selects),
  soft drop shadow + 1px brass-tinted top highlight on raised panels — brass
  hardware should look machined, not flat.
- Motion: UI transitions 150ms ease-out; slider drag feedback and terrain
  recompute indicator pulse 80–120ms ease-out.

## 3. Layout intent

The **terrain viewport is the hero**: a full-bleed WebGL canvas occupying the
majority of the screen, styled as a recessed instrument window (inset shadow,
thin brass bezel). Controls live in a **fixed side panel** (desktop) that reads
like a control console bolted to the housing — grouped sliders for noise
(seed/octaves/frequency) and erosion (strength/droplets/iterations), each with
a live numeric readout in brass.

- **1440×900 desktop:** viewport takes the left ~70%, control console a fixed
  ~380px panel on the right, full height, scrollable if needed. Wordmark +
  status readout ("stable" / "eroding…") sits atop the console.
- **390×844 phone:** console collapses to a bottom sheet (peek height ~120px,
  drag handle to expand) below the full-width, ~60vh viewport — the terrain
  stays primary, controls become a secondary drawer rather than stacking
  above the fold.

## 4. Signature detail

A **live contour-line overlay** etched in brass over the terrain viewport's
bezel corners (thin animated topographic rings that pulse outward briefly
whenever erosion strength changes) — the one flourish that ties the
cartographic theme to the live simulation, reinforcing "this is a survey
instrument reading a landscape," not a generic 3D viewer.

## 5. Juice plan (interactive toy, not a game — scoped accordingly)

- **Slider drag**: brass knob has an immediate (<100ms) value readout update;
  thumb gets a subtle glow + 1px lift on active drag, 120ms ease-out release.
- **Erosion engaging**: when strength moves off zero, the contour-ring
  flourish (see above) pulses once from the viewport bezel; a status label
  transitions "stable" → "eroding…" with a soft crossfade.
- **Convergence**: when the simulation settles (delta height below threshold
  for N frames), the status label crossfades to "stable" and the contour
  rings pulse once in the success moss-green.
- **Sound**: WebAudio-synthesized, subtle, rate-throttled — a soft granular
  "trickle" tick (short filtered noise burst) on each batch of droplets
  processed, a low soft thud when a reset/regenerate fires, and a gentle rising
  tone on convergence. All behind a mute toggle (brass speaker glyph) persisted
  to `localStorage`; `AudioContext` created lazily on first user gesture and
  guarded for environments without WebAudio (tests, headless).
- Respects `prefers-reduced-motion`: disables the contour-ring pulse and
  slider glow animation, keeps instant value updates and sound (sound is not
  motion).
