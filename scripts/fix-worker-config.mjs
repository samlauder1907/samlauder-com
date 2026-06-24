/**
 * Removes pages_build_output_dir from dist/server/wrangler.json after astro build.
 *
 * @astrojs/cloudflare v13 copies pages_build_output_dir from the source wrangler.toml
 * into the generated dist/server/wrangler.json. When Pages CI finds this field in
 * the generated config, it validates the file as a Pages config — which rejects
 * Workers-only keys (main, rules, assets) that the adapter also injects.
 *
 * Removing pages_build_output_dir makes Pages validate the generated config as a
 * Workers config instead, which accepts all those keys. The source wrangler.toml
 * keeps the field so Pages CI knows where the build output lives.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wranglerJsonPath = resolve(root, 'dist', 'server', 'wrangler.json');

const config = JSON.parse(readFileSync(wranglerJsonPath, 'utf-8'));

if ('pages_build_output_dir' in config) {
  delete config.pages_build_output_dir;
  writeFileSync(wranglerJsonPath, JSON.stringify(config));
  console.log('fix-worker-config: removed pages_build_output_dir from dist/server/wrangler.json');
} else {
  console.log('fix-worker-config: pages_build_output_dir already absent, no change needed');
}
