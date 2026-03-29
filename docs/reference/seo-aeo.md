---
title: SEO and AEO Reference
tags: [area:reference, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# SEO and AEO Reference

## Current Repo Reality
- The app has basic metadata in `translalia-web/src/app/layout.tsx`.
- No sitemap, robots file, or dedicated SEO/AEO subsystem is documented in the current repo.
- No search-index or answer-engine-specific pipeline is present in the documentation or main app code.

## Guidance
- Treat SEO/AEO as minimal and mostly static until the repo adds explicit infrastructure or product requirements.
- If you introduce SEO/AEO features, document the concrete files, metadata generation path, and deployment assumptions.

## Read Next
- `docs/01-architecture/system-overview.md`
