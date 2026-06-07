# samlauder.com — Build Context

## Current state
Phases 0–7 complete. Site is live on Cloudflare Pages at samlauder-com.pages.dev. Now working through Phase 8 (domain cutover).

## Stack
- Astro 6.4.4, static output (`output: 'static'`, no adapter — site is fully static)
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

## Decisions
- Images stored in `public/images/` organised by section (home, portfolio, about, grievance, projects/[slug]) and committed to the repo
- Responsive Webflow `-p-NNN` variants and `.tmp` files excluded; `projects.js` references full-size originals only
- CSS-only hero slideshow using keyframe animation
- Grievance portal is a standalone page (no nav/footer) with a pink/rose card design; success state shows the same two header dog circles, "Thank You! 🐕" copy, and an "I'm not done!" button that resets the form client-side with no reload

## Blockers / notes
- None outstanding for the build itself

## Phases
- [x] Phase 0 — Pre-requisites
- [x] Phase 1 — Project scaffold
- [x] Phase 2 — Layout and shared components
- [x] Phase 3 — Static pages
- [x] Phase 4 — Interactive components
- [x] Phase 5 — Recipes
- [x] Phase 6 — Local QA
- [x] Phase 7 — Deploy to Cloudflare Pages (live at samlauder-com.pages.dev)
- [ ] Phase 8 — Domain cutover (flag before every step)
