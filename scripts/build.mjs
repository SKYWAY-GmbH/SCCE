import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'extension');
const outputDirectory = path.join(projectRoot, 'dist');

const manifest = JSON.parse(await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) {
  throw new Error('The extension must use Manifest V3.');
}

const requiredFiles = new Set([
  'manifest.json',
  'popup.css',
  'popup.js',
  'exporter-main.js',
  manifest.action.default_popup,
  ...Object.values(manifest.action.default_icon),
  ...Object.values(manifest.icons),
]);

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
