// Packs src-tauri/icons/icon.ico from the brand sheet's own per-size drawings of the owl-head
// symbol (design/brand/owl-symbol). `tauri icon` only downsamples one master, which blurs the 16px
// mark; the sheet draws 16px on its own pixel grid and drops the beak at 24px, so Windows gets those
// exact pixels instead. Run after `tauri icon` (npm run icon does both).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sizes = [16, 20, 24, 30, 32, 40, 48, 64, 96, 256];
const images = sizes.map((s) => readFileSync(`${root}design/brand/owl-symbol/owl-${s}.png`));

const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(s % 256, at); // 256 is written as 0
  header.writeUInt8(s % 256, at + 1);
  header.writeUInt16LE(1, at + 4); // colour planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
writeFileSync(`${root}src-tauri/icons/icon.ico`, Buffer.concat([header, ...images]));
console.log(`icon.ico: ${sizes.join(', ')} px from design/brand/owl-symbol`);
