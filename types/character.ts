/**
 * Database Model Definitions for Character System (Sprint 1)
 */

export type LifecycleStatus = 'active' | 'inactive' | 'archived' | 'soft_deleted';

/**
 * Model Interface representing the `culture_scores` table (Weekly SAHABAT Assessment)
 */
export interface CultureScoreModel {
  id: string; // CHAR(36)
  student_id: string; // CHAR(36) NOT NULL
  student_enrollment_id?: string | null; // CHAR(36) NULL
  class_id?: string | null; // CHAR(36) NULL
  teacher_user_id?: string | null; // CHAR(36) NULL
  academic_year_id?: string | null; // CHAR(36) NULL (Denormalized)
  semester_id: string; // CHAR(36) NOT NULL

  week_start_date: string; // DATE (YYYY-MM-DD)
  week_end_date: string; // DATE (YYYY-MM-DD)

  // SAHABAT Scores (0-4)
  sss_score: number; // TINYINT UNSIGNED (0=tidak diamati, 1=kurang, 2=cukup, 3=baik, 4=sangat baik)
  am_score: number; // TINYINT UNSIGNED
  hb_score: number; // TINYINT UNSIGNED
  asm_score: number; // TINYINT UNSIGNED
  br_score: number; // TINYINT UNSIGNED
  ak_score: number; // TINYINT UNSIGNED
  tm_score: number; // TINYINT UNSIGNED

  observation_note?: string | null; // TEXT NULL
  status: string; // VARCHAR(50) DEFAULT 'active'
  lifecycle_status: LifecycleStatus; // ENUM

  created_at?: string | Date; // DATETIME
  updated_at?: string | Date; // DATETIME
}

/**
 * Model Interface representing the `character_utsman_semester_summary` table (UTSMAN Semester Summary)
 */
export interface CharacterUtsmanSemesterSummaryModel {
  id: string; // CHAR(36)
  student_id: string; // CHAR(36) NOT NULL
  academic_year_id?: string | null; // CHAR(36) NULL (Denormalized)
  semester_id: string; // CHAR(36) NOT NULL (Primary academic relation)

  // UTSMAN Profile Scores (0.00 - 4.00)
  u_score?: number | null; // DECIMAL(4,2)
  t_score?: number | null; // DECIMAL(4,2)
  s_score?: number | null; // DECIMAL(4,2)
  m_score?: number | null; // DECIMAL(4,2)
  a_score?: number | null; // DECIMAL(4,2)
  n_score?: number | null; // DECIMAL(4,2)

  calculation_version: string; // VARCHAR(20) DEFAULT 'v1.0'
  locked_at?: string | Date | null; // DATETIME NULL (Persiapan Sprint 5)

  created_at?: string | Date; // DATETIME
  updated_at?: string | Date; // DATETIME
}
