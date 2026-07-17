import { describe, it, expect } from 'vitest';
import { identity, multiply, perspective, lookAt } from '../src/mat4.js';

function expectClose(actual, expected, precision = 5) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], precision);
  }
}

describe('mat4', () => {
  it('identity is the multiplicative identity', () => {
    const m = new Float32Array([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
    expectClose(multiply(m, identity()), m);
    expectClose(multiply(identity(), m), m);
  });

  it('perspective sets the expected clip-space terms', () => {
    const fov = Math.PI / 2;
    const p = perspective(fov, 1, 1, 100);
    const f = 1 / Math.tan(fov / 2);
    expect(p[0]).toBeCloseTo(f, 5);
    expect(p[5]).toBeCloseTo(f, 5);
    expect(p[11]).toBe(-1);
    expect(p[10]).toBeCloseTo((100 + 1) / (1 - 100), 5);
  });

  it('perspective adjusts the x scale by aspect ratio', () => {
    const wide = perspective(Math.PI / 2, 2, 1, 100);
    const square = perspective(Math.PI / 2, 1, 1, 100);
    expect(wide[0]).toBeCloseTo(square[0] / 2, 5);
    expect(wide[5]).toBeCloseTo(square[5], 5);
  });

  it('lookAt places the eye at the origin of view space', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    // Transforming the eye point by the view matrix should land at the origin.
    const x = view[0] * 0 + view[4] * 0 + view[8] * 5 + view[12];
    const y = view[1] * 0 + view[5] * 0 + view[9] * 5 + view[13];
    const z = view[2] * 0 + view[6] * 0 + view[10] * 5 + view[14];
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('lookAt from +Z toward the origin faces down -Z', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    // The forward (view-space -Z) basis vector should be world -Z reversed into +Z lookAt convention.
    expect(view[10]).toBeCloseTo(1, 5);
  });
});
