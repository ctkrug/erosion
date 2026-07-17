import { describe, it, expect } from 'vitest';
import { erodeStep } from '../src/erosion.js';
import { createRng } from '../src/noise.js';
import { generateHeightmap } from '../src/heightmap.js';

function sum(data) {
  let total = 0;
  for (const v of data) total += v;
  return total;
}

function bandSum(data, size, xLo, xHi) {
  let total = 0;
  for (let y = 0; y < size; y++) {
    for (let x = xLo; x <= xHi; x++) total += data[y * size + x];
  }
  return total;
}

// A radial paraboloid: 0 at the center, 1 at the corners.
function makeBowl(size) {
  const data = new Float32Array(size * size);
  const c = (size - 1) / 2;
  const maxDist = Math.sqrt(2) * c;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = Math.sqrt((x - c) ** 2 + (y - c) ** 2) / maxDist;
    }
  }
  return data;
}

// A uniform linear ramp: 1 at x=0, 0 at x=size-1.
function makeSlope(size) {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[y * size + x] = 1 - x / (size - 1);
  }
  return data;
}

describe('erodeStep', () => {
  it('conserves total heightmap mass across many droplets', () => {
    const { data, size } = generateHeightmap(64, { seed: 4 });
    const before = sum(data);
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) erodeStep(data, size, rng);
    expect(sum(data)).toBeCloseTo(before, 3);
  });

  it('leaves the heightmap untouched for zero droplets', () => {
    const { data, size } = generateHeightmap(32, { seed: 2 });
    const before = data.slice();
    for (let i = 0; i < 0; i++) erodeStep(data, size, createRng(1));
    expect(Array.from(data)).toEqual(Array.from(before));
  });

  it('deepens a bowl-shaped basin below its original minimum', () => {
    const size = 32;
    const bowl = makeBowl(size);
    const originalMin = Math.min(...bowl);
    const rng = createRng(11);
    for (let i = 0; i < 400; i++) erodeStep(bowl, size, rng);
    expect(Math.min(...bowl)).toBeLessThan(originalMin);
  });

  it('erodes the steep end and deposits at the run-out of a uniform slope', () => {
    const size = 32;
    const slope = makeSlope(size);
    const topBefore = bandSum(slope, size, 0, 3);
    const bottomBefore = bandSum(slope, size, size - 4, size - 1);
    const rng = createRng(21);
    for (let i = 0; i < 400; i++) erodeStep(slope, size, rng);
    expect(bandSum(slope, size, 0, 3)).toBeLessThan(topBefore);
    expect(bandSum(slope, size, size - 4, size - 1)).toBeGreaterThan(bottomBefore);
  });

  it('stays numerically stable over thousands of droplets', () => {
    const { data, size } = generateHeightmap(64, { seed: 6 });
    const rng = createRng(13);
    for (let i = 0; i < 3000; i++) erodeStep(data, size, rng);
    for (const v of data) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThan(5);
    }
  });

  it('a droplet dies early from water depletion under a fast evaporation rate', () => {
    const { data, size } = generateHeightmap(32, { seed: 2 });
    const rng = createRng(1);
    const steps = erodeStep(data, size, rng, { evaporateSpeed: 0.5, maxLifetime: 30 });
    expect(steps).toBeLessThan(30);
  });

  it('leaves a perfectly flat heightmap untouched (zero gradient, nowhere to flow)', () => {
    const size = 16;
    const flat = new Float32Array(size * size).fill(0.5);
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) erodeStep(flat, size, rng);
    for (const v of flat) expect(v).toBe(0.5);
  });

  it('is deterministic for a given seed', () => {
    const a = generateHeightmap(32, { seed: 8 });
    const b = generateHeightmap(32, { seed: 8 });
    const rngA = createRng(5);
    const rngB = createRng(5);
    for (let i = 0; i < 100; i++) {
      erodeStep(a.data, a.size, rngA);
      erodeStep(b.data, b.size, rngB);
    }
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});
