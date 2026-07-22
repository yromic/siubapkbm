# Toast Notification Audit

This document audits all toast notification feedback across the application to eliminate missing feedback, technical jargon, and duplicate alerts.

---

## 1. Audit Findings & Gaps

### Finding 1: Silent Failure on Session Logout
- **Location**: `app/(authenticated)/(modules)/layout.tsx` (Logout Action)
- **Evidence**: Clicking "Keluar" triggers session revocation, but if the network drops or API returns 500, no toast is shown to the user.
- **Impact**: User assumes they logged out when session remains active locally.
- **Recommendation**: Wrap logout trigger in `notify.loading("Proses keluar...")` and handle `notify.error("Gagal mencabut sesi pada server. Sesi lokal dibersihkan.")`.
- **Priority**: **High**

---

### Finding 2: Cryptic Error Toast on File Import
- **Location**: `app/(authenticated)/(modules)/import/page.tsx`
- **Evidence**: On CSV parse error, `notify.error(err.message)` presents raw SQL or JSON parse messages like `SyntaxError: Unexpected token , in JSON`.
- **Impact**: Non-technical teachers and admins cannot understand why their import failed.
- **Recommendation**: Sanitize error message using humanized error mapper (`humanizeError(err)`) before passing to `notify.error()`.
- **Priority**: **High**

---

### Finding 3: Missing Success Toast on Student PIN Reset
- **Location**: `app/(authenticated)/(modules)/students/page.tsx`
- **Evidence**: When resetting a parent PIN, the modal closes silently without displaying a success toast confirming the new PIN was saved.
- **Impact**: User hesitates and repeats the PIN reset action unnecessarily.
- **Recommendation**: Add `notify.success("PIN parent berhasil diperbarui.")` upon modal submit resolution.
- **Priority**: **Medium**

---

### Finding 4: Duplicate Toast Triggers on Rollover Execution
- **Location**: `app/(authenticated)/(modules)/settings/rollover/page.tsx`
- **Evidence**: Both the inline component and the underlying service call trigger separate success toasts simultaneously.
- **Impact**: Two overlapping green toasts appear on the screen.
- **Recommendation**: Consolidate toast triggers so only the UI component handler invokes `notify.success()`.
- **Priority**: **Medium**

---

## 2. Toast Standard Compliance
- Provider: Sonner (`<SonnerToaster />` in `app/layout.tsx`).
- Helper Wrapper: `lib/notify.ts`.
- Compliance Status: Highly standardized; implementation only requires filling identified gaps in edge-case user actions.
