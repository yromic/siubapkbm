# Enterprise UX Severity Matrix

The UX Severity Matrix defines a 5-tier classification system for evaluating usability defects in enterprise web applications. Assigning severity ensures engineering and product teams prioritize high-impact usability issues over minor visual polishes.

---

## 1. Severity Classification Overview

| Severity Level | Icon | User Impact | Business Impact | Priority SLA |
| :--- | :---: | :--- | :--- | :--- |
| **Critical** | 🚨 | Task completion impossible; data loss or system block | High churn risk; operations halted; support calls spike | Immediate Fix (Sprint Hotfix) |
| **High** | ⚠️ | Significant friction; workaround required; user confusion | Decreased productivity; user frustration | High Priority (Next Sprint) |
| **Medium** | ⚡ | Moderate inefficiency; inconsistent behavior; extra steps | Slower workflow; sub-optimal user satisfaction | Scheduled Backlog |
| **Low** | ℹ️ | Minor inconvenience; small visual/alignment flaw | Negligible impact on productivity | Low Priority Refactor |
| **Cosmetic** | 🎨 | Micro-copy typo, minor color mismatch, subtle spacing | No functional impact | Design Polish / Good-to-have |

---

## 2. Detailed Severity Definitions

### Level 1: Critical Usability Defect (Critical)
- **Definition**: A severe breakdown in the interface that prevents users from completing a primary goal or causes unintentional data corruption/loss.
- **User Impact**: Complete task block. The user cannot proceed without expert technical intervention or abandoning the session.
- **Business Impact**: Severe operational failure, data inaccuracy, increased support burden, and complete loss of trust.
- **Characteristics**:
  - Unhandled application crashes or infinite loading loops without recovery options.
  - Destructive actions executed without confirmation or undo capabilities.
  - Critical validation failures that lock forms permanently.
  - Total lack of feedback during high-stakes financial or administrative operations.

### Level 2: High Usability Defect (High)
- **Definition**: A major usability obstacle that significantly slows down the user, creates severe confusion, or forces complex workarounds.
- **User Impact**: The user can complete the task, but experiences extreme frustration, cognitive overload, or high error risk.
- **Business Impact**: Reduced operational efficiency, high training costs, and frequent operator errors.
- **Characteristics**:
  - Ambiguous button labels on critical multi-step actions (e.g., "Submit" vs "Save").
  - Lack of search/filter feedback resulting in repeated full-page reloads or lost context.
  - Error messages that state failure without explaining how to resolve it.
  - Mobile/responsive layouts where primary action buttons overlap or become unreachable.

### Level 3: Medium Usability Defect (Medium)
- **Definition**: Inconsistencies or design gaps that cause temporary hesitation, unnecessary clicks, or mild cognitive friction.
- **User Impact**: Mild hesitation or extra steps needed to achieve a routine task.
- **Business Impact**: Cumulative productivity drop over time across large user bases.
- **Characteristics**:
  - Inconsistent button placements across different CRUD modules.
  - Missing hover/active feedback on interactive elements.
  - Lack of keyboard navigation support in data tables.
  - Truncated text strings without tooltips in dense data tables.

### Level 4: Low Usability Defect (Low)
- **Definition**: Small usability flaws that do not hinder task completion or cause confusion, but violate design system standards.
- **User Impact**: Barely noticeable; does not impede workflow efficiency.
- **Business Impact**: Minimal impact on perception of product quality.
- **Characteristics**:
  - Inconsistent spacing (margin/padding) between card items.
  - Non-standard icon choices for secondary actions.
  - Micro-animations that feel slightly abrupt.

### Level 5: Cosmetic Usability Defect (Cosmetic)
- **Definition**: Purely visual or typographical inconsistencies that have zero impact on usability or task execution.
- **User Impact**: None.
- **Business Impact**: None.
- **Characteristics**:
  - Minor typos in descriptive body text.
  - Slight color tint variance in neutral border styles.
