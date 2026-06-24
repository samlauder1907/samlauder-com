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
 * This script bridges the gap:
 *   1. Copies dist/client/* to dist/ so static HTML is at the output root.
 *   2. Creates dist/_worker.js re-exporting the server entry, giving Pages
 *      a Worker entry point it can find.
 *   3. Removes dist/server/wrangler.json so Pages doesn't try to validate
 *      it (it contains Workers-only keys that fail Pages config validation).
 *
 * In _worker.js mode, Pages automatically provides env.ASSETS (static files
 * in the output dir), env.DB (D1), env.ART_IMAGES (R2), and ART_LOG_PASSWORD
 * via the bindings configured in the Pages project settings.
 */

import { cpSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Promote static files from dist/client/ to dist/ root.
//    Pages _worker.js mode serves static files from the output root.
cpSync(resolve(root, 'dist/client'), resolve(root, 'dist'), { recursive: true });
console.log('fix-worker-config: copied dist/client/* → dist/');

// 2. Create dist/_worker.js — Pages advanced mode entry point.
//    Re-exports the adapter-generated Worker, which routes prerendered pages
//    via env.ASSETS and SSR pages via dynamic rendering.
writeFileSync(
  resolve(root, 'dist/_worker.js'),
  `export { default } from './server/entry.mjs';\n`
);
console.log('fix-worker-config: created dist/_worker.js');

// 3. Remove dist/server/wrangler.json.
//    It contains pages_build_output_dir + Workers-only keys (main, rules, assets)
//    which Pages CI rejects when validating as a Pages config.
//    With _worker.js present, Pages doesn't need this file.
try {
  rmSync(resolve(root, 'dist/server/wrangler.json'));
  console.log('fix-worker-config: removed dist/server/wrangler.json');
} catch {
  console.log('fix-worker-config: dist/server/wrangler.json already absent');
}
