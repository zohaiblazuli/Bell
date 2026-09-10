// Release builds must include the local mascot animations, but never artwork backups,
// credentials, or other scratch files reachable through the public/msbell junction.
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mascotFiles = [
  'msbell_idle.webp',
  'msbell_idle_2.webp',
  'msbell_idle_3.webp',
  'msbell_idle_4.webp',
  'msbell_idle_5.webp',
  'msbell_interact_1.webp',
  'msbell_interact_2.webp',
  'msbell_interact_3.webp',
  'msbell_sleeping.webp',
  'msbell_study_start.webp',
  'msbell_study_loop.webp',
  'startup_splash.webp',
];

const assets = mascotFiles.map((name) => `msbell/${name}`);
for (const [folder, allowed] of [
  ['pdfjs/cmaps', /^(?:LICENSE|[^/]+\.bcmap)$/],
  ['pdfjs/standard_fonts', /^(?:LICENSE(?:_[A-Z]+)?|[^/]+\.(?:pfb|ttf))$/],
]) {
  for (const entry of readdirSync(join(root, 'public', folder), { withFileTypes: true })) {
    if (entry.isFile() && allowed.test(entry.name)) assets.push(`${folder}/${entry.name}`);
  }
}

// Validate every input before copying. A clean checkout without the local runtime
// artwork must fail visibly instead of publishing a build with missing animations.
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
