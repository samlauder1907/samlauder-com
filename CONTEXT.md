# samlauder.com — Build Context

## Current state
Phases 0–7 complete and live. Phase 8 (domain cutover) complete. Art Log code (Phases 1–5) is complete and working locally. Art Phase 6 (production deploy) is BLOCKED — see the deployment blocker section below. The live site is currently on the last known-good rollback (commit 0cd090a, pre-Art Log). Decision on the deployment path forward is needed before proceeding.

## Stack
- Astro 6.4.4, static output (`output: 'static'`, @astrojs/cloudflare adapter with platformProxy)
  - Astro 6 removed `output: 'hybrid'` — `output: 'static'` now behaves the same way (default-prerender, opt-out per page)
  - Adapter config: `imageService: 'passthrough'`, `prerenderEnvironment: 'node'` (required to avoid ASSETS/SESSION binding conflicts in the workerd prerender environment)
  - `session: { driver: sessionDrivers.null() }` in astro.config.mjs prevents the adapter from auto-injecting a SESSION KV namespace
  - All existing pages remain statically prerendered
  - Art Log routes use `export const prerender = false` for server-rendering via Cloudflare Workers
  - **Deployment model:** @astrojs/cloudflare v13 targets "Workers with static assets" (not classic Cloudflare Pages). Build produces dist/client/ (static) and dist/server/ (Worker entry + wrangler.json). The Worker serves all routes: prerendered pages via env.ASSETS.fetch(), SSR pages dynamically.
  - **Build command:** `astro build && node scripts/fix-worker-config.mjs` — see deployment blocker section for what the post-build script is currently doing and why.
