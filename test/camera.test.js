import { describe, it, expect } from 'vitest';
import { createCameraState, orbitCamera, zoomCamera, cameraEye, CAMERA_LIMITS } from '../src/camera.js';

describe('createCameraState', () => {
  it('fills in defaults when no options are given', () => {
    const state = createCameraState();
    expect(state.azimuth).toBe(0);
    expect(state.elevation).toBeGreaterThan(0);
    expect(state.distance).toBeGreaterThan(0);
  });

  it('clamps an out-of-range elevation to the limits', () => {
    expect(createCameraState({ elevation: 99 }).elevation).toBeCloseTo(CAMERA_LIMITS.maxElevation);
    expect(createCameraState({ elevation: -99 }).elevation).toBeCloseTo(CAMERA_LIMITS.minElevation);
  });

  it('clamps an out-of-range distance to the limits', () => {
    expect(createCameraState({ distance: 999 }).distance).toBeCloseTo(CAMERA_LIMITS.maxDistance);
    expect(createCameraState({ distance: -5 }).distance).toBeCloseTo(CAMERA_LIMITS.minDistance);
  });
});

describe('orbitCamera', () => {
  it('accumulates azimuth without wrapping or clamping', () => {
    let state = createCameraState({ azimuth: 0 });
    state = orbitCamera(state, 1.5, 0);
    state = orbitCamera(state, 1.5, 0);
    expect(state.azimuth).toBeCloseTo(3);
  });

  it('clamps elevation at the upper limit', () => {
    const state = orbitCamera(createCameraState({ elevation: CAMERA_LIMITS.maxElevation }), 0, 10);
    expect(state.elevation).toBeCloseTo(CAMERA_LIMITS.maxElevation);
  });

  it('clamps elevation at the lower limit', () => {
    const state = orbitCamera(createCameraState({ elevation: CAMERA_LIMITS.minElevation }), 0, -10);
    expect(state.elevation).toBeCloseTo(CAMERA_LIMITS.minElevation);
  });

  it('leaves distance untouched', () => {
    const state = orbitCamera(createCameraState({ distance: 3 }), 0.4, 0.1);
    expect(state.distance).toBe(3);
  });
});

describe('zoomCamera', () => {
  it('moves distance closer within bounds', () => {
    const state = zoomCamera(createCameraState({ distance: 3 }), -1);
    expect(state.distance).toBeCloseTo(2);
  });

  it('clamps at the minimum distance', () => {
    const state = zoomCamera(createCameraState({ distance: CAMERA_LIMITS.minDistance }), -5);
    expect(state.distance).toBeCloseTo(CAMERA_LIMITS.minDistance);
  });

  it('clamps at the maximum distance', () => {
    const state = zoomCamera(createCameraState({ distance: CAMERA_LIMITS.maxDistance }), 5);
    expect(state.distance).toBeCloseTo(CAMERA_LIMITS.maxDistance);
  });

  it('leaves azimuth and elevation untouched', () => {
    const state = zoomCamera(createCameraState({ azimuth: 1.2, elevation: 0.5 }), -0.5);
    expect(state.azimuth).toBe(1.2);
    expect(state.elevation).toBe(0.5);
  });
});

describe('cameraEye', () => {
  it('places the eye straight ahead on the Z axis at azimuth/elevation 0', () => {
    const [x, y, z] = cameraEye({ azimuth: 0, elevation: 0, distance: 5 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(5);
  });

  it('places the eye on the X axis at a quarter turn', () => {
    const [x, y, z] = cameraEye({ azimuth: Math.PI / 2, elevation: 0, distance: 5 });
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0, 5);
  });

  it('raises the eye in Y as elevation increases, shrinking the horizontal radius', () => {
    const low = cameraEye({ azimuth: 0.3, elevation: 0.1, distance: 4 });
    const high = cameraEye({ azimuth: 0.3, elevation: 1.2, distance: 4 });
    expect(high[1]).toBeGreaterThan(low[1]);
    expect(Math.hypot(high[0], high[2])).toBeLessThan(Math.hypot(low[0], low[2]));
  });

  it('always returns a point at the given distance from the origin', () => {
    const eye = cameraEye({ azimuth: 0.77, elevation: 0.4, distance: 3.3 });
    expect(Math.hypot(...eye)).toBeCloseTo(3.3);
  });
});
