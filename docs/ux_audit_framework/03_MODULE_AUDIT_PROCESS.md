# Standard Module Audit Process

This document defines the 11-step sequential workflow for auditing any individual module within an enterprise web application. Following this exact pipeline guarantees thoroughness and prevents missed interaction states.

---

## The 11-Step Audit Pipeline

```
 1. Module Discovery  ──>  2. User Goal Discovery ──>  3. Persona Mapping
          │
          ▼
 4. User Flow Mapping ──>  5. Screen Inventory    ──>  6. State Inventory
          │
          ▼
 7. Heuristic Eval    ──>  8. Severity Assignment ──>  9. Recommendations
          │
          ▼
10. Regression Check  ──> 11. Final Module Synthesis
```

---

### Step 1: Module Discovery
- Map out the boundaries of the module.
- Identify all primary routes, endpoints, sub-components, and modals belonging to the target module.
- Define dependencies on other modules (e.g., how Student Management depends on Class Setup).

### Step 2: User Goal Discovery
- List the core tasks users must accomplish within this module.
- Distinguish between high-frequency tasks (daily operations) and low-frequency tasks (initial configuration).

### Step 3: Persona Identification
- Identify which user roles interact with this module (e.g., Super Admin, Administrator, Teacher, Student, Parent).
- Note cognitive profiles, environment constraints (mobile vs desktop), and permissions for each persona.

### Step 4: User Flow Mapping
- Trace step-by-step user journeys for each primary task.
- Document inputs, decisions, transitions, and terminal success/failure screens.

### Step 5: Screen Inventory
- Catalogue all distinct views, pages, dialogs, drawers, and tabs inside the module.
- Record visual hierarchy, layout grid, and component compositions.

### Step 6: State Inventory
- Inspect every screen across all 5 operational states:
  1. **Ideal State**: Full dataset loaded cleanly.
  2. **Empty State**: Zero records (fresh setup or filtered out).
  3. **Loading State**: Initial fetch, lazy loading, submission loading.
  4. **Error State**: Field validation error, server 500, network disconnect.
  5. **Partial State**: Pagination limits, restricted role permissions.

### Step 7: Heuristic Evaluation
- Evaluate each screen and state against the **10 Nielsen Usability Heuristics Checklist** (Document 05).
- Gather DOM, visual, and interaction evidence for every detected violation.

### Step 8: Severity Assignment
- Grade each finding using the **5-Tier Severity Matrix** (Document 01).
- Assess user impact, business impact, and frequency.

### Step 9: Recommendation & Solution Design
- Formulate concrete solutions for each finding.
- Split recommendations into **Quick Wins** (CSS/text tweaks) and **Strategic Refactors** (architectural/component overhaul).

### Step 10: Regression Risk Consideration
- Evaluate potential side effects of recommended UI/UX changes on other components or existing user habits.
- Ensure fixes do not break existing accessibility attributes or backend contracts.

### Step 11: Final Module Synthesis & Sign-off
- Compile findings into the standardized Module Audit Report structure (Document 04).
- Calculate the module's overall Usability Score and Priority Index.
