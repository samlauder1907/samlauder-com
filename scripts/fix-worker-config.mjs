/**
 * Post-processes the astro build output for Cloudflare Pages compatibility.
 *
 * @astrojs/cloudflare v13 generates output for the "Workers with static assets"
 * deployment model (wrangler deploy), not Cloudflare Pages CI. It produces:
 *   dist/client/   — prerendered HTML + static assets
 *   dist/server/   — Worker entry (entry.mjs) + wrangler.json
 *
 * The generated dist/server/wrangler.json is in a SUBDIRECTORY of the output.
 * Pages CI looks for wrangler.json at the ROOT of the output directory (dist/).
 * It ignores wrangler.json files in subdirectories, so the deployment ends up
 * as a static-only site with no Worker — all SSR routes return 404.
 *
 * This script:
 *   1. Creates dist/wrangler.json at the output root — a valid Workers config
 *      with the correct relative paths to entry.mjs and the client assets.
 *      Crucially, it omits pages_build_output_dir so Pages validates it as a
 *      Workers config (not a Pages config), which allows main/rules/assets.
 *   2. Removes dist/server/wrangler.json to prevent Pages from finding and
 *      trying to validate it alongside the new root-level config.
 *
 * With this in place, Pages CI reads dist/wrangler.json, deploys the Worker
 * from dist/server/entry.mjs, and serves static assets from dist/client/.
 * The Worker's env.ASSETS binding is configured to point to dist/client/,
 * so prerendered pages are served via env.ASSETS.fetch() and SSR routes are
 * rendered dynamically.
 */

import { writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 1. Create dist/wrangler.json at the output directory root.
//    Pages CI looks here (not in subdirectories) for the Worker config.
//    No pages_build_output_dir → validated as Workers config → main/rules/assets accepted.
const workerConfig = {
  name: 'samlauder-com',
  compatibility_date: '2024-09-23',
  // Worker entry — relative to dist/ (the output root)
  main: './server/entry.mjs',
  // Static assets binding — serves dist/client/ via env.ASSETS in the Worker
  assets: {
    binding: 'ASSETS',
    directory: './client',
  },
  // Required so Pages treats .mjs files as ES modules
  rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'samlauder-art-log',
      database_id: '87453463-b938-4fda-a258-3cfeb21c3313',
    },
  ],
  r2_buckets: [
    {
      binding: 'ART_IMAGES',
      bucket_name: 'samlauder-art-log',
    },
  ],
};

writeFileSync(resolve(root, 'dist/wrangler.json'), JSON.stringify(workerConfig, null, 2));
console.log('fix-worker-config: created dist/wrangler.json (output root Worker config)');

// 2. Remove dist/server/wrangler.json to avoid Pages CI finding a second
//    wrangler.json in a subdirectory and getting confused.
try {
  rmSync(resolve(root, 'dist/server/wrangler.json'));
  console.log('fix-worker-config: removed dist/server/wrangler.json');
} catch {
  console.log('fix-worker-config: dist/server/wrangler.json already absent');
}
