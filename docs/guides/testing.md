---
title: Testing Guide
tags: [area:guides, audience:developers, status:current]
owner: repo-maintainers
last_updated: 2026-03-12
---

# Testing Guide

## What Exists Today
- `npm run typecheck`
- `npm run lint`
- `npm run lint:i18n`
- `npm run build`
- `npm run test:personality`
- two Vitest-style workshop test files without a package script

## Practical Test Order
1. `npm run typecheck`
2. `npm run build`
3. `npm run lint`
4. targeted manual or Vitest runs for affected workshop/job code

## Workshop/Job Tests
- `npx vitest run src/lib/workshop/runTranslationTick.test.ts`
- `npx vitest run src/lib/workshop/__tests__/stuckChunkRecovery.test.ts`

## Gaps
- No unified `npm test` workflow
- No repo-local end-to-end test harness is documented

## Read Next
- `docs/00-start-here/dev-commands.md`
- `docs/03-guides/troubleshooting.md`
