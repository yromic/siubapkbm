/**
 * SIUBA Global Versioned Letterhead Types
 *
 * Letterhead versions are stored as a JSON array in app_settings.
 * The active pointer is stored as active_letterhead_id (UUID string).
 * Document snapshots embed { id, url, name } at save time.
 */

export type LetterheadStatus = "PENDING" | "ACTIVE" | "ARCHIVED";

export interface LetterheadVersion {
  /** UUID v4 — stable identity for the immutable asset */
  id: string;
  /** Human-readable display name, e.g. "Kop Resmi 2025-2026" */
  name: string;
  /** Public URL: /uploads/letterhead_<uuid>.<ext> */
  url: string;
  /** File extension without dot: png | jpg */
  ext: string;
  /** Bytes of the stored file */
  size_bytes: number;
  /** PENDING = uploaded, not yet active; ACTIVE = in use; ARCHIVED = retired */
  status: LetterheadStatus;
  /** ISO timestamp when this version was created */
  created_at: string;
  /** ISO timestamp when this version was activated (null if never) */
  activated_at: string | null;
  /** ISO timestamp when this version was archived (null if still active/pending) */
  archived_at: string | null;
  /** User ID of the uploader */
  uploaded_by: string;
  /** User ID of the activator (null if never activated) */
  activated_by: string | null;
}

/**
 * Embedded snapshot stored in document content at save time.
 * Immutable — once saved, it represents the letterhead in effect
 * when the document was created/assessed.
 */
export interface LetterheadSnapshot {
  /** UUID matching LetterheadVersion.id */
  id: string;
  /** Public URL matching LetterheadVersion.url */
  url: string;
  /** Human-readable name for audit/display */
  name: string;
  /** ISO timestamp of snapshot capture */
  snapped_at: string;
}
