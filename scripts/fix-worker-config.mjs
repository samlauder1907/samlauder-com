/**
 * Post-processes dist/server/wrangler.json after astro build.
 *
 * @astrojs/cloudflare auto-injects assets.binding = "ASSETS" into the
 * generated worker config. "ASSETS" is reserved in Cloudflare Pages projects,
 * so Pages rejects it at deploy time. Pages also rejects an [assets] block in
 * the source wrangler.toml, so we can't suppress the injection via config.
 *
 * This script renames the binding to "STATIC" after the build. Our Worker
 * code does not reference this binding — Pages serves static files via
 * pages_build_output_dir directly — so the rename is safe.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wranglerJsonPath = resolve(root, 'dist', 'server', 'wrangler.json');

const config = JSON.parse(readFileSync(wranglerJsonPath, 'utf-8'));

if (config.assets?.binding === 'ASSETS') {
  config.assets.binding = 'STATIC';
  writeFileSync(wranglerJsonPath, JSON.stringify(config));
  console.log('fix-worker-config: renamed assets.binding ASSETS → STATIC');
} else {
  console.log(`fix-worker-config: assets.binding is "${config.assets?.binding ?? '(unset)'}", no change needed`);
}
