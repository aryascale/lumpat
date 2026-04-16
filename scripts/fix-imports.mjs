#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const DIST_DIR = join(process.cwd(), 'dist-server');

async function getAllJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => e.isFile() && extname(e.name) === '.js')
    .map(e => join(e.parentPath || e.path, e.name));
}

async function fixImports(filePath) {
  let content = await readFile(filePath, 'utf-8');
  let modified = false;

  const fixPath = (match, prefix, importPath, suffix) => {
    if (/\.\w+$/.test(importPath)) return match;
    modified = true;
    return `${prefix}${importPath}.js${suffix}`;
  };

  content = content.replace(/(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g, fixPath);
  content = content.replace(/(import\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g, fixPath);

  if (modified) await writeFile(filePath, content, 'utf-8');
}

async function main() {
  const files = await getAllJsFiles(DIST_DIR);
  await Promise.all(files.map(fixImports));
  console.log(`Fixed imports in ${files.length} files`);
}

main().catch(console.error);
