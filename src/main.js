import { generateHeightmap } from './heightmap.js';
import { erodeStep } from './erosion.js';
import { createRng } from './noise.js';
import { buildMesh, updateMeshHeights } from './mesh.js';
import { TerrainRenderer } from './renderer.js';
import { NOISE_CONTROLS, EROSION_CONTROLS, defaultParams } from './controls.js';

const RESOLUTION = 128;
const HEIGHT_SCALE = 0.6;

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const COLORS = {
  water: hexToRgb('#5fa3a3'),
  grass: hexToRgb('#7fb069'),
  rock: hexToRgb('#4c4335'),
  snow: hexToRgb('#ede4d3'),
};

const viewportEl = document.getElementById('viewport');
const canvas = document.getElementById('terrain');
const statusEl = document.getElementById('status');
const bezelRing = document.querySelector('.bezel-ring');

const params = defaultParams();
let heightmap = generateHeightmap(RESOLUTION, params);
let mesh = buildMesh(heightmap.data, RESOLUTION, { heightScale: HEIGHT_SCALE });
let erosionRng = createRng(params.seed);

let renderer;
try {
  renderer = new TerrainRenderer(canvas);
  renderer.setMesh(mesh);
} catch (err) {
  showUnsupportedMessage(err);
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
  statusEl.textContent = isEroding ? 'eroding…' : 'stable';
  if (isEroding && !wasEroding) pulseBezel();
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
      for (let i = 0; i < params.strength; i++) {
        erodeStep(heightmap.data, RESOLUTION, erosionRng);
      }
      updateMeshHeights(heightmap.data, RESOLUTION, { heightScale: HEIGHT_SCALE }, mesh.positions, mesh.normals);
      renderer.updateMesh(mesh);
    }

    const { min, max } = heightRange(heightmap.data);

    renderer.render({
      minHeight: min * HEIGHT_SCALE,
      maxHeight: max * HEIGHT_SCALE,
      colors: COLORS,
      autoRotateSpeed: 0.08,
      deltaSeconds,
    });
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
