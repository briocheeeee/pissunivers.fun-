/*
 * Minify CSS
 * currently just css files for themes are loades seperately,
 * so files beginning with "theme-" in the src/styles folder will
 * be read and automatically added.
 *
 */

/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import CleanCSS from 'clean-css';
import crypto from 'crypto';

const __dirname = import.meta.dirname;

const assetdir = path.resolve(__dirname, '..', 'dist', 'public', 'assets');
const FOLDER = path.resolve(__dirname, '..', 'src', 'styles');

function resolveImports(content, folder) {
  const importRegex = /@import\s+url\(['"]?\.\/([^'")\s]+)['"]?\);?/g;
  let result = content;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importedFile = match[1];
    const importedPath = path.resolve(folder, importedFile);
    if (fs.existsSync(importedPath)) {
      const importedContent = fs.readFileSync(importedPath, 'utf8');
      const importedFolder = path.dirname(importedPath);
      const resolvedContent = resolveImports(importedContent, importedFolder);
      result = result.replace(match[0], resolvedContent);
    }
  }
  return result;
}

async function minifyCss() {
  const ts = Date.now();
  process.stdout.write(`\x1b[33mMinifying CSS assets\x1b[0m\n`);
  const cssFiles = fs.readdirSync(FOLDER).filter((e) => e.endsWith('.css'));
  const cleanCss = new CleanCSS({});

  for (const file of cssFiles) {
    let input = fs.readFileSync(path.resolve(FOLDER, file), 'utf8');
    input = resolveImports(input, FOLDER);
    const output = cleanCss.minify(input);
    if (output.warnings && output.warnings.length > 0) {
      output.warnings.forEach((w) => console.log('\x1b[33m%s\x1b[0m', w));
    }
    if (output.errors && output.errors.length > 0) {
      console.log(`\x1b[31mError in file: ${file}\x1b[0m`);
      output.errors.forEach((e) => console.log('\x1b[31m%s\x1b[0m', e));
      throw new Error(`Minify CSS Error in ${file}`);
    }
    console.log(`${file} by ${Math.round(output.stats.efficiency * 100)}%`);
    const hash = crypto.createHash('md5').update(output.styles).digest('hex');
    const key = file.substr(0, file.indexOf('.'));
    const filename = `${key}.${hash.substr(0, 8)}.css`;
    fs.writeFileSync(path.resolve(assetdir, filename), output.styles, 'utf8');
  }
  process.stdout.write(`\x1b[33mMinifying took ${Math.round((Date.now() - ts) / 1000)}s\x1b[0m\n`);
}

async function doMinifyCss() {
  try {
    fs.mkdirSync(assetdir, { recursive: true });
    await minifyCss();
  } catch (e) {
    console.log('ERROR while minifying css', e);
    process.exit(1);
  }
  process.exit(0); 
}

const isMainModule = import.meta.url.includes('minifyCss.js');
if (isMainModule && process.argv[1]?.includes('minifyCss')) {
  doMinifyCss();
}

export default minifyCss;
