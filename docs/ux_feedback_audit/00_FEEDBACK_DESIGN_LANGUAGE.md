# SIUBA PKBM Feedback Communication Standard

This document defines the official feedback design language and user communication rules for SIUBA PKBM. The goal is to establish consistent, predictable, and reassuring communication across every user interaction.

---

## 1. Feedback Type Matrix & Usage Rules

| Feedback Type | Primary Purpose | When to Use | When NOT to Use | Target Component |
| :--- | :--- | :--- | :--- | :--- |
| **Success Toast** | Confirm completed action | Action succeeded (Save, Create, Update) | Form validation errors; static page loads | `notify.success()` |
| **Error Toast** | Report failure | Server error (500), network drop, action failure | Inline field errors | `notify.error()` |
| **Warning Toast** | Alert risky condition | Session near timeout, rate limit threshold | Critical system errors | `notify.warning()` |
| **Info Toast** | Informational update | Background sync finished, filter applied | Urgent errors or warnings | `notify.info()` |
| **Loading Toast** | Feedback for async tasks | Async submit, file upload, export generation | Quick (<300ms) operations | `notify.loading()` |
| **Confirm Dialog** | Destructive safeguard | Permanent deletion, status revocation, publish | Non-destructive view changes | `<ConfirmDialog />` |
| **Empty State** | Guide empty views | Data table with 0 records, filter with 0 hits | Loading states | Inline Empty Container |
| **Inline Validation**| Form field guidance | Format error, required missing field | Global server crash | Form Helper Text |

---

## 2. Component Usage Specifications

### 2.1 Success Toast (`notify.success`)
- **Tone**: Reassuring, clear, concise.
- **Structure**: `[Noun/Subject] + [Past-tense Action Verb] + [Contextual Detail]`.
- **Duration**: Auto-dismiss after 3000ms.
- **Examples**:
  - *"Data siswa berhasil disimpan."*
  - *"Nilai akademik semester ini berhasil dipublikasikan."*
  - *"Pembayaran SPP bulan Juli 2026 telah diverifikasi."*

### 2.2 Error Toast (`notify.error`)
- **Tone**: Helpful, constructive, human-readable (NO raw error codes or stack traces).
- **Structure**: `[Clear Description of Failure] + [Suggested Remediation/Next Step]`.
- **Duration**: Auto-dismiss after 5000ms.
- **Examples**:
  - *"Gagal menyimpan data: NISN sudah terdaftar di sistem."*
  - *"Koneksi terputus: Periksa koneksi internet Anda dan coba lagi."*

### 2.3 Loading Toast (`notify.loading`)
- **Tone**: Informative, active.
- **Structure**: `[Present Continuous Verb] + [Subject] + "..."`.
- **Duration**: Manual dismiss via `notify.dismiss(toastId)` upon promise completion.
- **Examples**:
  - *"Menyimpan data siswa..."*
  - *"Mempublikasikan section CMS..."*
  - *"Mengunggah berkas CSV..."*

### 2.4 Destructive Confirmation Modal (`<ConfirmDialog />`)
- **Tone**: Cautious, clear consequence.
- **Structure**:
  - **Title**: *"Hapus [Subject]?"* or *"Batalkan [Subject]?"*
  - **Body**: Explain exact scope and irrevocability.
  - **Confirm Button**: Action verb styled with destructive variant (Red button, e.g. "Ya, Hapus").
  - **Cancel Button**: Neutral outline variant ("Batal").
- **Example**:
  - **Title**: *"Hapus Media Ini?"*
  - **Body**: *"Gambar ini akan dihapus secara permanen dari server. Tindakan ini tidak dapat dibatalkan."*

### 2.5 Empty States
- **Structure**: Icon + Headline + Sub-description + Primary Action Button.
- **Example**:
  - **Headline**: *"Belum Ada Data Siswa"*
  - **Sub-description**: *"Siswa yang terdaftar di kelas ini akan muncul di sini."*
  - **Action Button**: `[ + Tambah Siswa Baru ]`

---

## 3. Communication Principles
1. **Never Cryptic**: Replace raw error codes (`ERR_DUP_ENTRY`, `500`) with human explanation.
2. **Never Silent**: Async operations must ALWAYS yield feedback (Loading $\rightarrow$ Success OR Error).
3. **No Native Browser Alerts**: `window.alert()`, `window.confirm()`, and `window.prompt()` are strictly forbidden. Replaced by `notify` and `<ConfirmDialog />`.
