---
title: Developer Setup
tags: [area:guides, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Developer Setup

## Use This When
- quickstart is not enough
- you need optional local infrastructure, worker flows, or validation commands

## Standard Local Stack
- Node.js 18+; Node.js 20+ recommended
- `npm`
- Supabase project credentials
- OpenAI API key

## Optional Local Extras
- Redis credentials if you want queue and lock behavior closer to production
- `NEXT_PUBLIC_APP_URL` if local callbacks should not assume `http://localhost:3000`

## First Validation Pass
1. `npm install`
2. `npm run typecheck`
3. `npm run build`
4. `GET /api/health`

## Read Next
- `docs/00-start-here/quickstart.md`
- `docs/guides/testing.md`
