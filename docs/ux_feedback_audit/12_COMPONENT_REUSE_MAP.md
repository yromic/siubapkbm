# Component Reuse Map

This document catalogues every existing, observable component and helper utility that MUST be reused during the UX Feedback Hardening Sprint.

---

## Reusable Component Inventory

### 1. `notify` (Sonner Toast Helper)
- **Source File**: [lib/notify.ts](file:///d:/w/siubapkbm/lib/notify.ts)
- **Global Provider**: [components/ui/sonner.tsx](file:///d:/w/siubapkbm/components/ui/sonner.tsx) mounted in [app/layout.tsx](file:///d:/w/siubapkbm/app/layout.tsx#L155)
- **Exported API**:
  - `notify.success(message, options)`
  - `notify.error(message, options)`
  - `notify.warning(message, options)`
  - `notify.info(message, options)`
  - `notify.loading(message, options)`
  - `notify.dismiss(toastId)`
- **Target Sprint Tasks**: `TASK-04`, `TASK-05`, `TASK-06`
- **Verification Status**: Fully verified in codebase.

---

### 2. `<ConfirmDialog />`
- **Source File**: [components/ui/confirm-dialog.tsx](file:///d:/w/siubapkbm/components/ui/confirm-dialog.tsx)
- **Props Interface**:
  ```typescript
  interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive" | "warning";
    loading?: boolean;
    onClose: () => void;
    onConfirm: () => void;
  }
  ```
- **Target Sprint Tasks**: `TASK-01`, `TASK-02`, `TASK-03`
- **Verification Status**: Fully verified in codebase.

---

### 3. `<Loader2 />` (Lucide React Spinner)
- **Package**: `lucide-react`
- **Usage Pattern**:
  ```tsx
  <Loader2 className="w-4 h-4 animate-spin" />
  ```
- **Target Sprint Tasks**: `TASK-07`
- **Verification Status**: Fully verified in codebase.
