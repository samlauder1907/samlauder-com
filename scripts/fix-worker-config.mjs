/**
 * Post-processes the astro build output for Cloudflare Pages compatibility.
 *
 * @astrojs/cloudflare v13 targets the "Workers with static assets" deployment
 * model (deployed via `wrangler deploy`), not Cloudflare Pages CI. It outputs:
 *   dist/client/   — prerendered HTML + static assets
 *   dist/server/   — Worker entry (entry.mjs) + wrangler.json
 *
 * Pages CI looks for a Worker at dist/_worker.js (Pages advanced mode).
 * It does not find Workers in dist/server/, so it falls back to pure static
 * serving — which means SSR routes all 404.
 *
 * This script produces a Pages-compatible build:
 *   1. Copies dist/client/* to dist/ so static HTML is at the output root.
 *   2. Creates dist/_worker.js, the Worker entry point Pages looks for.
 *   3. Creates dist/_routes.json, restricting the Worker to /artchel/* only.
 *      Without this, Pages sends ALL requests through the Worker — including
 *      prerendered pages — which fails inconsistently. With _routes.json,
 *      prerendered pages are served by Pages directly from static files, and
 *      the Worker only handles the Art Log SSR routes it actually needs to.
 *   4. Removes dist/server/wrangler.json so Pages doesn't validate its
 *      Workers-only keys (main, rules, assets) against Pages config rules.
 */

import { cpSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Promote static files from dist/client/ to dist/ root.
cpSync(resolve(root, 'dist/client'), resolve(root, 'dist'), { recursive: true });
console.log('fix-worker-config: copied dist/client/* → dist/');

// 2. Create dist/_worker.js — Pages advanced mode Worker entry point.
writeFileSync(
  resolve(root, 'dist/_worker.js'),
  `export { default } from './server/entry.mjs';\n`
);
console.log('fix-worker-config: created dist/_worker.js');

// 3. Create dist/_routes.json — restrict Worker to Art Log routes only.
//
//    In _worker.js mode, Pages sends ALL requests through the Worker by default.
//    _routes.json lets us limit the Worker to /artchel/* (the SSR routes).
//    Everything else (prerendered HTML, static assets) is served by Pages CDN
//    directly from the static files promoted in step 1 — no Worker involved.
writeFileSync(
  resolve(root, 'dist/_routes.json'),
  JSON.stringify(
    {
      version: 1,
      include: ['/artchel', '/artchel/*'],
      exclude: [],
    },
    null,
    2
  )
);
console.log('fix-worker-config: created dist/_routes.json (Worker handles /artchel/* only)');

// 4. Remove dist/server/wrangler.json so Pages doesn't validate it.
//    It inherits pages_build_output_dir + Workers-only keys that Pages rejects.
try {
  rmSync(resolve(root, 'dist/server/wrangler.json'));
  console.log('fix-worker-config: removed dist/server/wrangler.json');
} catch {
  console.log('fix-worker-config: dist/server/wrangler.json already absent');
}
