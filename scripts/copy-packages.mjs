import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');

if (!fs.existsSync(packagesDir)) {
  fs.mkdirSync(packagesDir, { recursive: true });
}

const searchPaths = [
  path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle'),
  path.join(rootDir, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk'),
  path.join(rootDir, 'src-tauri', 'gen', 'android')
];

const extensions = ['.deb', '.appimage', '.msi', '.exe', '.apk'];

function copyFilesRecursively(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      copyFilesRecursively(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        const destPath = path.join(packagesDir, entry.name);
        fs.copyFileSync(fullPath, destPath);
        console.log(`[Package Copy] Copied: ${entry.name} -> packages/`);
      }
    }
  }
}

console.log('[Package Copy] Searching for build packages...');
for (const searchPath of searchPaths) {
  copyFilesRecursively(searchPath);
}
console.log('[Package Copy] Process completed.');
