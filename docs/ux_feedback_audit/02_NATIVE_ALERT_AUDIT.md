# Native Alert & Confirm Audit

Native browser dialogs (`window.alert`, `window.confirm`, `window.prompt`) break design consistency, block the main UI thread, cannot be styled, and look untrustworthy to users.

This document identifies all native browser dialog violations discovered in the codebase and provides explicit replacement instructions.

---

## Native Violation Inventory

### Violation 1: Media Item Deletion Confirmation
- **Module**: Website CMS (`/settings/cms-landing`)
- **File**: [components/dashboard/cms/MediaTab.tsx](file:///d:/w/siubapkbm/components/dashboard/cms/MediaTab.tsx#L147)
- **Code Line**: Line 147
- **Current Native Call**:
  ```typescript
  const confirmed = window.confirm("Apakah Anda yakin ingin menghapus media ini?");
  ```
- **Purpose**: Confirm permanent deletion of an uploaded media asset.
- **Recommended Replacement**: `<ConfirmDialog />` component.
- **Severity**: **High**
- **Migration Priority**: **Immediate (Hotfix)**

---

### Violation 2: CMS Tab Navigation with Unsaved Changes
- **Module**: Website CMS (`/settings/cms-landing`)
- **File**: [app/(authenticated)/(modules)/settings/cms-landing/page.tsx](file:///d:/w/siubapkbm/app/%28authenticated%29/%28modules%29/settings/cms-landing/page.tsx#L41)
- **Code Line**: Line 41
- **Current Native Call**:
  ```typescript
  const confirm = window.confirm("Anda memiliki perubahan yang belum disimpan di tab ini. Pindah tab akan membuang perubahan tersebut. Lanjutkan?");
  ```
- **Purpose**: Prevent accidental loss of draft content when switching tabs.
- **Recommended Replacement**: Custom Unsaved Changes Modal using `<ConfirmDialog />`.
- **Severity**: **High**
- **Migration Priority**: **Immediate (Hotfix)**

---

### Violation 3: CMS Section Publish Confirmation
- **Module**: Website CMS (`/settings/cms-landing`)
- **File**: [components/dashboard/cms/SectionsTab.tsx](file:///d:/w/siubapkbm/components/dashboard/cms/SectionsTab.tsx#L587)
- **Code Line**: Line 587
- **Current Native Call**:
  ```typescript
  const confirmed = window.confirm("Apakah Anda yakin ingin mempublikasikan perubahan ini ke situs publik secara instan?");
  ```
- **Purpose**: Confirm immediate publication of CMS section changes to live site.
- **Recommended Replacement**: `<ConfirmDialog />` component.
- **Severity**: **High**
- **Migration Priority**: **Immediate (Hotfix)**

---

## Migration Verification Summary
- Total `window.alert()` calls: **0**
- Total `window.confirm()` calls: **3** (All located inside CMS modules)
- Total `window.prompt()` calls: **0**
- Replaced by `<ConfirmDialog />`: **3 items queued for Sprint Hotfix**.
