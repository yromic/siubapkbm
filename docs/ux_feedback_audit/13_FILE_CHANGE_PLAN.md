# File Change Plan

This file-level plan lists every source file expected to be modified during the UX Hardening Sprint, including the scope of change, regression risk, and testing requirements.

---

## File Change Inventory

### 1. `components/dashboard/cms/MediaTab.tsx`
- **Related Task**: `TASK-01`
- **Reason for Change**: Replace `window.confirm` with `<ConfirmDialog />` for media deletion.
- **Estimated Scope**: ~15 lines modified/added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `<ConfirmDialog />`.
- **Testing Needs**: Manual click deletion $\rightarrow$ verify modal $\rightarrow$ confirm deletion.

---

### 2. `app/(authenticated)/(modules)/settings/cms-landing/page.tsx`
- **Related Task**: `TASK-02`
- **Reason for Change**: Replace `window.confirm` with `<ConfirmDialog />` for unsaved tab switch warning.
- **Estimated Scope**: ~20 lines modified/added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `<ConfirmDialog />`.
- **Testing Needs**: Edit CMS field $\rightarrow$ switch tabs $\rightarrow$ verify warning modal.

---

### 3. `components/dashboard/cms/SectionsTab.tsx`
- **Related Task**: `TASK-03`
- **Reason for Change**: Replace `window.confirm` with `<ConfirmDialog />` for section publishing.
- **Estimated Scope**: ~15 lines modified/added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `<ConfirmDialog />`.
- **Testing Needs**: Click publish section $\rightarrow$ verify confirmation modal.

---

### 4. `lib/api/client.ts`
- **Related Task**: `TASK-04`
- **Reason for Change**: Add error message humanization helper (`humanizeError`) to sanitize raw database error codes before passing to UI.
- **Estimated Scope**: ~25 lines added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Formats API error instances globally.
- **Testing Needs**: Code review + test server error handling.

---

### 5. `app/(authenticated)/(modules)/layout.tsx`
- **Related Task**: `TASK-05`
- **Reason for Change**: Add explicit toast notifications (`notify.loading`, `notify.error`) during user logout.
- **Estimated Scope**: ~10 lines modified.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `notify.ts`.
- **Testing Needs**: Click Logout $\rightarrow$ verify loading toast $\rightarrow$ verify redirect.

---

### 6. `app/(authenticated)/(modules)/students/page.tsx`
- **Related Task**: `TASK-06`
- **Reason for Change**: Add `notify.success("PIN parent berhasil diperbarui.")` on parent PIN reset.
- **Estimated Scope**: ~2 lines added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `notify.ts`.
- **Testing Needs**: Reset parent PIN $\rightarrow$ verify green success toast.

---

### 7. `app/(authenticated)/(modules)/settings/promotion/page.tsx`
- **Related Task**: `TASK-07`
- **Reason for Change**: Bind `disabled={loading}` and `<Loader2 className="animate-spin" />` on Promotion Rule submit button.
- **Estimated Scope**: ~5 lines modified.
- **Regression Risk**: Low.
- **Shared Component Impact**: Uses `lucide-react`.
- **Testing Needs**: Click Save Rule $\rightarrow$ verify button disables with spinner.

---

### 8. `app/parent/dashboard/page.tsx`
- **Related Task**: `TASK-08`
- **Reason for Change**: Add descriptive empty state card when student grades are not yet published.
- **Estimated Scope**: ~15 lines added.
- **Regression Risk**: Low.
- **Shared Component Impact**: Inline JSX styling.
- **Testing Needs**: Log in as parent without published grades $\rightarrow$ verify empty card.
