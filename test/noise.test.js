import { describe, it, expect } from 'vitest';
import { SimplexNoise2D, fbm } from '../src/noise.js';

describe('SimplexNoise2D', () => {
  it('is deterministic for a given seed', () => {
    const a = new SimplexNoise2D(42);
    const b = new SimplexNoise2D(42);
    expect(a.noise(1.23, 4.56)).toBe(b.noise(1.23, 4.56));
  });

  it('produces different fields for different seeds', () => {
    const a = new SimplexNoise2D(1);
    const b = new SimplexNoise2D(2);
    expect(a.noise(1.23, 4.56)).not.toBe(b.noise(1.23, 4.56));
  });

  it('stays within the expected output range', () => {
    const n = new SimplexNoise2D(7);
    for (let i = 0; i < 200; i++) {
      const v = n.noise(i * 0.13, i * 0.29);
      expect(v).toBeGreaterThanOrEqual(-1.01);
      expect(v).toBeLessThanOrEqual(1.01);
    }
  });
});

describe('fbm', () => {
  it('averages multiple octaves into a normalized signal', () => {
    const n = new SimplexNoise2D(3);
    const v = fbm(n, 0.5, 0.5, { octaves: 4, persistence: 0.5 });
    expect(v).toBeGreaterThanOrEqual(-1.01);
    expect(v).toBeLessThanOrEqual(1.01);
  });

  it('returns a finite value instead of NaN for zero octaves', () => {
    const n = new SimplexNoise2D(3);
    expect(Number.isFinite(fbm(n, 0.5, 0.5, { octaves: 0 }))).toBe(true);
  });

  it('returns a finite value instead of NaN for negative octaves', () => {
    const n = new SimplexNoise2D(3);
    expect(Number.isFinite(fbm(n, 0.5, 0.5, { octaves: -3 }))).toBe(true);
  });
});
