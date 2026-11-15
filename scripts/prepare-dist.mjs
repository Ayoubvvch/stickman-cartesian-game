import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const itemsToCopy = ['index.html', 'style.css', 'js', 'assets'];
for (const item of itemsToCopy) {
  const src = path.join(rootDir, item);
  const dest = path.join(distDir, item);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required frontend asset: ${item}`);
  }
  fs.cpSync(src, dest, { recursive: true });
}

console.log('Prepared dist/ with static frontend assets.');
