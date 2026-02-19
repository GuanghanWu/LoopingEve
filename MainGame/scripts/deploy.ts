import { existsSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');
const distDir = resolve(__dirname, '..', 'dist');

function deploy(): void {
  const distHtml = resolve(distDir, 'index.html');
  const rootHtml = resolve(rootDir, 'index.html');

  if (!existsSync(distHtml)) {
    console.error('Error: dist/index.html not found. Run "npm run build" first.');
    process.exit(1);
  }

  copyFileSync(distHtml, rootHtml);
  console.log('✓ Copied dist/index.html → root/index.html');
  console.log('\n🚀 Deploy complete!');
}

deploy();
