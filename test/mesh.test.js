import { describe, it, expect } from 'vitest';
import { buildMesh, updateMeshHeights } from '../src/mesh.js';

describe('buildMesh', () => {
  it('produces size*size vertices and (size-1)^2*6 triangle indices', () => {
    const size = 8;
    const heightmap = new Float32Array(size * size).fill(0.5);
    const mesh = buildMesh(heightmap, size);
    expect(mesh.vertexCount).toBe(size * size);
    expect(mesh.positions.length).toBe(size * size * 3);
    expect(mesh.normals.length).toBe(size * size * 3);
    expect(mesh.uvs.length).toBe(size * size * 2);
    expect(mesh.indices.length).toBe((size - 1) * (size - 1) * 6);
  });

  it('spans x/z from -spanXZ/2 to +spanXZ/2', () => {
    const size = 4;
    const heightmap = new Float32Array(size * size).fill(0);
    const mesh = buildMesh(heightmap, size, { spanXZ: 10 });
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < mesh.vertexCount; i++) {
      const x = mesh.positions[i * 3];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    expect(minX).toBeCloseTo(-5, 5);
    expect(maxX).toBeCloseTo(5, 5);
  });

  it('scales vertex Y by height * heightScale', () => {
    const size = 4;
    const heightmap = new Float32Array(size * size).fill(0.5);
    const mesh = buildMesh(heightmap, size, { heightScale: 2 });
    for (let i = 0; i < mesh.vertexCount; i++) {
      expect(mesh.positions[i * 3 + 1]).toBeCloseTo(1, 5);
    }
  });

  it('every triangle index stays within the vertex range', () => {
    const size = 6;
    const heightmap = new Float32Array(size * size).fill(0.3);
    const mesh = buildMesh(heightmap, size);
    for (const idx of mesh.indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(mesh.vertexCount);
    }
  });

  it('a flat heightmap produces straight-up normals', () => {
    const size = 5;
    const heightmap = new Float32Array(size * size).fill(0.4);
    const mesh = buildMesh(heightmap, size);
    for (let i = 0; i < mesh.vertexCount; i++) {
      expect(mesh.normals[i * 3 + 0]).toBeCloseTo(0, 5);
      expect(mesh.normals[i * 3 + 1]).toBeCloseTo(1, 5);
      expect(mesh.normals[i * 3 + 2]).toBeCloseTo(0, 5);
    }
  });

  it('a slope tilts normals away from straight up, toward the descending axis', () => {
    const size = 6;
    const heightmap = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) heightmap[row * size + col] = 1 - col / (size - 1);
    }
    const mesh = buildMesh(heightmap, size, { heightScale: 1 });
    const midRow = 3;
    const midCol = 3;
    const i = midRow * size + midCol;
    expect(mesh.normals[i * 3 + 1]).toBeLessThan(1);
    // Height decreases as col increases, so the surface leans toward +X.
    expect(mesh.normals[i * 3 + 0]).toBeGreaterThan(0);
  });

  it('updateMeshHeights mutates positions/normals in place without touching vertex count', () => {
    const size = 4;
    const flat = new Float32Array(size * size).fill(0.2);
    const mesh = buildMesh(flat, size);
    const raised = new Float32Array(size * size).fill(0.8);
    updateMeshHeights(raised, size, { heightScale: 1 }, mesh.positions, mesh.normals);
    for (let i = 0; i < mesh.vertexCount; i++) {
      expect(mesh.positions[i * 3 + 1]).toBeCloseTo(0.8, 5);
    }
    expect(mesh.positions.length).toBe(size * size * 3);
  });

  it('handles a 1x1 heightmap without dividing by zero', () => {
    const mesh = buildMesh(new Float32Array([0.5]), 1);
    expect(mesh.vertexCount).toBe(1);
    expect(mesh.indices.length).toBe(0);
    expect(Number.isFinite(mesh.positions[0])).toBe(true);
  });
});
