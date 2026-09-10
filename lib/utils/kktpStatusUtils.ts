/**
 * kktpStatusUtils.ts
 * Centralized existence-based KKTP status helpers.
 * Used by: KKTP page, KKTP class/subject/student APIs, and print flows.
 *
 * Status is strictly existence-based:
 * - SUDAH_DIBUAT: Document exists for the student × class × subject context (Editable & Printable)
 * - BELUM_DIBUAT: No document exists for the student × class × subject context
 */

export type KKTPDocStatus = 'SUDAH_DIBUAT' | 'BELUM_DIBUAT';

export interface KKTPDocLike {
  id?: string;
  content?: {
    tpItems?: Array<{ nilai?: number | null }>;
    catatanTutor?: string;
    identitas?: {
      studentId?: string;
      subjectId?: string;
      mataPelajaran?: string;
      classId?: string;
      kelasRombel?: string;
    };
  };
  status?: string;
}

/**
 * Returns true if a KKTP document exists.
 */
export function hasKKTP(doc: KKTPDocLike | null | undefined): boolean {
  return Boolean(doc && doc.id);
}

/**
 * Derives user-facing status from a persisted KKTP document.
 * Existence-based:
 * - SUDAH_DIBUAT if doc exists
 * - BELUM_DIBUAT if null/undefined
 */
export function deriveKKTPStatusFromDoc(doc: KKTPDocLike | null | undefined): KKTPDocStatus {
  return doc ? 'SUDAH_DIBUAT' : 'BELUM_DIBUAT';
}

/**
 * Returns true if the KKTP document is ready for print/export.
 * Any created KKTP document is printable.
 */
export function isKKTPPrintReady(doc: KKTPDocLike | null | undefined): boolean {
  return Boolean(doc);
}

/**
 * Status badge configuration for rendering consistency.
 */
export function getKKTPStatusBadge(status: KKTPDocStatus | string): {
  label: string;
  colorClass: string;
} {
  if (status === 'SUDAH_DIBUAT' || status === 'SELESAI') {
    return {
      label: 'Sudah Dibuat',
      colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }

  return {
    label: 'Belum Dibuat',
    colorClass: 'bg-gray-100 text-gray-600 border-gray-200',
  };
}
