# Master UX Hardening Implementation Plan

This master document details every actionable engineering task for the 2-day UX Feedback Hardening Sprint before production deployment.

---

## Task Specifications

### `TASK-01`: Migrate CMS Media Deletion `window.confirm` to `<ConfirmDialog />`
- **Purpose**: Eliminate unstyled native browser popup that blocks the UI thread on media asset deletion.
- **Related Audit Finding**: `GAP-01` ([02_NATIVE_ALERT_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/02_NATIVE_ALERT_AUDIT.md#L10))
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **Affected Screens**: Media Manager Tab
- **Affected Components**: `MediaTab.tsx`
- **Affected Files**: `components/dashboard/cms/MediaTab.tsx`
- **Existing Component to Reuse**: `<ConfirmDialog />` from `components/ui/confirm-dialog.tsx`
- **Implementation Steps**:
  1. Add `deleteConfirmOpen` and `selectedMediaId` state variables.
  2. Replace `if (window.confirm(...))` with setting `deleteConfirmOpen(true)` and saving the target ID.
  3. Render `<ConfirmDialog />` with title *"Hapus Media Ini?"*, message *"Media ini akan dihapus secara permanen dari server. Tindakan ini tidak dapat dibatalkan."*, variant `"destructive"`.
  4. Invoke existing deletion handler upon dialog confirmation.
- **Expected User Behavior**: Clicking the delete button opens a themed modal. Clicking "Hapus" deletes the image; clicking "Batal" closes the modal.
- **Definition of Done**: Zero `window.confirm` calls in `MediaTab.tsx`; modal displays styled red button; media deleted successfully.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (30 mins).
- **Dependencies**: None.
- **Verification Method**: Click delete icon on CMS media item $\rightarrow$ confirm modal appears with red button.
- **Rollback Strategy**: Revert changes to `MediaTab.tsx`.

---

### `TASK-02`: Migrate CMS Tab Unsaved Changes `window.confirm` to `<ConfirmDialog />`
- **Purpose**: Replace native popup when switching tabs with unsaved draft content.
- **Related Audit Finding**: `GAP-02` ([02_NATIVE_ALERT_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/02_NATIVE_ALERT_AUDIT.md#L25))
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **Affected Screens**: CMS Landing Page
- **Affected Components**: `page.tsx`
- **Affected Files**: `app/(authenticated)/(modules)/settings/cms-landing/page.tsx`
- **Existing Component to Reuse**: `<ConfirmDialog />`
- **Implementation Steps**:
  1. Add `pendingTab` and `unsavedModalOpen` states.
  2. Intercept tab switch when `dirty === true`, setting `unsavedModalOpen(true)` and preserving `pendingTab`.
  3. Render `<ConfirmDialog />` with title *"Tinggalkan Halaman dengan Perubahan Belum Disimpan?"*, message *"Perubahan pada tab ini akan hilang jika Anda berpindah tab tanpa menyimpan."*, variant `"warning"`.
  4. Perform tab switch on confirm; clear `pendingTab` on cancel.
- **Expected User Behavior**: Switching tabs with dirty state prompts a styled warning dialog.
- **Definition of Done**: Zero `window.confirm` calls in `cms-landing/page.tsx`.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (45 mins).
- **Dependencies**: None.
- **Verification Method**: Modify a CMS section field $\rightarrow$ click another tab $\rightarrow$ warning modal appears.
- **Rollback Strategy**: Revert changes to `page.tsx`.

---

### `TASK-03`: Migrate CMS Section Publish `window.confirm` to `<ConfirmDialog />`
- **Purpose**: Replace native browser confirmation when publishing CMS sections.
- **Related Audit Finding**: `GAP-03` ([02_NATIVE_ALERT_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/02_NATIVE_ALERT_AUDIT.md#L40))
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **Affected Screens**: Sections Tab
- **Affected Components**: `SectionsTab.tsx`
- **Affected Files**: `components/dashboard/cms/SectionsTab.tsx`
- **Existing Component to Reuse**: `<ConfirmDialog />`
- **Implementation Steps**:
  1. Add `publishConfirmOpen` state.
  2. Replace `if (window.confirm(...))` with setting `publishConfirmOpen(true)`.
  3. Render `<ConfirmDialog />` with title *"Publikasikan Perubahan Section?"*, message *"Perubahan ini akan langsung diperbarui pada situs web publik."*, variant `"default"`.
  4. Trigger publish API call on confirm.
- **Expected User Behavior**: User receives themed confirmation dialog prior to publishing sections.
- **Definition of Done**: Zero `window.confirm` calls in `SectionsTab.tsx`.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (30 mins).
- **Dependencies**: None.
- **Verification Method**: Click publish section button $\rightarrow$ styled modal appears $\rightarrow$ confirms publish.
- **Rollback Strategy**: Revert changes to `SectionsTab.tsx`.

---

### `TASK-04`: Humanize Technical Server Error Toast Strings
- **Purpose**: Prevent raw database query errors or JSON syntax codes from displaying to users.
- **Related Audit Finding**: `GAP-06` ([06_VALIDATION_MESSAGE_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/06_VALIDATION_MESSAGE_AUDIT.md#L10))
- **Affected Module**: Global / All Modules
- **Affected Screens**: Global API Client Error Handling
- **Affected Components**: `notify.ts` / `client.ts`
- **Affected Files**: `lib/api/client.ts`
- **Existing Component to Reuse**: `notify.error()`
- **Implementation Steps**:
  1. Create a `humanizeError(err: unknown): string` utility function mapping database/syntax errors to friendly Indonesian text.
  2. Sanitize error messages in `ApiError` instantiation and `notify.error()` handlers.
- **Expected User Behavior**: Friendly, understandable error toasts instead of raw technical codes.
- **Definition of Done**: `humanizeError` maps `ER_DUP_ENTRY`, `ERR_DATABASE`, and `SyntaxError` cleanly.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (1 hour).
- **Dependencies**: None.
- **Verification Method**: Trigger duplicate entry error $\rightarrow$ friendly toast appears.
- **Rollback Strategy**: Revert helper function.

---

### `TASK-05`: Add Explicit Feedback to Logout Failure Paths
- **Purpose**: Inform users if server-side session revocation fails during logout.
- **Related Audit Finding**: `GAP-04` ([03_TOAST_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/03_TOAST_AUDIT.md#L10))
- **Affected Module**: Navigation / Layout
- **Affected Screens**: Staff Portal Header
- **Affected Components**: Layout Header Navigation
- **Affected Files**: `app/(authenticated)/(modules)/layout.tsx`
- **Existing Component to Reuse**: `notify.loading()`, `notify.error()`
- **Implementation Steps**:
  1. Trigger `const tId = notify.loading("Proses keluar...")` on logout button click.
  2. Wrap server logout call in `try/catch`.
  3. Dismiss loading toast and show error toast if server call throws, while proceeding with local session clearance.
- **Expected User Behavior**: User sees feedback during logout and is warned if server connection dropped.
- **Definition of Done**: Toast appears during logout attempt.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (30 mins).
- **Dependencies**: None.
- **Verification Method**: Click logout $\rightarrow$ loading toast displays $\rightarrow$ redirects to login.
- **Rollback Strategy**: Revert changes to `layout.tsx`.

---

### `TASK-06`: Add Success Toast on Parent PIN Reset Completion
- **Purpose**: Provide feedback after resetting a student's parent PIN.
- **Related Audit Finding**: `GAP-05` ([03_TOAST_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/03_TOAST_AUDIT.md#L25))
- **Affected Module**: Student Management
- **Affected Screens**: Student Directory (`/students`)
- **Affected Components**: Reset PIN Modal
- **Affected Files**: `app/(authenticated)/(modules)/students/page.tsx`
- **Existing Component to Reuse**: `notify.success()`
- **Implementation Steps**:
  1. Locate `handleResetPin` completion handler.
  2. Add `notify.success("PIN parent berhasil diperbarui.")` upon modal submit success.
- **Expected User Behavior**: Green success toast appears immediately after resetting a PIN.
- **Definition of Done**: Toast displays upon PIN reset.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (20 mins).
- **Dependencies**: None.
- **Verification Method**: Reset PIN on student $\rightarrow$ green toast displays.
- **Rollback Strategy**: Revert changes to `students/page.tsx`.

---

### `TASK-07`: Disable Promotion Rule Submit Button During Asynchronous Execution
- **Purpose**: Prevent potential double-click form submissions on promotion rule saves.
- **Related Audit Finding**: `GAP-07` ([05_LOADING_AND_PROGRESS_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/05_LOADING_AND_PROGRESS_AUDIT.md#L25))
- **Affected Module**: Settings & Promotion
- **Affected Screens**: Promotion Rules (`/settings/promotion`)
- **Affected Components**: Promotion Form
- **Affected Files**: `app/(authenticated)/(modules)/settings/promotion/page.tsx`
- **Existing Component to Reuse**: Inline `Loader2` spinner
- **Implementation Steps**:
  1. Ensure `loading` state is set during `handleSaveRule`.
  2. Bind `disabled={loading}` and render `<Loader2 className="animate-spin" />` inside the submit button.
- **Expected User Behavior**: Button disables and shows spinner while saving.
- **Definition of Done**: Submit button disabled during async fetch.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (20 mins).
- **Dependencies**: None.
- **Verification Method**: Click Save Rule $\rightarrow$ button disables immediately with spinner.
- **Rollback Strategy**: Revert changes to `promotion/page.tsx`.

---

### `TASK-08`: Enhance Parent Dashboard Empty Grade State
- **Purpose**: Add guidance when no grades have been published by the school yet.
- **Related Audit Finding**: `GAP-08` ([07_EMPTY_STATE_AUDIT.md](file:///d:/w/siubapkbm/docs/ux_feedback_audit/07_EMPTY_STATE_AUDIT.md#L15))
- **Affected Module**: Parent Portal
- **Affected Screens**: Parent Dashboard (`/parent/dashboard`)
- **Affected Components**: Grade Overview Card
- **Affected Files**: `app/parent/dashboard/page.tsx`
- **Existing Component to Reuse**: Empty state layout
- **Implementation Steps**:
  1. Add conditional empty container when `grades.length === 0`.
  2. Display icon + headline *"Nilai Belum Dipublikasikan"* + text *"Nilai semester ini akan muncul setelah dipublikasikan oleh pihak sekolah."*
- **Expected User Behavior**: Friendly explanatory card replaces blank container.
- **Definition of Done**: Empty state card displays guidance text when no grades exist.
- **Regression Risk**: Low.
- **Estimated Complexity**: Low (30 mins).
- **Dependencies**: None.
- **Verification Method**: Log in as parent of student without published grades $\rightarrow$ empty state card displays.
- **Rollback Strategy**: Revert changes to `parent/dashboard/page.tsx`.
