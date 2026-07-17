// Droplet-based hydraulic erosion ("virtual pipes" model). A droplet is
// spawned at a point, traced downhill via the bilinear-interpolated local
// gradient, and erodes or deposits sediment depending on whether its
// carrying capacity exceeds or falls short of what it's already carrying.
// Mutates the heightmap Float32Array in place; any sediment still carried
// when the droplet dies (leaves the map or runs out of water) is deposited
// at its final position, so total heightmap mass is conserved exactly.

export const DEFAULT_EROSION_PARAMS = {
  inertia: 0.05,
  sedimentCapacityFactor: 3,
  minSedimentCapacity: 0.0001,
  erodeSpeed: 0.3,
  depositSpeed: 0.3,
  evaporateSpeed: 0.02,
  gravity: 4,
  maxLifetime: 30,
  initialWater: 1,
  initialSpeed: 1,
  maxSpeed: 5,
  // Hard cap on how much a single step can change one cell. Without this, a
  // cell that's randomly eroded slightly deeper than its neighbor presents a
  // larger local slope to the next droplet that crosses it, which erodes it
  // deeper still — an unbounded feedback loop that blows the heightmap up to
  // extreme values within a few hundred droplets. Capping the per-step delta
  // breaks that feedback while still allowing visible carving over many steps.
  maxChangePerStep: 0.015,
};

function clampIndex(v, size) {
  return Math.min(Math.max(v, 0), size - 1);
}

// Bilinear height + gradient sample at a fractional grid position.
function heightAndGradient(data, size, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = clampIndex(x0, size);
  const cy0 = clampIndex(y0, size);
  const cx1 = clampIndex(x0 + 1, size);
  const cy1 = clampIndex(y0 + 1, size);

  const h00 = data[cy0 * size + cx0];
  const h10 = data[cy0 * size + cx1];
  const h01 = data[cy1 * size + cx0];
  const h11 = data[cy1 * size + cx1];

  const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
  const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
  const height =
    h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;

  return { height, gx, gy };
}

// Distributes `amount` across the 4 cells surrounding (x, y) using the same
// bilinear weights heightAndGradient reads from, so erode (negative amount)
// and deposit (positive amount) touch the field symmetrically.
function applyDelta(data, size, x, y, amount) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = clampIndex(x0, size);
  const cy0 = clampIndex(y0, size);
  const cx1 = clampIndex(x0 + 1, size);
  const cy1 = clampIndex(y0 + 1, size);

  data[cy0 * size + cx0] += amount * (1 - fx) * (1 - fy);
  data[cy0 * size + cx1] += amount * fx * (1 - fy);
  data[cy1 * size + cx0] += amount * (1 - fx) * fy;
  data[cy1 * size + cx1] += amount * fx * fy;
}

// Simulates one droplet's full lifetime and mutates `heightmap` in place.
// `rng` is called to pick the spawn point, so passing a seeded PRNG keeps
// the whole simulation reproducible. Returns the number of steps taken.
export function erodeStep(heightmap, size, rng, params = {}) {
  const p = { ...DEFAULT_EROSION_PARAMS, ...params };

  let x = rng() * (size - 1);
  let y = rng() * (size - 1);
  let dirX = 0;
  let dirY = 0;
  let speed = p.initialSpeed;
  let water = p.initialWater;
  let sediment = 0;
  let steps = 0;

  for (; steps < p.maxLifetime; steps++) {
    const { gx, gy, height: oldHeight } = heightAndGradient(heightmap, size, x, y);

    dirX = dirX * p.inertia - gx * (1 - p.inertia);
    dirY = dirY * p.inertia - gy * (1 - p.inertia);
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= len;
    dirY /= len;

    const nextX = x + dirX;
    const nextY = y + dirY;

    if (nextX < 0 || nextX >= size - 1 || nextY < 0 || nextY >= size - 1) {
      break;
    }

    x = nextX;
    y = nextY;

    const { height: newHeight } = heightAndGradient(heightmap, size, x, y);
    const heightDiff = newHeight - oldHeight;
    const capacity = Math.max(-heightDiff * speed * water * p.sedimentCapacityFactor, p.minSedimentCapacity);

    if (heightDiff > 0 || sediment > capacity) {
      const depositAmount = Math.min(
        heightDiff > 0 ? Math.min(heightDiff, sediment) : (sediment - capacity) * p.depositSpeed,
        p.maxChangePerStep
      );
      sediment -= depositAmount;
      applyDelta(heightmap, size, x, y, depositAmount);
    } else {
      const erodeAmount = Math.min((capacity - sediment) * p.erodeSpeed, -heightDiff, p.maxChangePerStep);
      applyDelta(heightmap, size, x, y, -erodeAmount);
      sediment += erodeAmount;
    }

    speed = Math.min(Math.sqrt(Math.max(0, speed * speed - heightDiff * p.gravity)), p.maxSpeed);
    water *= 1 - p.evaporateSpeed;

    if (water < 0.01) break;
  }

  if (sediment > 0) {
    applyDelta(heightmap, size, x, y, sediment);
  }

  return steps;
}
