// Detects when active erosion has settled into a stable terrain: total mass
// is conserved by erodeStep (see erosion.js), so raw height sum can't signal
// convergence — instead the caller feeds in the per-frame sum of absolute
// cell deltas, and convergence is declared once that's stayed below
// `threshold` for `stableFramesRequired` consecutive frames in a row.

const DEFAULT_THRESHOLD = 0.02;
const DEFAULT_STABLE_FRAMES_REQUIRED = 40;

export function createConvergenceTracker({
  threshold = DEFAULT_THRESHOLD,
  stableFramesRequired = DEFAULT_STABLE_FRAMES_REQUIRED,
} = {}) {
  let stableFrames = 0;

  return {
    // Feed the total absolute height change observed this frame; returns
    // true once the terrain has been stable for the required streak.
    update(totalDelta) {
      stableFrames = totalDelta < threshold ? stableFrames + 1 : 0;
      return stableFrames >= stableFramesRequired;
    },
    reset() {
      stableFrames = 0;
    },
  };
}

// Sum of |after - before| across every cell — a cheap O(n) diff of two
// same-length heightmap snapshots, used as the convergence signal.
export function totalAbsoluteDelta(before, after) {
  let total = 0;
  for (let i = 0; i < before.length; i++) {
    total += Math.abs(after[i] - before[i]);
  }
  return total;
}
