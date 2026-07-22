# Production-Focused UX Hardening Testing Plan

This document outlines the manual verification and smoke-testing protocols required to validate the sprint execution prior to production deployment.

---

## 1. Manual Verification Scenarios

### Test Suite A: Native Alert Elimination
- **Test A1 (Media Delete)**: Navigate to `/settings/cms-landing` $\rightarrow$ Media tab $\rightarrow$ click delete icon.
  - *Expected Result*: `<ConfirmDialog />` opens with title *"Hapus Media Ini?"* and red button. No browser alert popups appear.
- **Test A2 (CMS Tab Switch)**: Edit a field in CMS landing page $\rightarrow$ click another tab.
  - *Expected Result*: `<ConfirmDialog />` opens warning about unsaved changes.
- **Test A3 (CMS Publish)**: Click publish section in CMS landing page.
  - *Expected Result*: `<ConfirmDialog />` opens confirming publication.

### Test Suite B: Notification & Toast Feedback
- **Test B1 (Parent PIN Reset)**: Navigate to `/students` $\rightarrow$ click Reset PIN $\rightarrow$ submit new PIN.
  - *Expected Result*: Green success toast `"PIN parent berhasil diperbarui."` displays at top-right.
- **Test B2 (Logout Feedback)**: Click "Keluar" in navigation sidebar.
  - *Expected Result*: Loading toast `"Proses keluar..."` displays, then redirects to `/login`.

### Test Suite C: Loading & Button State
- **Test C1 (Promotion Rule Save)**: Navigate to `/settings/promotion` $\rightarrow$ edit rule $\rightarrow$ click Save.
  - *Expected Result*: Save button disables immediately and shows spinning icon (`Loader2`).

### Test Suite D: Empty States
- **Test D1 (Parent Dashboard Empty Grades)**: Log in as parent of student with zero published grades.
  - *Expected Result*: Empty state card displays icon and text *"Nilai Belum Dipublikasikan"*.

---

## 2. Regression Checklist
- [ ] Verify non-cms dialogs function normally.
- [ ] Verify standard toast notifications dismiss automatically after 3 seconds.
- [ ] Verify login flow operates correctly with ALTCHA solver.