- @astrojs/react for interactive islands (LightboxGallery, RecipeBook — both `client:load`)
- Notion data pre-fetched at commit-time into `src/data/recipes.json` via `scripts/fetch-recipes.mjs` (re-run and commit whenever recipes change in Notion — Cloudflare Pages does not expose build-time secrets in its new UI, so the live API can't be called during the Cloudflare build)
- Formspree for contact and grievance forms
- Deployed to Cloudflare Pages (created as a "Pages" project, not "Workers")

## Repo
https://github.com/samlauder1907/samlauder-com (branch: main)

## Environment variables
- `NOTION_TOKEN` — used locally only, by `scripts/fetch-recipes.mjs` (Recipes Vault DB: 9e38e7b2-1841-440d-b056-5a88098ef704)
- `FORMSPREE_CONTACT_ID` — contact form endpoint ID
- `FORMSPREE_GRIEVANCE_ID` — grievance portal endpoint ID (set in `.env`, falls back to `mgvyognn`)
- `ART_LOG_PASSWORD` — Art Log shared password. In production: set as an encrypted binding in Cloudflare Pages → Settings → Bindings. Locally: set in `.dev.vars` (gitignored). Accessed via `Astro.locals.runtime.env.ART_LOG_PASSWORD`.

## Cloudflare resources (Art Log)
- **D1 database:** `samlauder-art-log` (ID: 87453463-b938-4fda-a258-3cfeb21c3313) — bound as `DB`
- **R2 bucket:** `samlauder-art-log` — bound as `ART_IMAGES`
- Both bound in Cloudflare Pages → Settings → Bindings (production) and in `wrangler.toml` (local dev via platformProxy)
- Local dev: `npm run dev` as before — platformProxy handles wrangler bindings transparently
- Image serving: `/artchel/images/[key]` endpoint reads from R2 and streams the response
- Session auth: stateless HMAC-signed cookie (no KV), 30-day expiry, verified server-side via Web Crypto API
- Cloudflare bindings: accessed via `import { env } from 'cloudflare:workers'` (Astro v6 removed `Astro.locals.runtime.env`)
- HEIC uploads: rejected with a user-friendly error (sips not available in Workers runtime)

## Decisions
- Images stored in `public/images/` organised by section (home, portfolio, about, grievance, projects/[slug]) and committed to the repo
- Responsive Webflow `-p-NNN` variants and `.tmp` files excluded; `projects.js` references full-size originals only
- CSS-only hero slideshow using keyframe animation
- Grievance portal is a standalone page (no nav/footer) with a pink/rose card design; success state shows the same two header dog circles, "Thank You! 🐕" copy, and an "I'm not done!" button that resets the form client-side with no reload

## DEPLOYMENT BLOCKER — Art Phase 6

### Root cause
`@astrojs/cloudflare` v13 dropped Cloudflare Pages support. It is designed for Cloudflare Workers (the newer "Workers with static assets" model, deployed via `wrangler deploy`), not Cloudflare Pages CI. The v12 adapter supported Pages but requires Astro 5; v14 requires Astro 7. With Astro 6, v13 is the only compatible version.

The adapter outputs:
- `dist/client/` — prerendered HTML + static assets
- `dist/server/wrangler.json` — Worker config (Workers-style, not Pages-style)
- `dist/server/entry.mjs` — Worker entry point

This structure does not match what Cloudflare Pages CI expects for any of its SSR deployment modes.

### Specific incompatibilities discovered (through 7 failed deploy attempts)

**1. `pages_build_output_dir` in source wrangler.toml triggers "v2 root directory strategy"**
Pages CI treats `pages_build_output_dir` as a signal to skip the build command entirely and serve directly from the repo. Since `dist/` is gitignored, the deployment is always empty. Removing it restores normal build behaviour.

**2. Generated `dist/server/wrangler.json` is in a subdirectory — Pages CI ignores it**
Pages CI only looks for `wrangler.json` at the root of the output directory, not in subdirectories. It never reads `dist/server/wrangler.json`, so the deployment proceeds as static-only regardless.

**3. `wrangler.json` at output root without `pages_build_output_dir` → skipped**
Moving the config to `dist/wrangler.json` doesn't help: Pages CI sees it, says "not a valid Pages config — missing `pages_build_output_dir`", logs a warning, and skips it.

**4. `wrangler.json` with `pages_build_output_dir` → rejects Workers-only keys**
Adding `pages_build_output_dir` back to the generated `dist/wrangler.json` causes Pages CI to validate it as a Pages config, which rejects `main`, `rules`, and `assets` as Workers-only fields. This is the circular incompatibility: the field is required to be accepted, but its presence triggers validation rules that reject the other required fields.

**5. `.wrangler/deploy/config.json` dangling pointer**
`astro build` generates `.wrangler/deploy/config.json` pointing to `dist/server/wrangler.json`. If that file is deleted or moved by the post-build script, Pages CI follows the pointer, finds nothing, and fails with "redirected configuration path does not exist."

**6. `dist/_worker.js` approach: Pages CI accepts it, Worker compiles, but 500s on D1-dependent routes**
With `_worker.js` at the output root and the build command running (no `pages_build_output_dir` in source wrangler.toml), Pages CI correctly finds and compiles the Worker. Static prerendered pages return 200. Login and auth cookie issuance work (302 with cookie set). However, SSR routes that query D1 (the Art Log gallery, piece detail, upload) return 500. Most likely cause: D1 binding not available to the Worker via `import { env } from 'cloudflare:workers'` in `_worker.js` mode, or an incompatibility between the adapter's cloudflare:workers import and how Pages provides bindings in advanced mode. This was the state of the final attempted deployment (commit 5e86d75) — NOT pushed to main, live site rolled back to 0cd090a.

### Current state of the codebase
The post-build script (`scripts/fix-worker-config.mjs`) is at the `_worker.js` approach from attempt 7. Source `wrangler.toml` has no `pages_build_output_dir`. The most recent commit on main (5e86d75) has this configuration but was not fully smoke-tested.

### Options for the path forward (decision needed)

**A. Debug the _worker.js D1 binding issue**
The `_worker.js` approach gets closest to working. The 500s on D1-dependent routes likely have a specific cause (e.g., `import { env } from 'cloudflare:workers'` not working in advanced mode — may need `request.env` or `ctx.env` instead). Worth investigating if the goal is to stay on the current architecture.

**B. Migrate Art Log SSR to Cloudflare Pages Functions**
Pages Functions (`/functions/artchel/[[catchall]].ts`) are native to Pages CI and always work. Requires rewriting the Art Log page logic as Functions-style handlers instead of Astro SSR pages. More work but architecturally correct for a Pages project.

**C. Deploy as a Cloudflare Worker (not Pages)**
Use GitHub Actions to run `wrangler deploy` from `dist/server/` after the build. The site becomes a Worker deployment (not Pages). Requires re-routing samlauder.com through Workers Routes instead of Pages. Significant operational change but technically correct for the v13 adapter.

**D. Downgrade to Astro 5 + adapter v12**
v12 has full Pages support. Would require downgrading Astro (breaking change) and all dependencies. Probably not the right call given Astro 6 is stable.

---

## Blockers / notes (pre-Art Log)
- Recipe images: covers are downloaded locally by `fetch-recipes.mjs` into `public/images/recipes/<slug>/`. 16 of 43 recipes have no cover set in Notion (rendered as a grey placeholder, by design). One recipe ("Caramel Oat Cookies") had its cover downloaded as HEIC (an iPhone photo format most browsers can't render) — fixed by converting to JPEG with `sips` and updating `fetch-recipes.mjs` to auto-convert HEIC/HEIF downloads to JPEG going forward

## Phases
- [x] Phase 0 — Pre-requisites
- [x] Phase 1 — Project scaffold
- [x] Phase 2 — Layout and shared components
- [x] Phase 3 — Static pages
- [x] Phase 4 — Interactive components
- [x] Phase 5 — Recipes
- [x] Phase 6 — Local QA
- [x] Phase 7 — Deploy to Cloudflare Pages (live at samlauder-com.pages.dev)
- [x] Phase 8 — Domain cutover

## Art Log phases (/artchel)
- [x] Art Phase 1 — Plan, provision (R2 + D1 created and bound), wrangler.toml, hybrid adapter
- [x] Art Phase 2 — D1 schema migration, login + session auth
- [x] Art Phase 3 — /artchel/upload (create piece, add progress photo, R2 upload)
- [x] Art Phase 4 — /artchel gallery, /artchel/[slug] detail + private field gating
- [x] Art Phase 5 — Local QA
- [ ] Art Phase 6 — Deploy and verify live (BLOCKED — see deployment blocker section)
