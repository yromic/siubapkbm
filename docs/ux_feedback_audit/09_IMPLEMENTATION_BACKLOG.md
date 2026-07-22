# Feedback Hardening Implementation Backlog

This document serves as the official implementation backlog for the 2-day UX Feedback Hardening Sprint prior to production deployment.

---

## Sprint Backlog by Priority

### Tier 1: Critical (Must Fix Immediately)

#### `TASK-01`: Migrate CMS Media Deletion `window.confirm` to `<ConfirmDialog />`
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **File**: `components/dashboard/cms/MediaTab.tsx`
- **Feedback Component**: `<ConfirmDialog />`
- **Reason**: Eliminates unstyled native browser popup that blocks UI thread.
- **Estimated Effort**: 30 minutes
- **Regression Risk**: Low

#### `TASK-02`: Migrate CMS Tab Unsaved Changes `window.confirm` to `<ConfirmDialog />`
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **File**: `app/(authenticated)/(modules)/settings/cms-landing/page.tsx`
- **Feedback Component**: `<ConfirmDialog />`
- **Reason**: Replaces native browser confirmation when switching tabs with dirty form state.
- **Estimated Effort**: 45 minutes
- **Regression Risk**: Low

#### `TASK-03`: Migrate CMS Section Publish `window.confirm` to `<ConfirmDialog />`
- **Affected Module**: Website CMS (`/settings/cms-landing`)
- **File**: `components/dashboard/cms/SectionsTab.tsx`
- **Feedback Component**: `<ConfirmDialog />`
- **Reason**: Replaces native browser popup when publishing sections to live site.
- **Estimated Effort**: 30 minutes
- **Regression Risk**: Low

---

### Tier 2: High Priority

#### `TASK-04`: Humanize Technical Server Error Toast Strings
- **Affected Module**: All Modules
- **File**: `lib/api/client.ts` / `lib/notify.ts`
- **Feedback Component**: `notify.error()`
- **Reason**: Prevents raw SQL or JSON syntax error codes from being displayed to non-technical users.
- **Estimated Effort**: 1 hour
- **Regression Risk**: Low

#### `TASK-05`: Add Explicit Feedback to Logout Failure Paths
- **Affected Module**: Authentication & Layout
- **File**: `app/(authenticated)/(modules)/layout.tsx`
- **Feedback Component**: `notify.loading()` and `notify.error()`
- **Reason**: Informs users if session revocation fails on server during logout attempt.
- **Estimated Effort**: 30 minutes
- **Regression Risk**: Low

---

### Tier 3: Medium Priority

#### `TASK-06`: Add Success Toast on Parent PIN Reset Completion
- **Affected Module**: Student Management
- **File**: `app/(authenticated)/(modules)/students/page.tsx`
- **Feedback Component**: `notify.success()`
- **Reason**: Eliminates hesitation after modal closes following a PIN reset.
- **Estimated Effort**: 20 minutes
- **Regression Risk**: Low

#### `TASK-07`: Disable Promotion Rule Submit Button During Asynchronous Execution
- **Affected Module**: Settings & Promotion
- **File**: `app/(authenticated)/(modules)/settings/promotion/page.tsx`
- **Feedback Component**: Inline button spinner (`Loader2`)
- **Reason**: Prevents potential double-click submissions during promotion rule saves.
- **Estimated Effort**: 20 minutes
- **Regression Risk**: Low

---

### Tier 4: Low / Cosmetic

#### `TASK-08`: Enhance Parent Dashboard Empty Grade State
- **Affected Module**: Parent Portal
- **File**: `app/parent/dashboard/page.tsx`
- **Feedback Component**: Empty State Card
- **Reason**: Adds descriptive explanatory text when no grades have been published by the school yet.
- **Estimated Effort**: 30 minutes
- **Regression Risk**: Low
