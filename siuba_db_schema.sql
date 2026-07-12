-- SIUBA DATABASE SCHEMA (MySQL / cPanel Shared Hosting) - REVISED
-- Engine: InnoDB
-- Character Set: utf8mb4

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- 1. app_settings
-- Menyimpan konfigurasi global aplikasi yang dikelola admin.
-- -----------------------------------------------------
CREATE TABLE `app_settings` (
  `id` BIGINT AUTO_INCREMENT,
  `setting_key` VARCHAR(191) NOT NULL,
  `setting_value` TEXT NULL,
  `description` TEXT NULL,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 2. users
-- Menyimpan akun staff/guru/admin dengan kredensial login.
-- -----------------------------------------------------
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('administrator', 'admin', 'teacher') NOT NULL,
  `phone` VARCHAR(20) NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `failed_login_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'suspended', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  `suspended_at` DATETIME NULL,
  `suspended_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`),
  UNIQUE KEY `uq_user_username` (`username`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_lifecycle` (`lifecycle_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 3. teacher_profiles
-- Detail data guru yang berelasi 1-to-1 dengan akun user.
-- -----------------------------------------------------
CREATE TABLE `teacher_profiles` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `gender` ENUM('L', 'P') NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `nip` VARCHAR(50) NULL,
  `nuptk` VARCHAR(50) NULL,
  `position` VARCHAR(100) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_user` (`user_id`),
  CONSTRAINT `fk_teacher_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 4. staff_sessions
-- Menyimpan session token untuk login staff.
-- -----------------------------------------------------
CREATE TABLE `staff_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `issued_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL,
  `last_seen_at` DATETIME NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_token` (`token_hash`),
  INDEX `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 5. academic_years
-- Tahun ajaran sekolah (e.g. 2025/2026).
-- -----------------------------------------------------
CREATE TABLE `academic_years` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('draft', 'active', 'locked', 'archived', 'soft_deleted') NOT NULL DEFAULT 'draft',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `locked_at` DATETIME NULL,
  `locked_by` CHAR(36) NULL,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_academic_years_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 6. semesters
-- Semester yang dikaitkan ke tahun ajaran (Ganjil / Genap).
-- -----------------------------------------------------
CREATE TABLE `semesters` (
  `id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('draft', 'active', 'locked', 'archived', 'soft_deleted') NOT NULL DEFAULT 'draft',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `locked_at` DATETIME NULL,
  `locked_by` CHAR(36) NULL,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_semesters_active` (`is_active`),
  CONSTRAINT `fk_semester_academic_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 7. classes
-- Data kelas di sekolah (e.g. Kelas 10, Kelas 11).
-- -----------------------------------------------------
CREATE TABLE `classes` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `level` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 8. subjects
-- Data mata pelajaran (e.g. Matematika, Fisika).
-- -----------------------------------------------------
CREATE TABLE `subjects` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subject_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 9. class_subjects
-- Pemetaan mata pelajaran pada suatu kelas untuk periode tertentu.
-- -----------------------------------------------------
CREATE TABLE `class_subjects` (
  `id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_subject_period` (`class_id`, `subject_id`, `academic_year_id`, `semester_id`),
  CONSTRAINT `fk_class_subj_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 10. class_teacher_assignments
-- Penugasan guru / wali kelas ke kelas dalam suatu periode akademik.
-- -----------------------------------------------------
CREATE TABLE `class_teacher_assignments` (
  `id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `teacher_user_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `effective_from` DATE NULL,
  `effective_until` DATE NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_class_teacher_lookup` (`teacher_user_id`, `academic_year_id`, `semester_id`),
  CONSTRAINT `fk_assignment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 11. students
-- Data profil lengkap siswa dengan pin akses orang tua.
-- Status digabung menggunakan enum bahasa Inggris.
-- -----------------------------------------------------
CREATE TABLE `students` (
  `id` CHAR(36) NOT NULL,
  `nisn` VARCHAR(20) NOT NULL,
  `nik` VARCHAR(20) NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `birth_place` VARCHAR(100) NULL,
  `birth_date` DATE NOT NULL,
  `gender` ENUM('L', 'P') NOT NULL,
  `religion` VARCHAR(50) NULL,
  `phone` VARCHAR(20) NULL,
  `affirmation` VARCHAR(100) NULL,
  `special_needs` VARCHAR(100) NULL,
  `family_card_number` VARCHAR(50) NULL,
  `family_card_date` DATE NULL,
  `mother_name` VARCHAR(100) NULL,
  `mother_nik` VARCHAR(20) NULL,
  `father_name` VARCHAR(100) NULL,
  `father_nik` VARCHAR(20) NULL,
  `guardian_name` VARCHAR(100) NULL,
  `guardian_nik` VARCHAR(20) NULL,
  `address_street` VARCHAR(255) NULL,
  `rt` VARCHAR(10) NULL,
  `rw` VARCHAR(10) NULL,
  `hamlet` VARCHAR(100) NULL,
  `village` VARCHAR(100) NULL,
  `district` VARCHAR(100) NULL,
  `city` VARCHAR(100) NULL,
  `province` VARCHAR(100) NULL,
  `spp_amount` DECIMAL(12,2) NULL,
  `parent_access_pin_hash` VARCHAR(255) NULL,
  `parent_access_pin_failed_attempts` INT NOT NULL DEFAULT 0,
  `parent_access_pin_locked_until` DATETIME NULL,
  `status` ENUM('active', 'inactive', 'graduated', 'transferred', 'withdrawn', 'deceased', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` DATETIME NULL,
  `archived_by` CHAR(36) NULL,
  `deleted_at` DATETIME NULL,
  `deleted_by` CHAR(36) NULL,
  `restored_at` DATETIME NULL,
  `restored_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_nisn` (`nisn`),
  INDEX `idx_students_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 12. student_enrollments
-- Riwayat pendaftaran kelas/semesters siswa (Promosi, Tinggal, Lulus).
-- -----------------------------------------------------
CREATE TABLE `student_enrollments` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `status` ENUM('active', 'promoted', 'repeated', 'graduated', 'transferred', 'inactive') NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enrollment_lookup` (`student_id`, `academic_year_id`, `semester_id`),
  CONSTRAINT `fk_enrollment_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 13. culture_indicators
-- Master Indikator Budaya (e.g. SSS, AM, HB).
-- ID: AUTO_INCREMENT (Keputusan #5).
-- -----------------------------------------------------
CREATE TABLE `culture_indicators` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_indicator_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 14. character_values
-- Master Nilai Karakter (e.g. Fathonah, Istiqamah, Tanggung Jawab).
-- ID: AUTO_INCREMENT (Keputusan #5).
-- -----------------------------------------------------
CREATE TABLE `character_values` (
  `id` BIGINT AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_character_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 15. culture_character_mappings
-- Pemetaan pembobotan indikator budaya terhadap nilai karakter utama.
-- -----------------------------------------------------
CREATE TABLE `culture_character_mappings` (
  `id` CHAR(36) NOT NULL,
  `culture_indicator_id` BIGINT NOT NULL,
  `character_value_id` BIGINT NOT NULL,
  `sub_character_label` VARCHAR(100) NOT NULL,
  `weight` DECIMAL(5,2) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_mapping_indicator` FOREIGN KEY (`culture_indicator_id`) REFERENCES `culture_indicators` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mapping_character` FOREIGN KEY (`character_value_id`) REFERENCES `character_values` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 16. academic_assessments
-- Master tugas/ujian/ulangan harian yang dibuat guru.
-- -----------------------------------------------------
CREATE TABLE `academic_assessments` (
  `id` CHAR(36) NOT NULL,
  `teacher_user_id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `subject_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `assessment_date` DATE NOT NULL,
  `score_min` INT NOT NULL DEFAULT 0,
  `score_max` INT NOT NULL DEFAULT 100,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  `deleted_by` CHAR(36) NULL,
  `locked_at` DATETIME NULL,
  `locked_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_assessment_filter` (`class_id`, `subject_id`, `academic_year_id`, `semester_id`),
  CONSTRAINT `fk_assessment_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 17. academic_scores
-- Input nilai tugas/ujian siswa per asesmen.
-- -----------------------------------------------------
CREATE TABLE `academic_scores` (
  `id` CHAR(36) NOT NULL,
  `assessment_id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `score` DECIMAL(5,2) NOT NULL,
  `note` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  `deleted_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_assessment` (`assessment_id`, `student_id`),
  CONSTRAINT `fk_score_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `academic_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_score_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 18. culture_scores
-- Nilai harian karakter dan budayanya siswa.
-- -----------------------------------------------------
CREATE TABLE `culture_scores` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `teacher_user_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `score_date` DATE NOT NULL,
  `sss_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `am_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `hb_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `asm_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `br_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `ak_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tm_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_culture_score_lookup` (`student_id`, `score_date`),
  CONSTRAINT `fk_cult_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 19. character_weekly_summaries
-- Akumulasi rata-rata mingguan nilai karakter siswa.
-- -----------------------------------------------------
CREATE TABLE `character_weekly_summaries` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `week_start_date` DATE NOT NULL,
  `week_end_date` DATE NOT NULL,
  `f_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `i_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `t_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `r_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `a_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `h_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sss_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sss_count` INT NOT NULL DEFAULT 0,
  `am_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `am_count` INT NOT NULL DEFAULT 0,
  `hb_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `hb_count` INT NOT NULL DEFAULT 0,
  `asm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `asm_count` INT NOT NULL DEFAULT 0,
  `br_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `br_count` INT NOT NULL DEFAULT 0,
  `ak_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ak_count` INT NOT NULL DEFAULT 0,
  `tm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tm_count` INT NOT NULL DEFAULT 0,
  `days_counted` INT NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_weekly_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_weekly_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_weekly_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_weekly_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 20. character_monthly_summaries
-- Akumulasi rata-rata bulanan nilai karakter siswa.
-- Month & Year diganti ke summary_month & summary_year (Keputusan #2).
-- -----------------------------------------------------
CREATE TABLE `character_monthly_summaries` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `summary_month` INT NOT NULL,
  `summary_year` INT NOT NULL,
  `f_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `i_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `t_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `r_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `a_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `h_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sss_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sss_count` INT NOT NULL DEFAULT 0,
  `am_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `am_count` INT NOT NULL DEFAULT 0,
  `hb_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `hb_count` INT NOT NULL DEFAULT 0,
  `asm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `asm_count` INT NOT NULL DEFAULT 0,
  `br_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `br_count` INT NOT NULL DEFAULT 0,
  `ak_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ak_count` INT NOT NULL DEFAULT 0,
  `tm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tm_count` INT NOT NULL DEFAULT 0,
  `days_counted` INT NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_monthly_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monthly_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 21. character_semester_summaries
-- Akumulasi rata-rata nilai karakter per-semester untuk raport.
-- -----------------------------------------------------
CREATE TABLE `character_semester_summaries` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `f_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `i_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `t_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `r_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `a_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `h_score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sss_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sss_count` INT NOT NULL DEFAULT 0,
  `am_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `am_count` INT NOT NULL DEFAULT 0,
  `hb_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `hb_count` INT NOT NULL DEFAULT 0,
  `asm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `asm_count` INT NOT NULL DEFAULT 0,
  `br_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `br_count` INT NOT NULL DEFAULT 0,
  `ak_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ak_count` INT NOT NULL DEFAULT 0,
  `tm_sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tm_count` INT NOT NULL DEFAULT 0,
  `days_counted` INT NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_semester_summary_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_semester_summary_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_semester_summary_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_semester_summary_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 22. student_files
-- Berkas administrasi siswa (Akte, KK, dll) di lokal disk cPanel.
-- drive_file_id diubah menjadi file_path (Keputusan #1).
-- -----------------------------------------------------
CREATE TABLE `student_files` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `file_type` VARCHAR(100) NOT NULL,
  `file_path` VARCHAR(500) NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `uploaded_by` CHAR(36) NULL,
  `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  `deleted_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_student_files_lookup` (`student_id`),
  CONSTRAINT `fk_student_file_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_student_file_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 23. teacher_notes
-- Catatan/observasi perkembangan siswa yang ditulis oleh guru.
-- -----------------------------------------------------
CREATE TABLE `teacher_notes` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `student_enrollment_id` CHAR(36) NOT NULL,
  `teacher_user_id` CHAR(36) NOT NULL,
  `note_type` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `visibility` ENUM('public', 'parent', 'teacher') NOT NULL DEFAULT 'teacher',
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_note_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 24. teacher_attendance
-- Log presensi geofencing guru berdasarkan GPS.
-- -----------------------------------------------------
CREATE TABLE `teacher_attendance` (
  `id` CHAR(36) NOT NULL,
  `teacher_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `time_in` TIME NOT NULL,
  `lat` DECIMAL(10,8) NOT NULL,
  `lng` DECIMAL(11,8) NOT NULL,
  `distance_meters` DECIMAL(8,2) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_attendance_date` (`teacher_id`, `date`),
  CONSTRAINT `fk_attendance_teacher_user` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 25. spp_payments
-- Histori dan tagihan pembayaran SPP bulanan siswa.
-- month & year diganti ke payment_month & payment_year (Keputusan #2).
-- -----------------------------------------------------
CREATE TABLE `spp_payments` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `payment_month` INT NOT NULL,
  `payment_year` INT NOT NULL,
  `amount_due` DECIMAL(12,2) NOT NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  `paid_at` DATETIME NULL,
  `payment_method` VARCHAR(50) NULL,
  `verified_by` CHAR(36) NULL,
  `notes` TEXT NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  `deleted_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_spp_monthly` (`student_id`, `academic_year_id`, `payment_month`, `payment_year`),
  CONSTRAINT `fk_spp_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_spp_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_spp_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 26. parent_access_logs
-- Log percobaan login/verifikasi PIN oleh wali murid.
-- -----------------------------------------------------
CREATE TABLE `parent_access_logs` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `success` TINYINT(1) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `attempted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_parent_logs_student` (`student_id`),
  CONSTRAINT `fk_access_log_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 27. parent_sessions
-- Tabel untuk mencatat token aktif session wali murid (ganti CacheService).
-- -----------------------------------------------------
CREATE TABLE `parent_sessions` (
  `id` CHAR(36) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `issued_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `last_seen_at` DATETIME NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_parent_session_token` (`token_hash`),
  INDEX `idx_parent_session_student` (`student_id`),
  CONSTRAINT `fk_parent_session_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 28. import_logs
-- Catatan histori impor data massal dari file excel/csv.
-- Uploader FK diubah ke SET NULL + Nullable (Mitigasi Kritis #1).
-- -----------------------------------------------------
CREATE TABLE `import_logs` (
  `id` CHAR(36) NOT NULL,
  `import_type` VARCHAR(100) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NULL,
  `uploaded_by` CHAR(36) NULL,
  `total_rows` INT NOT NULL DEFAULT 0,
  `success_rows` INT NOT NULL DEFAULT 0,
  `error_rows` INT NOT NULL DEFAULT 0,
  `error_report_file_path` VARCHAR(500) NULL,
  `status` VARCHAR(50) NOT NULL,
  `error_summary` TEXT NULL,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_import_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 29. report_snapshots
-- Snapshot nilai rapor untuk semester yang sudah di-lock.
-- Creator FK diubah ke SET NULL + Nullable (Mitigasi Kritis #2).
-- -----------------------------------------------------
CREATE TABLE `report_snapshots` (
  `id` CHAR(36) NOT NULL,
  `snapshot_type` VARCHAR(100) NOT NULL,
  `student_id` CHAR(36) NOT NULL,
  `class_id` CHAR(36) NOT NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `snapshot_payload` LONGTEXT NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_report_snapshot_unique` (`student_id`, `academic_year_id`, `semester_id`, `snapshot_type`),
  CONSTRAINT `fk_snapshot_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 30. report_exports
-- Log file laporan rapor PDF/CSV yang sudah diekspor.
-- file_id diganti file_path, Generator FK diganti SET NULL (Mitigasi Kritis #3).
-- -----------------------------------------------------
CREATE TABLE `report_exports` (
  `id` CHAR(36) NOT NULL,
  `report_type` VARCHAR(100) NOT NULL,
  `snapshot_id` CHAR(36) NULL,
  `student_id` CHAR(36) NULL,
  `class_id` CHAR(36) NULL,
  `academic_year_id` CHAR(36) NOT NULL,
  `semester_id` CHAR(36) NOT NULL,
  `generated_by` CHAR(36) NULL,
  `generated_at` DATETIME NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `file_path` VARCHAR(500) NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `source_type` VARCHAR(100) NULL,
  `source_id` VARCHAR(100) NULL,
  `total_rows` INT NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_export_snapshot` FOREIGN KEY (`snapshot_id`) REFERENCES `report_snapshots` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_export_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_export_user` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 31. backup_snapshots
-- Catatan histori backup database.
-- sheet_count diganti ke table_count (Poin Perhatian #1).
-- -----------------------------------------------------
CREATE TABLE `backup_snapshots` (
  `id` CHAR(36) NOT NULL,
  `backup_file_id` VARCHAR(255) NOT NULL,
  `backup_type` VARCHAR(100) NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) NOT NULL,
  `table_count` INT NOT NULL,
  `record_count` INT NOT NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_backup_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 32. class_promotion_rules
-- Aturan pemetaan kenaikan kelas (e.g. Kelas 10A -> Kelas 11A).
-- -----------------------------------------------------
CREATE TABLE `class_promotion_rules` (
  `id` CHAR(36) NOT NULL,
  `source_class_id` CHAR(36) NOT NULL,
  `target_class_id` CHAR(36) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` ENUM('active', 'inactive', 'archived', 'soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotion_flow` (`source_class_id`, `target_class_id`),
  CONSTRAINT `fk_promo_rule_source` FOREIGN KEY (`source_class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_promo_rule_target` FOREIGN KEY (`target_class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 33. audit_logs
-- Rekaman jejak audit log perubahan data dan login pengguna.
-- -----------------------------------------------------
CREATE TABLE `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `user_name` VARCHAR(100) NULL,
  `user_role` VARCHAR(50) NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100) NULL,
  `old_value` TEXT NULL,
  `new_value` TEXT NULL,
  `description` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
