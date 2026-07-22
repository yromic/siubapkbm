# Feedback Gap Analysis

This document summarizes the overall gaps between current feedback behavior and target enterprise standards.

---

## Gap Analysis Matrix

| ID | Action / Context | Current Feedback Behavior | Target Feedback Behavior | Priority | Complexity | Regression Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | CMS Media Delete | Native `window.confirm` | `<ConfirmDialog />` modal with red button | **Critical** | Low | Low |
| **GAP-02** | CMS Tab Switch | Native `window.confirm` | Unsaved Changes modal using `<ConfirmDialog />` | **Critical** | Low | Low |
| **GAP-03** | CMS Section Publish | Native `window.confirm` | `<ConfirmDialog />` modal explaining live update | **Critical** | Low | Low |
| **GAP-04** | Logout Action | Silent failure on 500 error | `notify.loading()` $\rightarrow$ `notify.error()` on drop | **High** | Low | Low |
| **GAP-05** | Student PIN Reset | Modal closes silently | `notify.success("PIN parent berhasil diperbarui.")` | **Medium** | Low | Low |
| **GAP-06** | Database Error Toast | Raw DB error string | Sanitized human message via `humanizeError()` | **High** | Low | Low |
| **GAP-07** | Promotion Submit | Button active during fetch | Disable submit button + inline `Loader2` spinner | **Medium** | Low | Low |
| **GAP-08** | Parent Dashboard Empty | Blank grade card | Descriptive card: *"Nilai belum dipublikasikan"* | **Low** | Low | Low |
