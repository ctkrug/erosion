// Pure orbit-camera state math (spherical coordinates around the terrain's
// center). Kept dependency-free and DOM-free so the orbit/zoom arithmetic is
// unit-testable; pointer/wheel/touch wiring lives in main.js.

export const CAMERA_LIMITS = {
  minElevation: 0.15,
  maxElevation: 1.45,
  minDistance: 1.2,
  maxDistance: 6,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createCameraState({ azimuth = 0, elevation = 0.9, distance = 2.6 } = {}) {
  return {
    azimuth,
    elevation: clamp(elevation, CAMERA_LIMITS.minElevation, CAMERA_LIMITS.maxElevation),
    distance: clamp(distance, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance),
  };
}

// Adds a relative orbit delta (radians); azimuth wraps freely, elevation is
// clamped so the camera can't flip past the poles.
export function orbitCamera(state, deltaAzimuth, deltaElevation) {
  return {
    ...state,
    azimuth: state.azimuth + deltaAzimuth,
    elevation: clamp(state.elevation + deltaElevation, CAMERA_LIMITS.minElevation, CAMERA_LIMITS.maxElevation),
  };
}

// Adds a relative distance delta, clamped to a sane min/max so the terrain
// can't be zoomed inside-out or off into the distance.
export function zoomCamera(state, deltaDistance) {
  return {
    ...state,
    distance: clamp(state.distance + deltaDistance, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance),
  };
}

// Converts spherical (azimuth, elevation, distance) into a Cartesian eye
// position orbiting the origin, matching mat4.lookAt's world-space axes.
export function cameraEye(state) {
  const { azimuth, elevation, distance } = state;
  const horizontal = Math.cos(elevation) * distance;
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation) * distance, Math.cos(azimuth) * horizontal];
}
