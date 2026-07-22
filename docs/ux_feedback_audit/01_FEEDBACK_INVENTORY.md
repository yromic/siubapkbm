# Observable Feedback Inventory

This document inventory lists all feedback interaction points discovered in the SIUBA PKBM source code.

---

## Feedback Inventory Matrix

| Module | Screen / View | Trigger Action | Current Feedback Shown | Feedback Type | Component Used | Code Location | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/login` | Failed Login | Red Inline Alert Text | Error | Custom `setError()` state | `app/login/page.tsx#L127` | Verified |
| **Auth** | `/login` | ALTCHA Solver | Progress text | Loading | `<Altcha />` Component | `components/Altcha.tsx#L35` | Verified |
| **Auth** | `/login` | Account Locked | Red Alert Text | Warning | Custom `setError()` state | `app/login/page.tsx#L76` | Verified |
| **CMS** | `/settings/cms-landing` | Switch Tab with dirty state | Native Browser Popup | Confirm | `window.confirm()` | `app/.../cms-landing/page.tsx#L41` | **Violation** |
| **CMS** | `/settings/cms-landing` | Publish Section | Native Browser Popup | Confirm | `window.confirm()` | `SectionsTab.tsx#L587` | **Violation** |
| **CMS** | `/settings/cms-landing` | Delete Media Item | Native Browser Popup | Confirm | `window.confirm()` | `MediaTab.tsx#L147` | **Violation** |
| **CMS** | `/settings/cms-landing` | Save Section Draft | Loading toast $\rightarrow$ Success toast | Loading/Success | `notify.loading()` / `notify.success()` | `SectionsTab.tsx#L530` | Compliant |
| **CMS** | `/settings/cms-landing` | Upload Image | Loading toast $\rightarrow$ Success toast | Loading/Success | `notify.loading()` / `notify.success()` | `MediaTab.tsx#L72` | Compliant |
| **Student** | `/students` | Delete Student | Custom Modal Confirmation | Confirm | `<ConfirmDialog />` | `app/.../students/page.tsx` | Compliant |
| **Student** | `/students` | Create Student | Inline Validation / Success Toast | Success | `notify.success()` | `app/.../students/page.tsx` | Compliant |
| **Grade** | `/academic-scores` | Save Scores | Loading Spinner on Button | Loading | `Loader2` Inline Icon | `academic-scores/page.tsx` | Compliant |
| **Grade** | `/academic-scores` | Publish Scores | Confirmation Modal | Confirm | `<ConfirmDialog />` | `academic-scores/page.tsx` | Compliant |
| **Finance** | `/finance` | Verify SPP Payment | Modal Form Submission | Success | `notify.success()` | `finance/page.tsx` | Compliant |
| **System** | `/health-check` | Manual Backup | Loading Modal $\rightarrow$ Success Toast | Loading/Success | `notify.loading()` | `health-check/page.tsx` | Compliant |
| **System** | `/audit-log` | Search Logs | Table Skeleton Loader | Loading | Skeleton Row Component | `audit-log/page.tsx` | Compliant |
