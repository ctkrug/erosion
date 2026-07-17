import { generateHeightmap } from './heightmap.js';
import { erodeStep } from './erosion.js';
import { createRng } from './noise.js';
import { buildMesh, updateMeshHeights } from './mesh.js';
import { TerrainRenderer } from './renderer.js';
import { NOISE_CONTROLS, EROSION_CONTROLS, defaultParams } from './controls.js';
import { createCameraState, orbitCamera, zoomCamera, cameraEye } from './camera.js';
import { AudioEngine } from './audio.js';
import { createConvergenceTracker, totalAbsoluteDelta } from './convergence.js';

const RESOLUTION = 128;
const HEIGHT_SCALE = 0.6;
const AUTO_ROTATE_SPEED = 0.08;
const AUTO_ROTATE_IDLE_MS = 2200;
const ORBIT_SENSITIVITY = 0.008;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const COLORS = {
  water: hexToRgb('#4f8f8f'),
  grass: hexToRgb('#6b7a48'),
  rock: hexToRgb('#584a37'),
  snow: hexToRgb('#ede4d3'),
};

const viewportEl = document.getElementById('viewport');
const canvas = document.getElementById('terrain');
const statusEl = document.getElementById('status');
const bezelRing = document.querySelector('.bezel-ring');
const muteButton = document.getElementById('mute-toggle');
const muteWaves = document.getElementById('mute-toggle-waves');
const muteSlash = document.getElementById('mute-toggle-slash');

const audioEngine = new AudioEngine();

function syncMuteUI() {
  muteButton.setAttribute('aria-pressed', String(audioEngine.muted));
  muteButton.setAttribute('aria-label', audioEngine.muted ? 'Unmute sound' : 'Mute sound');
  muteWaves.style.display = audioEngine.muted ? 'none' : '';
  muteSlash.style.display = audioEngine.muted ? '' : 'none';
}
syncMuteUI();

muteButton.addEventListener('click', () => {
  audioEngine.ensureContext();
  audioEngine.toggleMuted();
  syncMuteUI();
});

// AudioContext must be constructed inside a real user-gesture handler for
// browsers to allow audio output later (e.g. from the erosion loop, which
// isn't itself a gesture); prime it on whichever gesture comes first.
window.addEventListener('pointerdown', () => audioEngine.ensureContext(), { once: true });
window.addEventListener('keydown', () => audioEngine.ensureContext(), { once: true });

const params = defaultParams();
let heightmap = generateHeightmap(RESOLUTION, params);
let mesh = buildMesh(heightmap.data, RESOLUTION, { heightScale: HEIGHT_SCALE });
let erosionRng = createRng(params.seed);
let convergenceTracker = createConvergenceTracker();

let renderer;
try {
  renderer = new TerrainRenderer(canvas);
  renderer.setMesh(mesh);
} catch (err) {
  showUnsupportedMessage(err);
}

let cameraState = createCameraState();
let lastInteractionAt = -Infinity;

function onUserOrbit(deltaAzimuth, deltaElevation) {
  cameraState = orbitCamera(cameraState, deltaAzimuth, deltaElevation);
  lastInteractionAt = performance.now();
}

function onUserZoom(deltaDistance) {
  cameraState = zoomCamera(cameraState, deltaDistance);
  lastInteractionAt = performance.now();
}

function showUnsupportedMessage(err) {
  const message = document.createElement('div');
  message.className = 'viewport-error';
  message.textContent =
    'This browser doesn’t support WebGL2, so the terrain can’t render here. Try a recent Chrome, Firefox, or Safari.';
  viewportEl.appendChild(message);
  canvas.remove();
  console.error('erosion: WebGL2 init failed', err);
}

function resize() {
  if (!renderer) return;
  const rect = viewportEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  renderer.resize(rect.width, rect.height, dpr);
}

function regenerateHeightmap() {
  heightmap = generateHeightmap(RESOLUTION, params);
  erosionRng = createRng(params.seed);
  mesh = buildMesh(heightmap.data, RESOLUTION, { heightScale: HEIGHT_SCALE });
  convergenceTracker.reset();
  if (renderer) renderer.setMesh(mesh);
}

function formatValue(spec, value) {
  return spec.unit ? `${value} ${spec.unit}` : `${value}`;
}

function pulseBezel() {
  if (!bezelRing) return;
  bezelRing.classList.remove('pulse');
  // Force a reflow so the animation restarts even mid-pulse.
  void bezelRing.offsetWidth;
  bezelRing.classList.add('pulse');
}

