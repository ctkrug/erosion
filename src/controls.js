// Declarative slider specs for the control console. Both the DOM builder in
// main.js and the tests read from this single source, so the UI, its
// defaults, and their bounds can't drift apart.

export const NOISE_CONTROLS = [
  { key: 'seed', label: 'Seed', min: 1, max: 9999, step: 1, default: 1 },
  { key: 'octaves', label: 'Octaves', min: 1, max: 8, step: 1, default: 4 },
  { key: 'frequency', label: 'Frequency', min: 0.5, max: 8, step: 0.1, default: 3 },
  { key: 'lacunarity', label: 'Lacunarity', min: 1.2, max: 3, step: 0.1, default: 2 },
  { key: 'persistence', label: 'Persistence', min: 0.1, max: 0.9, step: 0.05, default: 0.5 },
];

export const EROSION_CONTROLS = [
  {
    key: 'strength',
    label: 'Erosion strength',
    min: 0,
    max: 200,
    step: 1,
    default: 0,
    unit: 'droplets/frame',
  },
];

export const ALL_CONTROLS = [...NOISE_CONTROLS, ...EROSION_CONTROLS];

export function defaultParams() {
  const params = {};
  for (const spec of ALL_CONTROLS) params[spec.key] = spec.default;
  return params;
}
