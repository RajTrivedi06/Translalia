# Claude Code Instructions

## What this file is for
Repository-specific guidance for Claude Code and similar coding agents.

## Read first
- `docs/INDEX.md`
- `docs/05-llm/DOC_MAP.md`
- `docs/00-start-here/quickstart.md`
- `docs/01-architecture/system-overview.md`

## Working rules
- Use root `docs/` as the canonical documentation set.
- Use `translalia-web/docs/` only for prompt and translation-pipeline deep references.
- Put temporary notes, inventories, and investigation outputs only in `docs/agent-temp/`.
- Prefer concise cross-links to duplicated prose.

## When code changes require doc updates
- API route/interface change: update `docs/02-reference/api.md` and `specs/openapi.yaml`
- Env/config change: update `docs/02-reference/config-and-env.md` and `specs/config.schema.json`
- Translation or prompt-path change: update `docs/05-llm/DOC_MAP.md` and the relevant file in `translalia-web/docs/`

## Commands
From `translalia-web/`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

## Documentation maintenance
- Do not load deprecated docs first just because they are longer.
- Reconcile docs with current code before adding new narrative.
- Keep permanent docs agent-focused: concrete paths, contracts, invariants, flags, and next files to open.

## Installed Skills (Global)

Skills are installed globally at `~/.agents/skills/` and available across all projects.

### Core UI Skills
| Skill | Source | Invoke | Description |
|-------|--------|--------|-------------|
| Frontend Design | `anthropics/skills` | `/frontend-design` | Production-grade UI with bold aesthetics and intentional animation |
| UI-UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill` | `/ui-ux-pro-max` | UX strategy and conversion-driven design systems |
| UI Animation | `mblode/agent-skills` | `/ui-animation` | Motion design, easing curves, CSS/Framer Motion transitions |
| Web Design Guidelines | `vercel-labs/agent-skills` | `/web-design-guidelines` | 100+ rules for accessibility, performance, and modern UX |

### Accessibility Skills (AccessLint)
| Skill | Invoke | Description |
|-------|--------|-------------|
| Contrast Checker | `/contrast-checker` | WCAG color contrast validation |
| Link Purpose | `/link-purpose` | Ensure meaningful link text |
| Use of Color | `/use-of-color` | Check color isn't sole indicator |
| Refactor | `/refactor` | Accessibility-focused code refactoring |

### Developer Productivity Skills
| Skill | Source | Invoke | Description |
|-------|--------|--------|-------------|
| Code Review Quality | `proffesor-for-testing/agentic-qe` | `/code-review-quality` | Code quality analysis and refactoring suggestions |
| Browser Use | `kudosx/claude-skill-browser-use` | `/browser-use` | Automate browser interactions, screenshots, testing |
| TDD | `mattpocock/skills` | `/tdd` | Test-driven development workflow |

### Built-in Claude Code Skills
| Skill | Invoke | Description |
|-------|--------|-------------|
| Simplify | `/simplify` | Review code for reuse, quality, and efficiency |
| Agent Development | `/agent-development` | Guidance on creating Claude Code agents |
| Find Skills | `/find-skills` | Discover and install new skills |
| MCP Integration | `/mcp-integration` | Configure MCP servers |

### Skill Management
```bash
# Search for skills
npx skills find <query>

# Install a skill globally
npx skills add <owner/repo@skill> -g -y

# Check for updates
npx skills check

# Update all skills
npx skills update
```
