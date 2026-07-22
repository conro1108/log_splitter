// Generates public/icons/*.png: a split round seen end-on, growth rings and
// all. No deps — minimal PNG encoder (RGBA, filter 0) via node's zlib.
// Run: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Keep roughly in step with SPECIES.oak in src/core/log.ts.
const SKY = [159, 195, 221, 255];
const BARK = [90, 74, 60, 255];
const WOOD = [217, 185, 140, 255];
const RING = [166, 127, 82, 255];
const SPLIT = [36, 26, 16, 255];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const put = (i, color) => color.forEach((v, c) => (rgba[i + c] = v));
  for (let i = 0; i < size * size; i++) put(i * 4, SKY);

  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.40;
  const barkW = size * 0.038;
  // pith sits off-center, the way a real round's does
  const px = cx - size * 0.045;
  const py = cy + size * 0.03;
  const ringStep = size * 0.042;
  const splitHalfW = size * 0.021;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > outer) continue;
      const i = (y * size + x) * 4;

      if (d > outer - barkW) { put(i, BARK); continue; }

      // the split: a vertical gap through the middle of the face
      if (Math.abs(x - cx) < splitHalfW) { put(i, SPLIT); continue; }

      const dp = Math.hypot(x - px, y - py);
      const ring = dp % ringStep;
      put(i, ring < ringStep * 0.34 ? RING : WOOD);
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png`);
}
