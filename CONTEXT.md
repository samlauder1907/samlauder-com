# samlauder.com — Build Context

## Current state
Phases 0–7 complete. Site is live on Cloudflare Pages at samlauder-com.pages.dev. Phase 8 (domain cutover) complete. Now building the Art Log feature (/artchel).

## Stack
- Astro 6.4.4, static output (`output: 'static'`, @astrojs/cloudflare adapter with platformProxy)
  - Astro 6 removed `output: 'hybrid'` — `output: 'static'` now behaves the same way (default-prerender, opt-out per page)
  - Adapter config: `imageService: 'passthrough'`, `prerenderEnvironment: 'node'` (required to avoid an ASSETS/SESSION binding conflict that breaks the build in the workerd prerender environment)
  - All existing pages remain statically prerendered
  - Art Log routes use `export const prerender = false` for server-rendering via Cloudflare Workers
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

## Blockers / notes
- None outstanding for the build itself
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
- [ ] Art Phase 6 — Deploy and verify live
