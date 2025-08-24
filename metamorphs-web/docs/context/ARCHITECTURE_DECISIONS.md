## Architecture Decisions (ADRs)

Keep a concise record of significant technical decisions and their context.

### ADR Template

- Context: What problem are we solving? Why now?
- Decision: What did we choose and alternatives considered?
- Consequences: Positive/negative outcomes, trade-offs
- Status: Proposed | Accepted | Deprecated | Superseded by X

### ADR Index

1. Use Next.js App Router for API and pages — Status: Accepted
2. Supabase for Auth + Data — Status: Accepted
3. OpenAI-compatible client abstraction in `lib/ai/openai.ts` — Status: Accepted

### Notes

- For major changes, add a dated ADR entry and link to relevant PRs

---

## ARCHITECTURE_DECISIONS

1. Next.js App Router + Route Handlers

- Decision: Use file-based routing and server handlers for APIs
- Consequences: Simple co-location, good DX; keep heavy logic in `server/*`
- Status: Accepted

2. Supabase for Auth + Data + Storage

- Decision: Use Supabase client/SSR helpers; RLS policies for multi-tenant safety
- Consequences: Simplified auth and data; must manage envs and RLS
- Status: Accepted

3. Client State via Zustand + React Query

- Decision: Lightweight global UI state with Zustand; React Query for server data
- Consequences: Clear separation of UI vs server state
- Status: Accepted

4. OpenAI for Translation/Moderation

- Decision: Leverage OpenAI SDK for translation and moderation endpoints
- Consequences: External dependency and cost; add rate limits and caching
- Status: Accepted

5. Feature Flags for Incremental Enablement

- Decision: `NEXT_PUBLIC_FEATURE_*` to guard optional features (router, enhancer, translator)
- Consequences: Safer rollout, slightly more branching in code
- Status: Accepted
