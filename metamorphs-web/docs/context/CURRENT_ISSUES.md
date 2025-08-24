## Current Issues

Use this list to track known issues, tech debt, and active investigations.

### Open Items

- Clarify DB schema source of truth and add migrations if missing
- Normalize API error shapes across `app/api/*`
- Document environment variable requirements for local development

### Recently Fixed

- Placeholder for recent fixes with links to PRs/commits

### Monitoring & Alerts

- Define minimal logging and error tracking policy for API routes

---

## CURRENT_ISSUES

- Validate inferred DB schema vs Supabase project; add migrations if not tracked
- Consider adding DB realtime or server-sent events for live updates
- Standardize API error shapes across all routes
- Centralize env var validation on startup
- Add logging/observability for API route errors
