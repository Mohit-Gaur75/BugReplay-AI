import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, '../src/bugreplay.js');
const serverTargetPath = path.resolve(__dirname, '../../server/public/bugreplay.js');
const clientTargetPath = path.resolve(__dirname, '../../client/public/bugreplay.js');

if (!fs.existsSync(srcPath)) {
  console.error(`Source SDK file not found at ${srcPath}`);
  process.exit(1);
}

// Ensure target directories exist
[serverTargetPath, clientTargetPath].forEach(p => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(srcPath, p);
});

// Measure file size
const stats = fs.statSync(srcPath);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log(`\n==============================================`);
console.log(`✓ BugReplay SDK compiled successfully!`);
console.log(`📦 Source: ${srcPath}`);
console.log(`🚀 Server Dist: ${serverTargetPath}`);
console.log(`🚀 Client Dist: ${clientTargetPath}`);
console.log(`⚖️  Bundle Size: ${stats.size} bytes (~${sizeKb} KB)`);
console.log(`==============================================\n`);
