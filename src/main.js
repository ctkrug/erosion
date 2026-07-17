import { generateHeightmap } from './heightmap.js';

// Scaffold entrypoint: proves the noise pipeline runs end-to-end by painting a
// grayscale heightmap preview. The WebGL2 mesh renderer and the hydraulic
// erosion simulation land in the build phase (see docs/BACKLOG.md).

const SIZE = 256;
const canvas = document.getElementById('terrain');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}

function render() {
  const { data, size } = generateHeightmap(SIZE, { seed: 1 });
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(data[i] * 255);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.imageSmoothingEnabled = false;
  createImageBitmap(image).then((bitmap) => {
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  });
}

window.addEventListener('resize', () => {
  resize();
  render();
});

resize();
render();
