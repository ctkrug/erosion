import { describe, it, expect } from 'vitest';
import { ALL_CONTROLS, NOISE_CONTROLS, EROSION_CONTROLS, defaultParams } from '../src/controls.js';

describe('control specs', () => {
  it('every control default sits within its own min/max range', () => {
    for (const spec of ALL_CONTROLS) {
      expect(spec.default).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
      expect(spec.min).toBeLessThan(spec.max);
      expect(spec.step).toBeGreaterThan(0);
    }
  });

  it('has unique keys across all controls', () => {
    const keys = ALL_CONTROLS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('splits noise and erosion controls without overlap', () => {
    expect(ALL_CONTROLS.length).toBe(NOISE_CONTROLS.length + EROSION_CONTROLS.length);
  });

  it('defaultParams returns one entry per control keyed by spec.key', () => {
    const params = defaultParams();
    for (const spec of ALL_CONTROLS) {
      expect(params[spec.key]).toBe(spec.default);
    }
    expect(Object.keys(params).length).toBe(ALL_CONTROLS.length);
  });
});
