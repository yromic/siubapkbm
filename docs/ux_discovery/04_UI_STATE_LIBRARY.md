# Observable UI State Library

This document catalogues all UI states observable across screens and components in the SIUBA PKBM platform based on source code analysis.

---

## 1. Global & Layout UI States

| UI State | Component / Location | Trigger / Condition | Observable Visual / Behavioral Implementation |
| :--- | :--- | :--- | :--- |
| **Loading** | `<LoadingState />` | Async data fetching in progress | Full-width/full-card spinner with centered loading text |
| **Forbidden** | `<ForbiddenState />` | Role does not match `MENU_ITEMS` | Alert banner stating "Akses Ditolak: Anda tidak memiliki wewenang" |
| **Session Expired** | Navigation Middleware | Invalid or expired session token | Automatic client-side redirect to `/login?expired=true` |
| **Unsaved Changes Warning**| Form Drawers | Dirty state in form before close | Modal prompt: "Perubahan belum disimpan. Yakin ingin keluar?" |
| **Confirmation Dialog** | `<ConfirmDialog />` | Destructive action trigger (delete, lock) | Overlay modal requiring explicit confirmation click |

---

## 2. Authentication UI States (`/login` & `/parent/login`)

| UI State | Component / Location | Trigger / Condition | Observable Visual / Behavioral Implementation |
| :--- | :--- | :--- | :--- |
| **ALTCHA Loading** | `<Altcha />` | Proof-of-work solver running | Progress bar active; text: *"Memproses tantangan anti-bot..."* |
| **ALTCHA Success** | `<Altcha />` | Challenge solved | Emerald checkmark badge; text: *"Verifikasi keamanan berhasil."* |
| **ALTCHA Error** | `<Altcha />` | Solver fail / Crypto unavailable | Red alert badge; text: *"Gagal memproses verifikasi. Coba Lagi."* |
| **MFA Required** | Login Form | Admin password verified, MFA enabled | Replaces login form with 6-digit TOTP input modal |
| **Account Locked** | Login Form | `ERR_ACCOUNT_LOCKED` returned | Red error alert: *"Akun terkunci, coba lagi dalam X menit"* |
| **Invalid Credentials** | Login Form | `ERR_INVALID_CREDENTIALS` returned | Red error alert: *"Email atau password salah"* |

---

## 3. Data Table & CRUD UI States (`/students`, `/finance`, `/users`, etc.)

| UI State | Component / Location | Trigger / Condition | Observable Visual / Behavioral Implementation |
| :--- | :--- | :--- | :--- |
| **Table Skeleton** | DataTable Component | Initial page fetch | Animated skeleton rows matching column widths |
| **Empty State** | DataTable Component | Zero records in database | Centered illustration with text: *"Belum ada data tersedia"* |
| **No Search Result** | DataTable Component | Search query matches 0 rows | Text: *"Tidak ditemukan data yang sesuai dengan pencarian"* |
| **Saving / Updating** | Form Drawer Submit Button | POST/PUT in flight | Button disabled, `Loader2` spinner active, text: *"Memproses..."* |
| **Validation Error** | Form Drawer Inputs | Invalid format / missing required field | Red border around input, red inline helper text beneath |
| **Success Toast** | Global Toast Container | Operation succeeds | Floating green toast banner at top-right, auto-dismiss in 3s |
| **Bulk Selection** | Table Header Bar | Checkbox selection active | Blue action bar appearing above table: *"X data terpilih"* |

---

## 4. System Diagnostics UI States (`/health-check`)

| UI State | Component / Location | Trigger / Condition | Observable Visual / Behavioral Implementation |
| :--- | :--- | :--- | :--- |
| **Healthy Status** | `<HealthStatusBadge />` | All system checks return `ok` | Green badge: *"Sistem Normal / Healthy"* |
| **Warning Status** | `<HealthStatusBadge />` | Non-critical component issue (e.g. storage) | Yellow badge: *"Peringatan / Storage Missing"* |
| **Critical Status** | `<HealthStatusBadge />` | Database latency failure / DB down | Red banner: *"Kritis: Database tidak dapat dijangkau"* |
| **Backup In Progress** | Backup Drawer | Manual backup triggered | Progress spinner: *"Membuat snapshot database..."* |

---

## 5. Verification Status Summary
- **Verified States**: Loading, Skeleton, Empty, No Search Result, Data Loaded, Saving, Updating, Deleting, Success, Warning, Validation Error, Server Error, Unauthorized, Forbidden, Session Expired, Confirmation Dialog, Read Only, Disabled.
- **Unverified / Unable to Verify from Source**: Offline PWA state (no service worker implementation observed), Maintenance Mode splash page (handled via standard HTTP 500 error page).
