# Confirmation Dialog Audit

This document audits all destructive, irreversible, and high-impact administrative operations across the platform.

---

## Destructive Action Matrix

| Module | Action | Current Confirmation Mechanism | Existing Dialog Component | Missing Explanation / Consequence | Danger Styling Present? | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Students** | Delete Student | Custom Modal | `<ConfirmDialog />` | Lacks warning about deleting attendance history | Yes (Red Button) | Medium |
| **Users** | Disable User Account | Custom Modal | `<ConfirmDialog />` | Explains active sessions will be revoked | Yes (Red Button) | Compliant |
| **Grade** | Publish Grades | Custom Modal | `<ConfirmDialog />` | Explains parents will immediately view grades | Yes (Blue/Emerald) | Compliant |
| **CMS** | Delete Media Asset | **Native `window.confirm`**| **None (Native)** | Lacks warning about broken image links | **No (Native)** | **Critical** |
| **CMS** | Publish Section | **Native `window.confirm`**| **None (Native)** | Explains live website will be updated | **No (Native)** | **Critical** |
| **CMS** | Abandon Draft Tab | **Native `window.confirm`**| **None (Native)** | Explains unsaved edits will be discarded | **No (Native)** | **Critical** |
| **SPP** | Revert Payment | Custom Modal | `<ConfirmDialog />` | Explains payment status returns to unpaid | Yes (Red Button) | Compliant |
| **Period** | Execute Rollover | Confirmation Input | Custom Modal | Requires typing target term name | Yes (Red Button) | Compliant |

---

## Key Dialog Standardization Rules
1. All native `window.confirm()` calls in CMS components MUST be migrated to `<ConfirmDialog />`.
2. Destructive actions MUST render primary buttons with `variant="destructive"` (solid red background).
3. Modals MUST contain an explicit "Batal" (Cancel) button and support closing via `Escape` key.
