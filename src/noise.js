// Deterministic 2D Simplex noise, seeded via a small xorshift PRNG.
// Self-contained (no dependency) so it stays testable without a GPU context.

function xorshift32(seed) {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

// Shared seeded PRNG for anything that needs reproducible randomness outside
// the noise field itself (e.g. droplet spawn points in the erosion sim).
export function createRng(seed) {
  return xorshift32(seed);
}

function buildPermutation(seed) {
  const rand = xorshift32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class SimplexNoise2D {
  constructor(seed = 1) {
    this.perm = buildPermutation(seed);
  }

  #grad(hash, x, y) {
    const g = GRAD2[hash & 7];
    return g[0] * x + g[1] * y;
  }

  noise(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.#grad(perm[ii + perm[jj]], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.#grad(perm[ii + i1 + perm[jj + j1]], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.#grad(perm[ii + 1 + perm[jj + 1]], x2, y2);
    }

    return 70 * (n0 + n1 + n2);
  }
}

// Fractal Brownian motion: layers multiple octaves of noise into one signal.
export function fbm(noise, x, y, { octaves = 4, frequency = 1, lacunarity = 2, persistence = 0.5 } = {}) {
  let amplitude = 1;
  let freq = frequency;
  let sum = 0;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise.noise(x * freq, y * freq) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    freq *= lacunarity;
  }
  return sum / max;
}
