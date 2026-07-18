---
title: "I built a browser terrain generator that erodes itself, live"
published: false
tags: webgl, javascript, graphics, gamedev
---

Most procedural terrain demos on the web stop at noise. You stack a few octaves
of Perlin or simplex noise, run it through a color ramp, and you get something
that photographs like a mountain range but does not read as one. Real land is
not random. It is what is left after water has spent a long time moving downhill,
picking up sediment in one place and dropping it in another. Noise has no memory
of water, so it always looks a little synthetic.

I wanted to see that erosion happen live, in a browser, driven by a slider. That
turned into [Erosion](https://apps.charliekrug.com/erosion/), a small WebGL2 toy.
The code is on [GitHub](https://github.com/ctkrug/erosion). Here are the two
build problems that were more interesting than I expected.

## The simulation wants to blow up

The erosion model is the standard droplet approach. Spawn a droplet at a random
point, trace it downhill along the bilinear-interpolated local gradient, and let
it erode where it speeds up and deposit where it slows down. Each droplet lives
for a few dozen steps and then dies, dropping whatever it still carries.

The first version was numerically unstable in a way that took me a while to pin
down. Terrain would look great for about half a second and then explode into
spikes that shot off the top of the mesh. The cause is a feedback loop. Suppose
one cell gets eroded slightly deeper than its neighbor. Now it presents a steeper
local slope to the next droplet that crosses it, so that droplet erodes it deeper
still, which steepens the slope again. Within a few hundred droplets a single
cell runs away to an absurd value.

The fix is small and boring and I should have reached for it sooner: cap how much
any single step can change one cell.

```js
const erodeAmount = Math.min(
  (capacity - sediment) * p.erodeSpeed,
  -heightDiff,
  p.maxChangePerStep, // the cap that breaks the feedback loop
);
```

With a per-step ceiling, a cell can still erode a lot over many droplets, but no
single crossing can deepen it enough to dominate the next one. The runaway loop
never gets started. It is a good reminder that in a positive-feedback system the
useful control is often a rate limit, not a smarter formula.

## You cannot detect "done" by watching the height sum

I wanted a status readout that says "converged" once the terrain settles, so the
UI can stop implying that something is still happening. My first instinct was to
watch the total height of the map and call it converged when that stops changing.

That does not work, because the droplet model conserves mass by construction.
Every grain of sediment a droplet erodes gets deposited somewhere else, including
whatever it still carries when it dies. So the total height is essentially
constant from frame one. It tells you nothing about whether the shape has settled.

The signal that actually works is the sum of absolute per-cell changes between
frames:

```js
export function totalAbsoluteDelta(before, after) {
  let total = 0;
  for (let i = 0; i < before.length; i++) {
    total += Math.abs(after[i] - before[i]);
  }
  return total;
}
```

Early on this is large, because sediment is being shuffled around a lot. As the
terrain finds a stable shape it drops toward zero. I declare convergence once it
stays under a small threshold for a run of consecutive frames, which keeps a
single quiet frame from triggering a false positive.

## What I would do differently

The erosion runs on the CPU and I re-upload the vertex positions and normals to
the GPU every frame. At a 128 by 128 grid that is fine, but it is the obvious
ceiling. The honest next version moves the droplet simulation into a compute or
fragment shader so the heightmap never has to make the round trip. I kept it on
the CPU here because I wanted the erosion math to stay in plain, testable
JavaScript, and the pure logic (noise, erosion, mesh, convergence) is unit-tested
at full line and branch coverage. That tradeoff was right for a readable demo and
wrong for a fast one.

If you want to poke at it, the live page is
[here](https://apps.charliekrug.com/erosion/) and the source is
[here](https://github.com/ctkrug/erosion). Drag the erosion slider from zero and
watch the valleys show up.
</content>
