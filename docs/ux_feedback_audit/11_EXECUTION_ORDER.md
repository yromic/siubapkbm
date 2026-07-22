# Sprint Execution Order & Phasing Plan

This document defines the safest, risk-mitigated execution sequence for the 2-day UX Feedback Hardening Sprint.

---

## 1. Execution Sequence Overview

```
Phase 1: Global Utilities (TASK-04)
   │
   ▼
Phase 2: Native Alert Replacement (TASK-01, TASK-02, TASK-03)
   │
   ▼
Phase 3: Toast & Session Feedback (TASK-05, TASK-06)
   │
   ▼
Phase 4: Loading & Form Protection (TASK-07)
   │
   ▼
Phase 5: Empty State Guidance (TASK-08)
   │
   ▼
Phase 6: Final Verification & Smoke Testing
```

---

## 2. Phase Breakdown & Rationale

### Phase 1: Low-Risk Global Utilities (Day 1 - Morning)
- **Tasks**: `TASK-04` (Humanize Technical Server Error Toast Strings)
- **Rationale**: Building the error sanitization helper first ensures that subsequent task updates automatically benefit from clean, non-technical error messages.

### Phase 2: Native Alert Replacement (Day 1 - Afternoon)
- **Tasks**: `TASK-01` (CMS Media Delete), `TASK-02` (CMS Tab Unsaved Changes), `TASK-03` (CMS Section Publish)
- **Rationale**: Replacing native `window.confirm()` calls eliminates critical UX flaws and thread-blocking browser popups. Grouping all 3 CMS native alert tasks together maximizes focus on the CMS module codebase.

### Phase 3: Toast & Session Feedback (Day 2 - Morning)
- **Tasks**: `TASK-05` (Logout Failure Feedback), `TASK-06` (Parent PIN Reset Toast)
- **Rationale**: Fills high-visibility notification gaps in core authentication and student management flows using the existing `notify.ts` library.

### Phase 4: Loading & Form Protection (Day 2 - Midday)
- **Tasks**: `TASK-07` (Disable Promotion Rule Submit Button)
- **Rationale**: Ensures async operations prevent double-submits.

### Phase 5: Empty State Guidance (Day 2 - Afternoon)
- **Tasks**: `TASK-08` (Enhance Parent Dashboard Empty State)
- **Rationale**: Enhances read-only parent portal cards without touching complex interaction logic.

### Phase 6: Final Verification & Smoke Testing (Day 2 - Late Afternoon)
- **Tasks**: Execute Production Readiness Checklist (`15_PRODUCTION_CHECKLIST.md`)
- **Rationale**: Validates zero TypeScript errors, zero lint errors, and complete elimination of native popups prior to production sign-off.
