import { SimplexNoise2D, fbm } from './noise.js';

// Builds a flat Float32Array heightmap of size x size, values in [0, 1].
export function generateHeightmap(size, { seed = 1, octaves = 4, frequency = 3, lacunarity = 2, persistence = 0.5 } = {}) {
  const noise = new SimplexNoise2D(seed);
  const data = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const value = fbm(noise, nx, ny, { octaves, frequency, lacunarity, persistence });
      data[y * size + x] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - min) / range;
    data[i] = Math.min(1, Math.max(0, normalized));
  }

  return { data, size };
}
