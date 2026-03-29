# Development Commands

## What this file is for
Verified command list for day-to-day work in `translalia-web/`.

## App Commands

| Command | Source | Purpose |
| --- | --- | --- |
| `npm install` | package manager | Install app dependencies using `package-lock.json`. |
| `npm run dev` | `package.json` | Start local Next.js dev server. |
| `npm run build` | `package.json` | Build production output. |
| `npm run start` | `package.json` | Run the production build locally. |

## Quality and Validation

| Command | Source | Purpose |
| --- | --- | --- |
| `npm run typecheck` | `package.json` | Run TypeScript without emitting files. |
| `npm run lint` | `package.json` | Run Next.js lint configuration. |
| `npm run lint:i18n` | `package.json` | Check locale message files. |
| `npm run test:personality` | `package.json` | Run the translator-personality script. |
| `npx vitest run src/lib/workshop/runTranslationTick.test.ts` | inline test file comment | Run translation tick tests; no package script exists yet. |
| `npx vitest run src/lib/workshop/__tests__/stuckChunkRecovery.test.ts` | inline test file comment | Run stuck-chunk recovery tests; no package script exists yet. |

## Worker and Investigation

| Command | Source | Purpose |
| --- | --- | --- |
| `npm run worker:translations` | `package.json` | Run the background translation/alignment worker. |
| `node scripts/i18n/check-messages.cjs` | script path | Directly run i18n validation if needed outside npm. |
| `node scripts/test-translator-personality.cjs` | script path | Directly test translator personality generation. |

## Notes
- There is no repo-wide `npm test` script at the time of writing.
- The two workshop test files exist, but Vitest is not wired into `package.json`.
- Production queue and lock behavior depend on Redis; see `docs/02-reference/config-and-env.md` before using the worker outside local experimentation.
