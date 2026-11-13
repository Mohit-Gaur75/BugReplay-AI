import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.resolve(__dirname, '../src/bugreplay.js');
const targetPath = path.resolve(__dirname, '../../server/public/bugreplay.js');

if (!fs.existsSync(srcPath)) {
  console.error(`Source SDK file not found at ${srcPath}`);
  process.exit(1);
}

// Ensure target directory exists
const targetDir = path.dirname(targetPath);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy file
fs.copyFileSync(srcPath, targetPath);

// Measure file size
const stats = fs.statSync(srcPath);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log(`\n==============================================`);
console.log(`✓ BugReplay SDK compiled successfully!`);
console.log(`📦 Source: ${srcPath}`);
console.log(`🚀 Distribution: ${targetPath}`);
console.log(`⚖️  Bundle Size: ${stats.size} bytes (~${sizeKb} KB)`);
console.log(`==============================================\n`);
