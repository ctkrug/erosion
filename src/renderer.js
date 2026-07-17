import { identity, multiply, perspective, lookAt } from './mat4.js';

// Raw WebGL2 shaded-mesh renderer. Vanilla GL calls only (see docs/VISION.md:
// "raw WebGL2, no three.js") so the heightmap -> vertex buffer -> frame path
// stays direct. GPU-dependent, so it's exercised manually in a browser rather
// than by the unit suite (see docs/ARCHITECTURE.md).

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uModelViewProjection;
uniform mat4 uModel;

out vec3 vNormal;
out vec3 vWorldPos;
out float vHeight;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = mat3(uModel) * aNormal;
  vHeight = aPosition.y;
  gl_Position = uModelViewProjection * vec4(aPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in float vHeight;

uniform vec3 uLightDir;
uniform vec3 uWaterColor;
uniform vec3 uGrassColor;
uniform vec3 uRockColor;
uniform vec3 uSnowColor;
uniform float uMinHeight;
uniform float uMaxHeight;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  float range = max(uMaxHeight - uMinHeight, 0.0001);
  float t = clamp((vHeight - uMinHeight) / range, 0.0, 1.0);

  vec3 elevationColor = uWaterColor;
  elevationColor = mix(elevationColor, uGrassColor, smoothstep(0.05, 0.28, t));
  elevationColor = mix(elevationColor, uRockColor, smoothstep(0.38, 0.6, t));
  elevationColor = mix(elevationColor, uSnowColor, smoothstep(0.78, 0.92, t));

  float slope = 1.0 - clamp(n.y, 0.0, 1.0);
  vec3 baseColor = mix(elevationColor, uRockColor, smoothstep(0.3, 0.65, slope));

  float diffuse = max(dot(n, normalize(uLightDir)), 0.0);
  float ambient = 0.5;
  vec3 lit = baseColor * (ambient + diffuse * 0.42);

  fragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function linkProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  return program;
}

export class TerrainRenderer {
  constructor(canvas) {
    // preserveDrawingBuffer keeps the buffer readable by screenshot/capture
    // tools between frames — the perf cost is negligible at this scale.
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available in this browser');

    this.canvas = canvas;
    this.gl = gl;
    this.program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);

    this.positionBuffer = gl.createBuffer();
    this.normalBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.indexCount = 0;

    this.uniforms = {
      mvp: gl.getUniformLocation(this.program, 'uModelViewProjection'),
      model: gl.getUniformLocation(this.program, 'uModel'),
      lightDir: gl.getUniformLocation(this.program, 'uLightDir'),
      water: gl.getUniformLocation(this.program, 'uWaterColor'),
      grass: gl.getUniformLocation(this.program, 'uGrassColor'),
      rock: gl.getUniformLocation(this.program, 'uRockColor'),
      snow: gl.getUniformLocation(this.program, 'uSnowColor'),
      minHeight: gl.getUniformLocation(this.program, 'uMinHeight'),
      maxHeight: gl.getUniformLocation(this.program, 'uMaxHeight'),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.09, 0.106, 0.126, 1);
  }

  resize(cssWidth, cssHeight, dpr = 1) {
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  // Uploads a full mesh (called on topology change: resolution or first load).
  setMesh(mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.indexCount = mesh.indices.length;
    this.indexType = mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  }

  // Re-uploads just position/normal data (called every simulation frame).
  updateMesh(mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.normals);
  }

  // `eye` is a Cartesian camera position (see camera.js:cameraEye) — the
  // renderer no longer owns any rotation state of its own, so both the
  // idle auto-rotate and user orbit/zoom drive it through the same path.
  render({ minHeight, maxHeight, colors, eye }) {
    const gl = this.gl;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const aspect = this.canvas.width / this.canvas.height;
    const projection = perspective((45 * Math.PI) / 180, aspect, 0.1, 20);
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const model = identity();
    const mvp = multiply(projection, multiply(view, model));

    gl.uniformMatrix4fv(this.uniforms.mvp, false, mvp);
    gl.uniformMatrix4fv(this.uniforms.model, false, model);
    gl.uniform3fv(this.uniforms.lightDir, [0.4, 0.85, 0.3]);
    gl.uniform3fv(this.uniforms.water, colors.water);
    gl.uniform3fv(this.uniforms.grass, colors.grass);
    gl.uniform3fv(this.uniforms.rock, colors.rock);
    gl.uniform3fv(this.uniforms.snow, colors.snow);
    gl.uniform1f(this.uniforms.minHeight, minHeight);
    gl.uniform1f(this.uniforms.maxHeight, maxHeight);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0);
  }
}
