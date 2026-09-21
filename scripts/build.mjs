import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'extension');
const outputDirectory = path.join(projectRoot, 'dist');

const requiredFiles = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'exporter-main.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const manifest = JSON.parse(await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) {
  throw new Error('The extension must use Manifest V3.');
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

const missingFiles = [];
for (const relativePath of requiredFiles) {
  try {
    await readFile(path.join(outputDirectory, relativePath));
  } catch {
    missingFiles.push(relativePath);
  }
}

if (missingFiles.length > 0) {
  throw new Error(`Build output is missing: ${missingFiles.join(', ')}`);
}

console.log(`Built ${manifest.name} ${manifest.version} → ${path.relative(projectRoot, outputDirectory)}/`);
