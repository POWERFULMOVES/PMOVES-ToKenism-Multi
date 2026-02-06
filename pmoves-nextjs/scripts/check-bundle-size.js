#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.join(process.cwd(), '.next', 'static', 'chunks');

const maxTotalKb = Number(process.env.BUNDLE_SIZE_TOTAL_KB || 500);
const maxChunkKb = Number(process.env.BUNDLE_SIZE_MAX_CHUNK_KB || 250);

function getJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return getJsFiles(fullPath);
    }
    return entry.isFile() && fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

function gzipSizeKb(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content);
  return gzipped.length / 1024;
}

const files = getJsFiles(rootDir);

if (!files.length) {
  console.error(`No JS chunks found at ${rootDir}. Run \"npm run build\" before checking bundle size.`);
  process.exit(1);
}

const measured = files.map((filePath) => ({
  filePath,
  sizeKb: gzipSizeKb(filePath),
}));

const totalKb = measured.reduce((sum, file) => sum + file.sizeKb, 0);
const largestChunk = measured.reduce((largest, current) =>
  current.sizeKb > largest.sizeKb ? current : largest,
);

const failures = [];
if (totalKb > maxTotalKb) {
  failures.push(`Total gzipped chunk size ${totalKb.toFixed(1)}KB exceeds limit ${maxTotalKb}KB`);
}
if (largestChunk.sizeKb > maxChunkKb) {
  failures.push(
    `Largest gzipped chunk ${path.relative(process.cwd(), largestChunk.filePath)} (${largestChunk.sizeKb.toFixed(1)}KB) exceeds limit ${maxChunkKb}KB`,
  );
}

console.log('Bundle size report (gzipped):');
console.log(`- Total chunks: ${files.length}`);
console.log(`- Total size: ${totalKb.toFixed(1)}KB (limit: ${maxTotalKb}KB)`);
console.log(`- Largest chunk: ${path.relative(process.cwd(), largestChunk.filePath)} ${largestChunk.sizeKb.toFixed(1)}KB (limit: ${maxChunkKb}KB)`);

if (failures.length) {
  console.error('\nBundle size check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nBundle size check passed.');
