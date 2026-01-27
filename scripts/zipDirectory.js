import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';

function getGitTrackedFiles(dir) {
  try {
    const result = execSync('git ls-files', {
      cwd: dir,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return result.trim().split('\n').filter(Boolean);
  } catch (e) {
    return null;
  }
}

function getAllFiles(dir, baseDir = dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    if (entry.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function zipDir(dir, outputFile) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  let files = getGitTrackedFiles(dir);
  if (!files) {
    files = getAllFiles(dir);
  }

  const totalFiles = files.length;
  let processed = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    const content = fs.readFileSync(fullPath);
    zip.file(file.replace(/\\/g, '/'), content);

    processed++;
    if (processed % 500 === 0) {
      process.stdout.write(`\r✓ Archiving source (${processed}/${totalFiles} files)`);
    }
  }

  process.stdout.write(`\r✓ Archiving source (${totalFiles}/${totalFiles} files)\n`);
  process.stdout.write('✓ Compressing archive...\n');

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  fs.writeFileSync(outputFile, content);
}

export default zipDir;
