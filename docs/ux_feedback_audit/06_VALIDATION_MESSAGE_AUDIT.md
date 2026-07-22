# Validation Message & Error Humanization Audit

This document audits validation feedback across forms and server error responses to ensure errors are actionable and free of technical jargon.

---

## 1. Error Message Sanitization Audit

| Raw Server / API Code | Current Displayed Message | Humanized Target Message | Quality Assessment |
| :--- | :--- | :--- | :--- |
| `ERR_INVALID_CREDENTIALS` | *"Email atau password salah"* | *"Email atau password salah."* | **Compliant** |
| `ERR_ALTCHA_REQUIRED` | *"Verification is required to login."* | *"Verifikasi keamanan diperlukan."* | **Compliant** |
| `ERR_ACCOUNT_LOCKED` | *"Account is temporarily locked..."* | *"Akun terkunci, coba lagi dalam X menit"* | **Compliant** |
| `ER_DUP_ENTRY` | *"ER_DUP_ENTRY: Duplicate entry '12345'..."* | *"Data dengan NIK/NISN tersebut sudah terdaftar."* | **Violation (Technical Jargon)** |
| `ERR_DATABASE` | *"Database error query failed"* | *"Terjadi masalah pada koneksi database. Silakan coba lagi."* | **Violation (Technical Jargon)** |
| `401 Unauthorized` | *"Unauthorized parent access."* | *"Sesi Anda telah berakhir. Silakan login kembali."* | **Compliant** |

---

## 2. Form Field Validation Standards
- Inline validation must trigger on input blur or submit attempt.
- Required fields must be visually denoted with an asterisk (`*`).
- Invalid fields must display a red border (`border-rose-500`) and helper text (`text-xs text-rose-500 mt-1`).
- Error messages must explain how to correct the value (e.g., *"Format tanggal lahir tidak valid. Gunakan YYYY-MM-DD"*).
