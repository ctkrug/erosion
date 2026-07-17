// Minimal column-major 4x4 matrix math for the WebGL2 renderer. Deliberately
// small and dependency-free (no three.js/gl-matrix) so the render path stays
// directly inspectable end to end.

export function identity() {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function perspective(fovYRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovYRadians / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function lookAt(eye, target, up) {
  const zAxis = normalize3(subtract(eye, target));
  const xAxis = normalize3(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);

  const out = new Float32Array(16);
  out[0] = xAxis[0]; out[1] = yAxis[0]; out[2] = zAxis[0]; out[3] = 0;
  out[4] = xAxis[1]; out[5] = yAxis[1]; out[6] = zAxis[1]; out[7] = 0;
  out[8] = xAxis[2]; out[9] = yAxis[2]; out[10] = zAxis[2]; out[11] = 0;
  out[12] = -dot(xAxis, eye);
  out[13] = -dot(yAxis, eye);
  out[14] = -dot(zAxis, eye);
  out[15] = 1;
  return out;
}
