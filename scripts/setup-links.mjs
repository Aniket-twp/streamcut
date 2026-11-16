#!/usr/bin/env node
/**
 * Installs yt-dlp for link import.
 * 1. Downloads the official Windows binary into tools/ and verifies its SHA-256.
 * 2. If that fails, falls back to a project-local Python venv.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS = path.join(ROOT, 'tools');
const EXE = path.join(TOOLS, 'yt-dlp.exe');
const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';

async function downloadWithChecksum() {
  fs.mkdirSync(TOOLS, { recursive: true });
  const sumsRes = await fetch(`${RELEASE}/SHA2-256SUMS`);
  if (!sumsRes.ok) throw new Error(`checksum download failed (${sumsRes.status})`);
  const sums = await sumsRes.text();
  const line = sums.split('\n').find((row) => row.trim().endsWith('yt-dlp.exe'));
  if (!line) throw new Error('could not find the yt-dlp.exe checksum');
  const expected = line.split(/\s+/)[0];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${RELEASE}/yt-dlp.exe`);
    if (!res.ok) throw new Error(`binary download failed (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const actual = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actual === expected) {
      fs.writeFileSync(EXE, buffer);
      return buffer.length;
    }
    console.warn(`  attempt ${attempt}: checksum mismatch, retrying…`);
  }
  throw new Error('the downloaded binary kept failing verification');
}

function installWithPython() {
  console.log('Falling back to a Python venv…');
  const python = process.platform === 'win32' ? 'py' : 'python3';
  execFileSync(python, ['-m', 'venv', path.join(ROOT, '.venv')], { stdio: 'inherit' });
  const pip = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
  execFileSync(pip, ['-m', 'pip', 'install', '--quiet', 'yt-dlp'], { stdio: 'inherit' });
}

async function main() {
  console.log('Setting up yt-dlp for link import…');
  try {
    if (process.platform !== 'win32') throw new Error('standalone binary fallback is Windows-only');
    const size = await downloadWithChecksum();
    console.log(`Installed ${path.relative(ROOT, EXE)} (${(size / 1048576).toFixed(1)} MB, checksum verified).`);
  } catch (error) {
    console.warn(`  ${error.message}`);
    installWithPython();
    console.log('Installed yt-dlp into .venv.');
  }
  console.log('Done. Restart the app with "npm run dev", then paste a Twitch/YouTube/Kick link.');
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exit(1);
});
