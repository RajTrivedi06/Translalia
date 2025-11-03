# Documentation Cleanup Plan

**Date:** 2025-01-27  
**Purpose:** Identify which documentation files to keep (move to `/docs/`) vs delete

---

## 📁 KEEP AND MOVE TO `/docs/` (Permanent Architectural Documentation)

### Context/Architecture Documentation

These are long-term reference docs that document the system architecture:

**From `metamorphs-web/docs/context/`:**

- `API_ROUTES.md` → `docs/context/API_ROUTES.md`
- `ARCHITECTURE_DECISIONS.md` → `docs/context/ARCHITECTURE_DECISIONS.md`
- `CODEBASE_OVERVIEW.md` → `docs/context/CODEBASE_OVERVIEW.md`
- `COMPONENTS_STRUCTURE.md` → `docs/context/COMPONENTS_STRUCTURE.md`
- `CURRENT_ISSUES.md` → `docs/context/CURRENT_ISSUES.md`
- `DATABASE_SCHEMA.md` → `docs/context/DATABASE_SCHEMA.md`
- `DEPLOYMENT_GUIDE.md` → `docs/context/DEPLOYMENT_GUIDE.md`
- `ERROR_HANDLING.md` → `docs/context/ERROR_HANDLING.md`
- `LLM_INTEGRATION_GUIDE.md` → `docs/context/LLM_INTEGRATION_GUIDE.md`
- `PERFORMANCE_OPTIMIZATION.md` → `docs/context/PERFORMANCE_OPTIMIZATION.md`
- `RELATIONSHIPS.md` → `docs/context/RELATIONSHIPS.md`
- `SECURITY_GUIDELINES.md` → `docs/context/SECURITY_GUIDELINES.md`
- `SERVICES_INTEGRATIONS.md` → `docs/context/SERVICES_INTEGRATIONS.md`
- `STATE_MANAGEMENT.md` → `docs/context/STATE_MANAGEMENT.md`
- `TESTING_STRATEGIES.md` → `docs/context/TESTING_STRATEGIES.md`
- `UTILITIES_HELPERS.md` → `docs/context/UTILITIES_HELPERS.md`
- `domains/authentication.md` → `docs/context/domains/authentication.md`
- `domains/business-logic.md` → `docs/context/domains/business-logic.md`
- `domains/data-flow.md` → `docs/context/domains/data-flow.md`
- `domains/user-management.md` → `docs/context/domains/user-management.md`

### API Documentation

**From `metamorphs-web/docs/`:**

- `llm-api.md` → `docs/api/llm-api.md`
- `flow-api.md` → `docs/api/flow-api.md`

### Policy Documentation

**From `metamorphs-web/docs/`:**

- `moderation-policy.md` → `docs/policies/moderation-policy.md`
- `spend-and-cache-policy.md` → `docs/policies/spend-and-cache-policy.md`

### Configuration Documentation

**From `metamorphs-web/docs/`:**

- `flags-and-models.md` → `docs/configuration/flags-and-models.md`

### Already in `/docs/`:

- `docs/diagnostics/new_chat_state_leak.md` ✅ (keep as-is)

**Total to move:** 26 files

---

## ✅ KEEP (Leave in Current Location)

### Project README Files

- `README.md` (root) - Main project README
- `metamorphs-web/README.md` - Web app README

### Component Documentation

- `metamorphs-web/src/components/guide/README.md` - Component-specific guide

### Style Guides

- `_docs/STYLE.md` - Documentation style guide

**Total to keep in place:** 3 files

---

## 🗑️ DELETE (Temporary/Session-Specific Documentation)

### Root Level Session/Implementation Reports

1. `API_INTEGRATION_COMPLETE.md` - Session completion report
2. `CODEBASE_ANALYSIS_COMPREHENSIVE.md` - One-time analysis
3. `DNDCONTEXT_ANALYSIS.md` - Implementation investigation
4. `DNDCONTEXT_INDEX.md` - Temporary index
5. `DNDCONTEXT_SUMMARY.md` - Implementation summary
6. `DNDCONTEXT_TESTING_GUIDE.md` - Temporary testing guide
7. `DOCUMENTATION_INDEX.md` - Temporary index
8. `FEATURE_VERIFICATION_SOURCE_WORD_DRAG.md` - Verification report (completed)
9. `FORMATTING_PRESERVATION_GUIDE.md` - Implementation guide (completed)
10. `IMPLEMENTATION_SUMMARY.md` - Session summary
11. `IMPLEMENTATION_VERIFICATION.md` - Verification report
12. `IMPLEMENTATION_VERIFICATION_REPORT.md` - Verification report
13. `PHASE4_I18N_IMPLEMENTATION.md` - Phase completion report
14. `RE_INVESTIGATION_CRITICAL_ISSUES.md` - Investigation report
15. `SESSION_COMPLETION_SUMMARY.md` - Session summary
16. `SESSION_PHASE4_SUMMARY.md` - Phase summary
17. `TRANSLATION_ZONE_INTENT_INTEGRATION.md` - Implementation guide (completed)
18. `VERIFICATION_COMPLETE.md` - Verification report
19. `VERIFICATION_REPORT.md` - Verification report