let wasEroding = false;
function onStrengthChange(value) {
  const isEroding = value > 0;
  if (isEroding && !wasEroding) {
    pulseBezel();
    convergenceTracker.reset();
    statusEl.textContent = 'eroding…';
  } else if (!isEroding) {
    statusEl.textContent = 'stable';
  }
  wasEroding = isEroding;
}

const isNoiseControl = new Set(NOISE_CONTROLS.map((spec) => spec.key));

function buildControls(containerId, specs) {
  const container = document.getElementById(containerId);
  for (const spec of specs) {
    const row = document.createElement('label');
    row.className = 'control';

    const labelEl = document.createElement('span');
    labelEl.className = 'control-label';
    labelEl.textContent = spec.label;

    const valueEl = document.createElement('span');
    valueEl.className = 'control-value';
    valueEl.dataset.valueFor = spec.key;
    valueEl.textContent = formatValue(spec, params[spec.key]);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'control-range';
    input.id = `control-${spec.key}`;
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(params[spec.key]);

    input.addEventListener('input', () => {
      const value = Number(input.value);
      params[spec.key] = value;
      valueEl.textContent = formatValue(spec, value);
      if (isNoiseControl.has(spec.key)) {
        regenerateHeightmap();
      } else if (spec.key === 'strength') {
        onStrengthChange(value);
      }
    });

    row.append(labelEl, valueEl, input);
    container.appendChild(row);
  }
}

function syncControlUI(key) {
  const input = document.getElementById(`control-${key}`);
  const valueEl = document.querySelector(`[data-value-for="${key}"]`);
  if (!input || !valueEl) return;
  input.value = String(params[key]);
  const spec = [...NOISE_CONTROLS, ...EROSION_CONTROLS].find((s) => s.key === key);
  valueEl.textContent = formatValue(spec, params[key]);
}

buildControls('noise-controls', NOISE_CONTROLS);
buildControls('erosion-controls', EROSION_CONTROLS);

const regenerateButton = document.getElementById('regenerate');
regenerateButton.addEventListener('click', () => {
  params.seed = Math.floor(Math.random() * 9999) + 1;
  syncControlUI('seed');
  regenerateHeightmap();
});

window.addEventListener('resize', resize);
resize();

// Pointer Events unify mouse/pen/touch, so a single active pointer drives
// orbit (works for mouse drag and one-finger touch drag alike). A second
// simultaneous pointer switches to pinch-zoom, tracked by the change in
// distance between the two touch points.
const activePointers = new Map();
const PINCH_ZOOM_SENSITIVITY = 0.012;

function pinchDistance() {
  const points = [...activePointers.values()];
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

canvas.addEventListener('pointerdown', (event) => {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!activePointers.has(event.pointerId)) return;
  const previous = activePointers.get(event.pointerId);

  if (activePointers.size >= 2) {
    const distanceBefore = pinchDistance();
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const distanceAfter = pinchDistance();
    onUserZoom(-(distanceAfter - distanceBefore) * PINCH_ZOOM_SENSITIVITY);
    return;
  }

  const dx = event.clientX - previous.x;
  const dy = event.clientY - previous.y;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  onUserOrbit(-dx * ORBIT_SENSITIVITY, dy * ORBIT_SENSITIVITY);
});

function endDrag(event) {
  activePointers.delete(event.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    onUserZoom(event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  },
  { passive: false }
);

function heightRange(data) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

let lastTime = performance.now();

function frame(now) {
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (renderer) {
    if (params.strength > 0) {
      const before = heightmap.data.slice();
      for (let i = 0; i < params.strength; i++) {
        erodeStep(heightmap.data, RESOLUTION, erosionRng);
      }
      const converged = convergenceTracker.update(totalAbsoluteDelta(before, heightmap.data));
      statusEl.textContent = converged ? 'converged' : 'eroding…';
      updateMeshHeights(heightmap.data, RESOLUTION, { heightScale: HEIGHT_SCALE }, mesh.positions, mesh.normals);
      renderer.updateMesh(mesh);
      audioEngine.playTrickle(now);
    }

    const { min, max } = heightRange(heightmap.data);

    if (activePointers.size === 0 && now - lastInteractionAt > AUTO_ROTATE_IDLE_MS) {
      cameraState = orbitCamera(cameraState, AUTO_ROTATE_SPEED * deltaSeconds, 0);
    }

    renderer.render({
      minHeight: min * HEIGHT_SCALE,
      maxHeight: max * HEIGHT_SCALE,
      colors: COLORS,
      eye: cameraEye(cameraState),
    });
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
