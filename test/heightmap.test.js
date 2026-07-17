import { describe, it, expect } from 'vitest';
import { generateHeightmap } from '../src/heightmap.js';

describe('generateHeightmap', () => {
  it('returns a size*size Float32Array normalized to [0, 1]', () => {
    const { data, size } = generateHeightmap(32, { seed: 5 });
    expect(size).toBe(32);
    expect(data.length).toBe(32 * 32);

    let min = Infinity;
    let max = -Infinity;
    for (const v of data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(max).toBeGreaterThan(min);
  });

  it('is deterministic for a given seed', () => {
    const a = generateHeightmap(16, { seed: 9 });
    const b = generateHeightmap(16, { seed: 9 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('degrades to a finite flat field instead of NaN for zero octaves', () => {
    const { data } = generateHeightmap(8, { octaves: 0 });
    for (const v of data) expect(Number.isFinite(v)).toBe(true);
  });
});
