/**
 * student.ts
 * Centralized business rules and validation logic for student data profiles.
 */

export const STUDENT_RULES = {
  nisn: {
    min: 8,
    max: 10,
    pattern: /^\d{8,10}$/,
    message: "NISN harus berupa angka 8–10 digit."
  }
};

/**
 * Validates whether a NISN is numeric and between 8 to 10 digits.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateNisn(nisn: string): string | null {
  const trimmed = (nisn || '').trim();
  if (!trimmed) {
    return "NISN wajib diisi.";
  }
  if (!STUDENT_RULES.nisn.pattern.test(trimmed)) {
    return STUDENT_RULES.nisn.message;
  }
  return null;
}
