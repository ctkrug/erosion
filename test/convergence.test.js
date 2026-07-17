import { describe, it, expect } from 'vitest';
import { createConvergenceTracker, totalAbsoluteDelta } from '../src/convergence.js';

describe('totalAbsoluteDelta', () => {
  it('is zero for two identical arrays', () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    expect(totalAbsoluteDelta(a, a.slice())).toBeCloseTo(0);
  });

  it('sums absolute per-cell differences regardless of sign', () => {
    const before = new Float32Array([0, 0.5, 1]);
    const after = new Float32Array([0.1, 0.3, 1.2]);
    expect(totalAbsoluteDelta(before, after)).toBeCloseTo(0.1 + 0.2 + 0.2);
  });

  it('is zero for two empty arrays', () => {
    expect(totalAbsoluteDelta(new Float32Array(0), new Float32Array(0))).toBe(0);
  });
});

describe('createConvergenceTracker', () => {
  it('is not converged before any updates', () => {
    const tracker = createConvergenceTracker({ threshold: 0.01, stableFramesRequired: 3 });
    expect(tracker.update(0)).toBe(false);
  });

  it('reports converged once the streak of small deltas reaches the requirement', () => {
    const tracker = createConvergenceTracker({ threshold: 0.01, stableFramesRequired: 3 });
    expect(tracker.update(0.001)).toBe(false);
    expect(tracker.update(0.001)).toBe(false);
    expect(tracker.update(0.001)).toBe(true);
  });

  it('resets the streak on a delta at or above the threshold', () => {
    const tracker = createConvergenceTracker({ threshold: 0.01, stableFramesRequired: 3 });
    tracker.update(0.001);
    tracker.update(0.001);
    tracker.update(0.5);
    expect(tracker.update(0.001)).toBe(false);
  });

  it('treats a delta exactly at the threshold as not stable', () => {
    const tracker = createConvergenceTracker({ threshold: 0.01, stableFramesRequired: 1 });
    expect(tracker.update(0.01)).toBe(false);
  });

  it('reset() clears an in-progress streak', () => {
    const tracker = createConvergenceTracker({ threshold: 0.01, stableFramesRequired: 2 });
    tracker.update(0.001);
    tracker.reset();
    expect(tracker.update(0.001)).toBe(false);
  });

  it('uses sane defaults when constructed with no options', () => {
    const tracker = createConvergenceTracker();
    expect(tracker.update(0)).toBe(false);
  });
});
