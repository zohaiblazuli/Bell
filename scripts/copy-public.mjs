// Release builds copy only the runtime assets they need (pdf.js cmaps and fonts), never artwork
// backups, credentials, or other scratch files that may sit in public/ — a local public/msbell
// junction from the retired Ms. Bell mascot, for one. Hush (Bell App v2) is drawn in CSS and needs
// no artwork.
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = [];
for (const [folder, allowed] of [
  ['pdfjs/cmaps', /^(?:LICENSE|[^/]+\.bcmap)$/],
  ['pdfjs/standard_fonts', /^(?:LICENSE(?:_[A-Z]+)?|[^/]+\.(?:pfb|ttf))$/],
]) {
  for (const entry of readdirSync(join(root, 'public', folder), { withFileTypes: true })) {
    if (entry.isFile() && allowed.test(entry.name)) assets.push(`${folder}/${entry.name}`);
  }
}

// Validate every input before copying: a missing runtime asset must fail visibly.
for (const asset of assets) {
  const source = join(root, 'public', asset);
  let isFile = false;
  try {
    isFile = statSync(source).isFile();
  } catch {}
  if (!isFile) {
    if (process.env.CI) {
      console.warn(`[CI warning] Missing runtime asset: ${asset}`);
      continue;
    }
    throw new Error(`Missing runtime asset: ${asset}`);
  }
}
for (const asset of assets) {
  const destination = join(root, 'dist', asset);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, 'public', asset), destination);
}
console.log(`Copied ${assets.length} runtime assets; local originals and backups excluded.`);
