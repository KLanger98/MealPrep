// Regenerates the PNG/ICO app icons in public/ from the SVG sources.
// Usage: node scripts/generate-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const render = (svg, size) =>
  sharp(svg, { density: 72 * (size / 48) * 4 }).resize(size, size).png().toBuffer();

const appIcon = await readFile("scripts/icon-source.svg");
for (const [file, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
]) {
  await writeFile(`public/${file}`, await render(appIcon, size));
}

// favicon.ico: an ICO container holding PNG-encoded 48px and 32px images.
const favicon = await readFile("public/favicon.svg");
const images = await Promise.all([48, 32].map(async (size) => ({ size, png: await render(favicon, size) })));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, png }, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...images.map((i) => i.png)]));
