/**
 * Post-processes the astro build output for Cloudflare Pages compatibility.
 *
 * @astrojs/cloudflare v13 generates output for the "Workers with static assets"
 * model (wrangler deploy), not Cloudflare Pages CI. The output structure is:
 *   dist/client/   — prerendered HTML + static assets
 *   dist/server/   — Worker entry (entry.mjs) + wrangler.json
 *
 * Pages CI behaviour summary (discovered through trial):
 *  - wrangler.json in a subdirectory (dist/server/) → ignored entirely
 *  - wrangler.json at output root (dist/) WITHOUT pages_build_output_dir
 *    → "not a valid Pages config, skipping" → treated as static-only
 *  - wrangler.json at output root (dist/) WITH pages_build_output_dir
 *    → validated as Pages config → rejects Workers-only keys (main, rules, assets)
 *  - _worker.js at output root → accepted as the Worker entry point ✓
 *
 * This script produces a _worker.js-based deployment:
 *   1. Copies dist/client/* to dist/ so prerendered HTML is at the output root.
 *      env.ASSETS (auto-provided in _worker.js mode) can then serve them by URL.
 *   2. Creates dist/_worker.js re-exporting the adapter's server entry.
 *   3. Removes dist/server/wrangler.json — this file is no longer needed and
 *      would create a dangling pointer in .wrangler/deploy/config.json.
 *   4. Deletes .wrangler/deploy/config.json. astro build auto-generates this
 *      pointing to dist/server/wrangler.json. After step 3 deletes that target,
 *      Pages CI would fail trying to follow the dangling pointer. Removing the
 *      deploy config entirely lets Pages CI find _worker.js through normal lookup.
 *
 * In _worker.js mode, Pages automatically provides:
 *   - env.ASSETS: static files in the output directory (used by the Worker to
 *     serve prerendered pages via app.render() → env.ASSETS.fetch())
 *   - env.DB, env.ART_IMAGES, ART_LOG_PASSWORD: from Pages project settings
 */

import { cpSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Promote static files from dist/client/ to dist/ root.
//    In _worker.js mode, env.ASSETS serves all files in the output directory.
//    Prerendered HTML must be at the output root for URL paths to resolve.
cpSync(resolve(root, 'dist/client'), resolve(root, 'dist'), { recursive: true });
console.log('fix-worker-config: copied dist/client/* → dist/');

// 2. Create dist/_worker.js — the entry point Pages CI recognises for Workers.
writeFileSync(
  resolve(root, 'dist/_worker.js'),
  `export { default } from './server/entry.mjs';\n`
);
console.log('fix-worker-config: created dist/_worker.js');

// 3. Remove dist/server/wrangler.json.
//    This file inherited pages_build_output_dir + Workers-only keys, causing Pages
//    CI to either reject it or create a dangling pointer. Not needed for _worker.js.
try {
  rmSync(resolve(root, 'dist/server/wrangler.json'));
  console.log('fix-worker-config: removed dist/server/wrangler.json');
} catch {
  console.log('fix-worker-config: dist/server/wrangler.json already absent');
}

// 4. Delete .wrangler/deploy/config.json.
//    astro build generates this file pointing to dist/server/wrangler.json.
//    After step 3 removes that file, Pages CI would follow the dangling pointer
//    and fail. Deleting the deploy config lets Pages CI use normal lookup instead,
//    finding dist/_worker.js as the Worker entry point.
try {
  rmSync(resolve(root, '.wrangler/deploy/config.json'));
  console.log('fix-worker-config: deleted .wrangler/deploy/config.json');
} catch {
  console.log('fix-worker-config: .wrangler/deploy/config.json already absent');
}
