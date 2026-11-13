import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, '../src/bugreplay.js');
const targetPath = path.resolve(__dirname, '../../server/public/bugreplay.js');

if (fs.existsSync(srcPath)) {
  fs.copyFileSync(srcPath, targetPath);
  console.log(`✓ Copied ${srcPath} -> ${targetPath}`);
} else {
  console.log('SDK source will be compiled in Phase 3.');
}
