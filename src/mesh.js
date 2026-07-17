// Converts a flat heightmap into a WebGL2-ready triangle mesh: a position
// buffer, a per-vertex normal buffer (central-difference from neighboring
// heights), a UV buffer, and a shared triangle index buffer. Pure logic, no
// GPU calls, so it's testable independent of a WebGL context.

function heightAt(heightmap, size, x, y) {
  const cx = Math.min(Math.max(x, 0), size - 1);
  const cy = Math.min(Math.max(y, 0), size - 1);
  return heightmap[cy * size + cx];
}

// Rebuilds vertex Y positions and normals from the current heightmap values
// into the given typed arrays, without touching indices/UVs. Called every
// simulation frame, so it avoids reallocating buffers.
export function updateMeshHeights(heightmap, size, { spanXZ = 2, heightScale = 0.6 } = {}, positions, normals) {
  const cellSize = spanXZ / (size - 1);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      positions[i * 3 + 1] = heightmap[i] * heightScale;

      const hl = heightAt(heightmap, size, col - 1, row) * heightScale;
      const hr = heightAt(heightmap, size, col + 1, row) * heightScale;
      const hd = heightAt(heightmap, size, col, row - 1) * heightScale;
      const hu = heightAt(heightmap, size, col, row + 1) * heightScale;

      const nx = (hl - hr) / (2 * cellSize);
      const nz = (hd - hu) / (2 * cellSize);
      const len = Math.hypot(nx, 1, nz);

      normals[i * 3 + 0] = nx / len;
      normals[i * 3 + 1] = 1 / len;
      normals[i * 3 + 2] = nz / len;
    }
  }
}

function buildIndices(size) {
  const quadCount = (size - 1) * (size - 1);
  const IndexArray = size * size > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(quadCount * 6);
  let idx = 0;

  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const topLeft = row * size + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + size;
      const bottomRight = bottomLeft + 1;

      indices[idx++] = topLeft;
      indices[idx++] = bottomLeft;
      indices[idx++] = topRight;

      indices[idx++] = topRight;
      indices[idx++] = bottomLeft;
      indices[idx++] = bottomRight;
    }
  }

  return indices;
}

// Builds the full mesh (positions, normals, uvs, indices) for a heightmap of
// `size` x `size`. `spanXZ` is the world-space width/depth of the mesh,
// `heightScale` converts a normalized [0, 1] height into world-space Y.
export function buildMesh(heightmap, size, options = {}) {
  const vertexCount = size * size;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const spanXZ = options.spanXZ ?? 2;
  const half = spanXZ / 2;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = row * size + col;
      const u = size > 1 ? col / (size - 1) : 0;
      const v = size > 1 ? row / (size - 1) : 0;

      positions[i * 3 + 0] = u * spanXZ - half;
      positions[i * 3 + 2] = v * spanXZ - half;

      uvs[i * 2 + 0] = u;
      uvs[i * 2 + 1] = v;
    }
  }

  updateMeshHeights(heightmap, size, options, positions, normals);

  return { positions, normals, uvs, indices: buildIndices(size), vertexCount };
}
