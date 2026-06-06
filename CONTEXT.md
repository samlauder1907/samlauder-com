# samlauder.com — Build Context

## Current state
Phase 1 scaffold complete. Phase 2 (layout/components) in progress.

## Stack
- Astro 6.4.4, static output
- @astrojs/react for interactive islands
- @astrojs/cloudflare adapter
- @notionhq/client for Notion API (build-time)
- Formspree for contact forms
- Deployed to Cloudflare Pages

## Repo
https://github.com/samlauder1907/samlauder-com

## Environment variables
- `NOTION_TOKEN` — Notion integration token (Recipes Vault DB: 9e38e7b2-1841-440d-b056-5a88098ef704)
- `FORMSPREE_CONTACT_ID` — contact form endpoint ID
- `FORMSPREE_GRIEVANCE_ID` — grievance portal endpoint ID

## Decisions
- Images stored in `public/images/` organised by section (home, portfolio, about, grievance, projects/[slug])
- Responsive Webflow variants downloaded; projects.js will reference full-size originals (no -p-NNN suffix) where available
- CSS-only hero slideshow using keyframe animation

## Blockers / notes
- Image download still running in background (ETA ~2 hrs from start)
- `.env` values need to be filled in (Notion token, Formspree IDs)

## Phases
- [x] Phase 0 — Pre-requisites
- [x] Phase 1 — Project scaffold
- [ ] Phase 2 — Layout and shared components
- [ ] Phase 3 — Static pages
- [ ] Phase 4 — Interactive components
- [ ] Phase 5 — Recipes
- [ ] Phase 6 — Local QA
- [ ] Phase 7 — Deploy to Cloudflare Pages
- [ ] Phase 8 — Domain cutover (flag before every step)
