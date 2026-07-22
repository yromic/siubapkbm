# Loading & Progress Indicator Audit

This document audits feedback provided during asynchronous operations, lazy loading, and long-running background tasks.

---

## 1. Audit Findings by State

### 1.1 Initial Screen Data Loading
- **Current Pattern**: `<LoadingState />` or skeleton rows.
- **Audit Result**: Compliant. Top-level routes display centered loading spinners or skeleton loaders while fetching initial data.

### 1.2 Form Submissions (Create / Edit / Save)
- **Current Pattern**: Button disabled + inline `Loader2` spinner.
- **Audit Result**: Compliant across 90% of forms. Submit buttons switch to disabled states with an animated spinner, preventing double-click submissions.
- **Gap Identified**: On `app/(authenticated)/(modules)/settings/promotion/page.tsx`, the promotion rule submission button does not disable immediately upon click, allowing potential double-submits on slow connections.

### 1.3 File Uploads & Imports
- **Current Pattern**: `notify.loading("Mengunggah berkas...")` toast.
- **Audit Result**: Good feedback, but lacks a percent progress meter for large files (> 5MB CSV imports).

### 1.4 Background Jobs & Diagnostics
- **Current Pattern**: Health check diagnostics show animated pulse indicator and modal loading state.
- **Audit Result**: Compliant. Users can clearly see execution progress.

---

## 2. Recommendation Checklist
- [ ] Add `disabled={loading}` and `<Loader2 className="animate-spin" />` to Promotion Rule submit button.
- [ ] Ensure long-running exports display `notify.loading()` with manual dismissal on download completion.