### Metamorphs-web/docs Phase Documentation

**From `metamorphs-web/docs/`:** 20. `DND_PHASE1_INVESTIGATION.md` - Phase investigation 21. `DND_PHASE2_DRAG_SOURCE.md` - Phase implementation 22. `DND_PHASE3_DROP_ZONE.md` - Phase implementation 23. `DND_PHASE4_EDIT_MODE.md` - Phase implementation 24. `DND_PHASE5_AI_ASSISTANT_IMPLEMENTATION.md` - Phase implementation 25. `DND_PHASE5_AI_ASSISTANT_PLAN.md` - Phase planning 26. `PHASE6_COMPLETE.md` - Phase completion 27. `PHASE6_SUMMARY.md` - Phase summary 28. `PHASE7_COMPLETE.md` - Phase completion 29. `PHASE7_SUMMARY.md` - Phase summary 30. `PHASE8_COMPLETE.md` - Phase completion 31. `POEM_LINE_SEPARATION_REPORT.md` - Implementation report 32. `PROJECT_COMPLETE_SUMMARY.md` - Project summary

### Archive (Can be Deleted - Historical)

**From `metamorphs-web/docs/archive/`:** 33. `phase-0.2-0.3-audit.md` - Old audit (archived) 34. `security-mvp-followups.md` - Old followups (archived)

### Duplicate .context Files (Old Location)

**From `metamorphs-web/.context/`:** 35. `API_ROUTES.md` - Duplicate (moved to docs/context/) 36. `ARCHITECTURE_DECISIONS.md` - Duplicate 37. `CODEBASE_OVERVIEW.md` - Duplicate 38. `COMPONENTS_STRUCTURE.md` - Duplicate 39. `CURRENT_ISSUES.md` - Duplicate 40. `DATABASE_SCHEMA.md` - Duplicate 41. `SERVICES_INTEGRATIONS.md` - Duplicate 42. `STATE_MANAGEMENT.md` - Duplicate 43. `UTILITIES_HELPERS.md` - Duplicate

**Total to delete:** 43 files

---

## Summary

| Category             | Count | Action                                      |
| -------------------- | ----- | ------------------------------------------- |
| **Move to `/docs/`** | 26    | Permanent architectural/API/policy docs     |
| **Keep in place**    | 3     | README files and style guide                |
| **Delete**           | 43    | Temporary session/implementation/phase docs |
| **Total files**      | 72    |                                             |

---

## Final Structure After Cleanup

```
/docs/
├── context/
│   ├── API_ROUTES.md
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── CODEBASE_OVERVIEW.md
│   ├── COMPONENTS_STRUCTURE.md
│   ├── CURRENT_ISSUES.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── ERROR_HANDLING.md
│   ├── LLM_INTEGRATION_GUIDE.md
│   ├── PERFORMANCE_OPTIMIZATION.md
│   ├── RELATIONSHIPS.md
│   ├── SECURITY_GUIDELINES.md
│   ├── SERVICES_INTEGRATIONS.md
│   ├── STATE_MANAGEMENT.md
│   ├── TESTING_STRATEGIES.md
│   ├── UTILITIES_HELPERS.md
│   └── domains/
│       ├── authentication.md
│       ├── business-logic.md
│       ├── data-flow.md
│       └── user-management.md
├── api/
│   ├── llm-api.md
│   └── flow-api.md
├── policies/
│   ├── moderation-policy.md
│   └── spend-and-cache-policy.md
├── configuration/
│   └── flags-and-models.md
└── diagnostics/
    └── new_chat_state_leak.md
```

---

## Notes

- All session summaries, implementation reports, and phase completion docs are temporary and should be deleted once features are complete
- The architectural documentation in `metamorphs-web/docs/context/` represents the permanent knowledge base
- API and policy docs are long-term reference materials
- The `.context/` directory appears to be an old location and contains duplicates
