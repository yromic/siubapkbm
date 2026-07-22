# Standard Module Audit Report Structure

Every individual module audit report generated using this framework MUST conform to the standardized outline below.

---

# [MODULE NAME] — UX Heuristic Audit Report

## 1. Executive Summary
- Overall Module Usability Score (0 – 100)
- Total Findings Breakdown by Severity (Critical, High, Medium, Low, Cosmetic)
- Summary of Key Obstacles and Architectural Friction Points
- Strategic Impact Statement

---

## 2. Module Overview & Scope
- **Module Name**: [Module Name]
- **Primary Routes**: `/path/1`, `/path/2`
- **Key Sub-systems**: [List of child components/modals]

---

## 3. Primary Personas & User Goals

| Persona | Primary Goal | Frequency | Key Constraints |
| :--- | :--- | :--- | :--- |
| **Administrator** | Bulk student enrollment & status changes | Daily | High data density required |
| **Teacher** | Grade entry & character evaluation | Weekly | Mobile & desktop access |

---

## 4. User Flow & Screen Inventory
- **User Journey Diagrams**: Mermaid flow diagrams tracing primary tasks.
- **Screen List**:
  - `Screen 01`: Main Dashboard View
  - `Screen 02`: Detail Modal
  - `Screen 03`: Form Editor

---

## 5. State Coverage Audit Matrix

| Screen / View | Ideal State | Empty State | Loading State | Error State | Partial State |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Main View** | ✅ Pass | ❌ Fail | ⚠️ Partial | ❌ Fail | ✅ Pass |
| **Create Form** | ✅ Pass | N/A | ⚠️ Partial | ❌ Fail | N/A |

---

## 6. Detailed Heuristic Findings
*(Contains all findings compiled using the `02_FINDING_TEMPLATE.md` structure)*

---

## 7. Quick Wins (Low Effort, High Impact)
- List of immediate UI/UX fixes that require minimal development effort and low regression risk.

---

## 8. Long-Term Strategic Improvements
- Structural changes, major layout overhauls, and design system updates required for complete resolution.

---

## 9. Priority Matrix & Implementation Roadmap

```
  HIGH IMPACT  ┌─────────────────────┬─────────────────────┐
               │    QUICK WINS       │  STRATEGIC REFACTORS│
               │ (High Priority)     │ (Planned Roadmap)   │
               ├─────────────────────┼─────────────────────┤
               │   LOW PRIORITY      │    FILL-INS / DEBT  │
               │ (Backlog Items)     │ (Defer / Reconsider)│
  LOW IMPACT   └─────────────────────┴─────────────────────┘
                     LOW EFFORT            HIGH EFFORT
```

---

## 10. Conclusion & Next Steps
- Summary of audit sign-off.
- Recommended timeline for verification re-audits.
