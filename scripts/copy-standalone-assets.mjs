#!/usr/bin/env node
// Next.js with output: 'standalone' produces a minimal server bundle at
// .next/standalone/ but does NOT include the client-side static assets
// (CSS, JS chunks, fonts, images) — those live at .next/static/ and
// public/, and the standalone server expects to find them at
// .next/standalone/.next/static/ and .next/standalone/public/.
//
// Without this step, the server runs but every CSS/JS request returns 404
// and the site renders completely unstyled.
//
// We use symlinks instead of copies so re-running `npm run build` doesn't
// double the on-disk size and so the symlinks always point at fresh
// content.

import { existsSync, mkdirSync, rmSync, symlinkSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  // Standalone output is disabled — nothing to do.
  process.exit(0);
}

function relink(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[copy-standalone-assets] source missing, skipping: ${src}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  // Remove anything already there (file, dir, or stale symlink).
  if (existsSync(dest) || (() => {
    try { return !!lstatSync(dest); } catch { return false; }
  })()) {
    rmSync(dest, { recursive: true, force: true });
  }
  symlinkSync(src, dest, 'dir');
  console.log(`[copy-standalone-assets] linked ${dest} → ${src}`);
}

relink(join(root, '.next', 'static'),  join(standalone, '.next', 'static'));
relink(join(root, 'public'),           join(standalone, 'public'));
