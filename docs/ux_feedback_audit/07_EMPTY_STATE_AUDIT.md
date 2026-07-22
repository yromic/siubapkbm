# Empty State Audit

This document audits empty state feedback across all data tables, lists, and filter views.

---

## Empty State Audit Matrix

| Screen / View | Empty Condition | Current Feedback | Expected Remediation Guidance | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`/students`** | No students in DB | Illustration + *"Belum ada data siswa"* | Displays `[+ Tambah Siswa]` button | Compliant |
| **`/students`** | Search 0 results | Text: *"Tidak ada data yang cocok"* | Displays `[ Bersihkan Filter ]` button | Compliant |
| **`/finance`** | No arrears record | Text: *"Tidak ada tunggakan SPP"* | Displays green checkmark icon | Compliant |
| **`/audit-log`** | Filter 0 records | Text: *"Belum ada log aktivitas"* | Explains log retention window | Compliant |
| **`/parent/dashboard`**| No grades published | Blank card container | Explains *"Nilai semester belum dipublikasikan oleh sekolah"* | **Needs Enhancement** |
| **`/my-class`** | Teacher has no class | Blank view | Displays message: *"Anda belum ditugaskan sebagai Wali Kelas"* | Compliant |

---

## Empty State Design Standards
Every empty state container must feature:
1. Neutral icon or illustration (e.g. `Inbox`, `SearchX`, `CheckCircle2`).
2. Primary headline stating what is empty.
3. Secondary body copy explaining *why* or giving context.
4. Action button (if applicable) allowing the user to create data or reset search filters.
