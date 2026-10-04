#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const fixedDate = new Date(Date.UTC(2026, 9, 4, 0, 0, 0));
const dosTime = ((fixedDate.getUTCHours() & 31) << 11) | ((fixedDate.getUTCMinutes() & 63) << 5) | ((fixedDate.getUTCSeconds() / 2) & 31);
const dosDate = (((fixedDate.getUTCFullYear() - 1980) & 127) << 9) | ((fixedDate.getUTCMonth() + 1) << 5) | fixedDate.getUTCDate();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const filename = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const compressed = zlib.deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(filename.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, filename, compressed);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(0x0314, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(dosTime, 12);
    record.writeUInt16LE(dosDate, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(raw.length, 24);
    record.writeUInt16LE(filename.length, 28);
    record.writeUInt16LE(0, 30);
    record.writeUInt16LE(0, 32);
    record.writeUInt16LE(0, 34);
    record.writeUInt16LE(0, 36);
    record.writeUInt32LE(0, 38);
    record.writeUInt32LE(offset, 42);
    central.push(record, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuffer, end]);
}

function walk(rel) {
  const absolute = path.join(root, rel);
  return fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap((entry) => {
    const child = path.posix.join(rel.replace(/\\/g, '/'), entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function readEntry(rel) {
  const absolute = path.resolve(root, rel);
  if (!absolute.startsWith(root + path.sep)) throw new Error(`Path escapes package: ${rel}`);
  return fs.readFileSync(absolute);
}

function sampleEntries() {
  const files = [...walk('samples'), 'SAMPLE-ASSETS-LICENSE.txt', 'SOURCE-ORIGINS.md'];
  return files.map((file) => [file.replace(/\\/g, '/'), readEntry(file)]);
}

function showcaseEntries() {
  const fixed = [
    'index.html', 'style.css', 'app.js', 'README.md', 'LICENSE', 'preview.png', 'scripts/build.cjs',
    'SAMPLE-ASSETS-LICENSE.txt', 'SOURCE-ORIGINS.md', 'VALIDATION.md',
  ];
  const files = [...fixed, ...walk('media'), ...walk('samples'), 'dist/free-samples.zip'];
  return files.map((file) => [file.replace(/\\/g, '/'), readEntry(file)]);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

fs.mkdirSync(dist, { recursive: true });
const sampleZip = makeZip(sampleEntries());
fs.writeFileSync(path.join(dist, 'free-samples.zip'), sampleZip);
const showcaseZip = makeZip(showcaseEntries());
fs.writeFileSync(path.join(dist, 'atelier-showcase.zip'), showcaseZip);
const manifest = {
  generatedBy: 'scripts/build.cjs',
  note: 'SHA-256 covers each packaged source, screenshot, sample, and generated ZIP; this manifest is external to avoid self-reference.',
  entries: Object.fromEntries([
    'index.html', 'style.css', 'app.js', 'README.md', 'LICENSE',
    'SAMPLE-ASSETS-LICENSE.txt', 'SOURCE-ORIGINS.md', 'VALIDATION.md',
    'preview.png', 'scripts/build.cjs', ...walk('media'), ...walk('samples'),
    'dist/free-samples.zip', 'dist/atelier-showcase.zip',
  ].sort((a, b) => a.localeCompare(b, 'en')).map((file) => [file.replace(/\\/g, '/'), sha256(readEntry(file))])),
};
fs.writeFileSync(path.join(dist, 'SHA256.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${Object.keys(manifest.entries).length} checksums in ${dist}`);
