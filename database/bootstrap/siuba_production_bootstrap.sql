-- =====================================================================
-- SIUBA CANONICAL PRODUCTION DATABASE BOOTSTRAP
-- Target Database Engine: MariaDB 10.11.x (tested on 10.11.19-MariaDB-cll-lve)
-- Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Represents Schema State: Up to 20260925150000_create_kktp_assessment_tables.ts
-- Total Active Application Tables: 58
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

-- ---------------------------------------------------------------------
-- 1. DROP EXISTING TABLES (REVERSE DEPENDENCY ORDER)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `website_config`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `trisula_student_summaries`;
DROP TABLE IF EXISTS `trisula_student_scores`;
DROP TABLE IF EXISTS `trisula_assessments`;
DROP TABLE IF EXISTS `trisula_assessment_curriculum`;
DROP TABLE IF EXISTS `tp_bank`;
DROP TABLE IF EXISTS `testimonials`;
DROP TABLE IF EXISTS `teacher_profiles`;
DROP TABLE IF EXISTS `teacher_notes`;
DROP TABLE IF EXISTS `teacher_attendance`;
DROP TABLE IF EXISTS `subjects`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `student_files`;
DROP TABLE IF EXISTS `student_enrollments`;
DROP TABLE IF EXISTS `student_attendance_sessions`;
DROP TABLE IF EXISTS `student_attendance_records`;
DROP TABLE IF EXISTS `staff_sessions`;
DROP TABLE IF EXISTS `spp_payments`;
DROP TABLE IF EXISTS `semesters`;
DROP TABLE IF EXISTS `sections`;
DROP TABLE IF EXISTS `section_items`;
DROP TABLE IF EXISTS `rpm_attachments`;
DROP TABLE IF EXISTS `report_snapshots`;
DROP TABLE IF EXISTS `report_exports`;
DROP TABLE IF EXISTS `rate_limit_attempts`;
DROP TABLE IF EXISTS `parent_sessions`;
DROP TABLE IF EXISTS `parent_access_logs`;
DROP TABLE IF EXISTS `navigation_menus`;
DROP TABLE IF EXISTS `navigation_links`;
DROP TABLE IF EXISTS `kktp_student_summaries`;
DROP TABLE IF EXISTS `kktp_student_scores`;
DROP TABLE IF EXISTS `kktp_assessments`;
DROP TABLE IF EXISTS `kktp_assessment_tps`;
DROP TABLE IF EXISTS `job_queue`;
DROP TABLE IF EXISTS `import_logs`;
DROP TABLE IF EXISTS `gallery_items`;
DROP TABLE IF EXISTS `faqs`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `culture_scores`;
DROP TABLE IF EXISTS `culture_indicators`;
DROP TABLE IF EXISTS `culture_character_mappings`;
DROP TABLE IF EXISTS `cp_bank`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `class_teacher_assignments`;
DROP TABLE IF EXISTS `class_subjects`;
DROP TABLE IF EXISTS `class_promotion_rules`;
DROP TABLE IF EXISTS `character_values`;
DROP TABLE IF EXISTS `character_utsman_semester_summary`;
DROP TABLE IF EXISTS `backup_snapshots`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `assets`;
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `altcha_replays`;
DROP TABLE IF EXISTS `ai_usage_events`;
DROP TABLE IF EXISTS `academic_years`;
DROP TABLE IF EXISTS `academic_scores`;
DROP TABLE IF EXISTS `academic_assessments`;
DROP TABLE IF EXISTS `legacy_culture_scores`;
DROP TABLE IF EXISTS `legacy_character_monthly_summaries`;
DROP TABLE IF EXISTS `legacy_character_semester_summaries`;
DROP TABLE IF EXISTS `legacy_character_weekly_summaries`;
DROP TABLE IF EXISTS `knex_migrations_lock`;
DROP TABLE IF EXISTS `knex_migrations`;

-- ---------------------------------------------------------------------
-- 2. CREATE APPLICATION TABLES
-- ---------------------------------------------------------------------

-- Table: academic_assessments
CREATE TABLE IF NOT EXISTS `academic_assessments` (
  `id` char(36) NOT NULL,
  `teacher_user_id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `subject_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `title` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `assessment_date` date NOT NULL,
  `score_min` int(11) NOT NULL DEFAULT 0,
  `score_max` int(11) NOT NULL DEFAULT 100,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `locked_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assessment_filter` (`class_id`,`subject_id`,`academic_year_id`,`semester_id`),
  KEY `fk_assessment_teacher` (`teacher_user_id`),
  KEY `fk_assessment_subject` (`subject_id`),
  KEY `fk_assessment_year` (`academic_year_id`),
  KEY `fk_assessment_semester` (`semester_id`),
  CONSTRAINT `fk_assessment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assessment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: academic_scores
CREATE TABLE IF NOT EXISTS `academic_scores` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) NOT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_assessment` (`assessment_id`,`student_id`),
  KEY `fk_score_student` (`student_id`),
  KEY `fk_score_enrollment` (`student_enrollment_id`),
  CONSTRAINT `fk_score_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `academic_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_score_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: academic_years
CREATE TABLE IF NOT EXISTS `academic_years` (
  `id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `lifecycle_status` enum('draft','active','locked','archived','soft_deleted') NOT NULL DEFAULT 'draft',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `locked_at` datetime DEFAULT NULL,
  `locked_by` char(36) DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_academic_years_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ai_usage_events
CREATE TABLE IF NOT EXISTS `ai_usage_events` (
  `id` char(36) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `feature` varchar(50) NOT NULL,
  `provider` varchar(50) NOT NULL DEFAULT 'GEMINI',
  `model` varchar(100) NOT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'GEMINI',
  `provider_http_status` int(11) DEFAULT NULL,
  `provider_error_reason` varchar(50) DEFAULT NULL,
  `duration_ms` int(11) DEFAULT NULL,
  `retry_attempt` int(11) NOT NULL DEFAULT 1,
  `request_started_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ai_usage_lookup` (`provider`,`model`,`created_at`),
  KEY `idx_ai_usage_created_at` (`created_at`),
  KEY `idx_ai_usage_feature` (`feature`),
  KEY `idx_ai_usage_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: altcha_replays
CREATE TABLE IF NOT EXISTS `altcha_replays` (
  `id` char(36) NOT NULL,
  `signature` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `altcha_replays_signature_unique` (`signature`),
  KEY `altcha_replays_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: app_settings
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(191) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` char(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: assets
CREATE TABLE IF NOT EXISTS `assets` (
  `id` char(36) NOT NULL,
  `url` varchar(512) NOT NULL,
  `alt` varchar(255) NOT NULL,
  `caption` varchar(512) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size_bytes` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` char(36) NOT NULL,
  `user_id` char(36) DEFAULT NULL,
  `user_name` varchar(100) DEFAULT NULL,
  `user_role` varchar(50) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: backup_snapshots
CREATE TABLE IF NOT EXISTS `backup_snapshots` (
  `id` char(36) NOT NULL,
  `backup_file_id` varchar(255) NOT NULL,
  `backup_type` varchar(100) NOT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `status` varchar(50) NOT NULL,
  `table_count` int(11) NOT NULL,
  `record_count` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_backup_user` (`created_by`),
  CONSTRAINT `fk_backup_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: character_utsman_semester_summary
CREATE TABLE IF NOT EXISTS `character_utsman_semester_summary` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `academic_year_id` char(36) DEFAULT NULL,
  `semester_id` char(36) NOT NULL,
  `u_score` decimal(4,2) DEFAULT NULL,
  `t_score` decimal(4,2) DEFAULT NULL,
  `s_score` decimal(4,2) DEFAULT NULL,
  `m_score` decimal(4,2) DEFAULT NULL,
  `a_score` decimal(4,2) DEFAULT NULL,
  `n_score` decimal(4,2) DEFAULT NULL,
  `calculation_version` varchar(20) NOT NULL DEFAULT 'v1.0',
  `locked_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_utsman_semester` (`student_id`,`semester_id`),
  KEY `idx_utsman_semester_lookup` (`semester_id`,`student_id`),
  KEY `fk_utsman_year` (`academic_year_id`),
  CONSTRAINT `fk_utsman_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_utsman_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_utsman_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: character_values
CREATE TABLE IF NOT EXISTS `character_values` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_character_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: class_promotion_rules
CREATE TABLE IF NOT EXISTS `class_promotion_rules` (
  `id` char(36) NOT NULL,
  `source_class_id` char(36) NOT NULL,
  `target_class_id` char(36) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promotion_source` (`source_class_id`),
  KEY `fk_promo_rule_target` (`target_class_id`),
  CONSTRAINT `fk_promo_rule_source` FOREIGN KEY (`source_class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_promo_rule_target` FOREIGN KEY (`target_class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: class_subjects
CREATE TABLE IF NOT EXISTS `class_subjects` (
  `id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `subject_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_subject_period` (`class_id`,`subject_id`,`academic_year_id`,`semester_id`),
  KEY `fk_class_subj_subject` (`subject_id`),
  KEY `fk_class_subj_year` (`academic_year_id`),
  KEY `fk_class_subj_semester` (`semester_id`),
  CONSTRAINT `fk_class_subj_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_class_subj_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: class_teacher_assignments
CREATE TABLE IF NOT EXISTS `class_teacher_assignments` (
  `id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `teacher_user_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `effective_from` date DEFAULT NULL,
  `effective_until` date DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_class_teacher_lookup` (`teacher_user_id`,`academic_year_id`,`semester_id`),
  KEY `fk_assignment_class` (`class_id`),
  KEY `fk_assignment_year` (`academic_year_id`),
  KEY `fk_assignment_semester` (`semester_id`),
  CONSTRAINT `fk_assignment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: classes
CREATE TABLE IF NOT EXISTS `classes` (
  `id` char(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `level` int(11) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_class_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: cp_bank
CREATE TABLE IF NOT EXISTS `cp_bank` (
  `id` char(36) NOT NULL,
  `kode` varchar(100) DEFAULT NULL,
  `teks` text NOT NULL,
  `fase` varchar(50) NOT NULL DEFAULT 'Fase C',
  `mata_pelajaran_id` char(36) DEFAULT NULL,
  `mata_pelajaran_name` varchar(255) DEFAULT NULL,
  `domain_trisula` varchar(50) DEFAULT NULL,
  `sumber` enum('OFFICIAL','INTERNAL_BLC','MANUAL','AI_ASSISTED') NOT NULL DEFAULT 'INTERNAL_BLC',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_by` char(36) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cp_bank_mapel_fase` (`mata_pelajaran_id`,`fase`),
  KEY `idx_cp_bank_fase` (`fase`),
  KEY `idx_cp_bank_sumber` (`sumber`),
  KEY `idx_cp_bank_domain_trisula` (`domain_trisula`),
  KEY `fk_cp_bank_created_by` (`created_by`),
  CONSTRAINT `fk_cp_bank_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cp_bank_subject` FOREIGN KEY (`mata_pelajaran_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: culture_character_mappings
CREATE TABLE IF NOT EXISTS `culture_character_mappings` (
  `id` char(36) NOT NULL,
  `culture_indicator_id` bigint(20) NOT NULL,
  `character_value_id` bigint(20) NOT NULL,
  `sub_character_label` varchar(100) NOT NULL,
  `weight` decimal(5,2) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_mapping_indicator` (`culture_indicator_id`),
  KEY `fk_mapping_character` (`character_value_id`),
  CONSTRAINT `fk_mapping_character` FOREIGN KEY (`character_value_id`) REFERENCES `character_values` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mapping_indicator` FOREIGN KEY (`culture_indicator_id`) REFERENCES `culture_indicators` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: culture_indicators
CREATE TABLE IF NOT EXISTS `culture_indicators` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_indicator_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: culture_scores
CREATE TABLE IF NOT EXISTS `culture_scores` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) DEFAULT NULL,
  `class_id` char(36) DEFAULT NULL,
  `teacher_user_id` char(36) DEFAULT NULL,
  `academic_year_id` char(36) DEFAULT NULL,
  `semester_id` char(36) NOT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `sss_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `am_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `hb_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `asm_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `br_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `ak_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `tm_score` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `observation_note` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_week_semester` (`student_id`,`week_start_date`,`semester_id`),
  KEY `idx_culture_class_week` (`class_id`,`week_start_date`,`status`),
  KEY `idx_culture_student_semester` (`student_id`,`semester_id`,`week_start_date`),
  KEY `fk_cult_score_enrollment` (`student_enrollment_id`),
  KEY `fk_cult_score_teacher` (`teacher_user_id`),
  KEY `fk_cult_score_year` (`academic_year_id`),
  KEY `fk_cult_score_semester` (`semester_id`),
  CONSTRAINT `fk_cult_score_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cult_score_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cult_score_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cult_score_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cult_score_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_sss_score` CHECK (`sss_score` between 0 and 4),
  CONSTRAINT `chk_am_score` CHECK (`am_score` between 0 and 4),
  CONSTRAINT `chk_hb_score` CHECK (`hb_score` between 0 and 4),
  CONSTRAINT `chk_asm_score` CHECK (`asm_score` between 0 and 4),
  CONSTRAINT `chk_br_score` CHECK (`br_score` between 0 and 4),
  CONSTRAINT `chk_ak_score` CHECK (`ak_score` between 0 and 4),
  CONSTRAINT `chk_tm_score` CHECK (`tm_score` between 0 and 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: documents
CREATE TABLE IF NOT EXISTS `documents` (
  `id` char(36) NOT NULL,
  `type` enum('RPM','KKTP','TRISULA','BLC_PACKAGE','TABAYYUN') NOT NULL,
  `title` varchar(255) NOT NULL,
  `author_id` char(36) NOT NULL,
  `class_id` char(36) DEFAULT NULL,
  `subject_id` char(36) DEFAULT NULL,
  `semester_id` char(36) DEFAULT NULL,
  `status` enum('DRAFT','PUBLISHED','APPROVED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` int(11) NOT NULL DEFAULT 1,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`content`)),
  `forked_from_id` char(36) DEFAULT NULL,
  `reviewed_by` char(36) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `approved_by` char(36) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `root_document_id` varchar(36) DEFAULT NULL,
  `clone_count` int(11) NOT NULL DEFAULT 0,
  `blc_shared_at` datetime DEFAULT NULL,
  `signed_by` char(36) DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_type_status` (`type`,`status`),
  KEY `idx_documents_author` (`author_id`),
  KEY `idx_documents_class_subject_semester` (`class_id`,`subject_id`,`semester_id`),
  KEY `fk_documents_subject` (`subject_id`),
  KEY `fk_documents_semester` (`semester_id`),
  KEY `fk_documents_forked_from` (`forked_from_id`),
  KEY `fk_documents_reviewed_by` (`reviewed_by`),
  KEY `fk_documents_approved_by` (`approved_by`),
  KEY `documents_root_document_id_index` (`root_document_id`),
  KEY `idx_documents_blc_shared` (`blc_shared_at`),
  KEY `documents_signed_by_foreign` (`signed_by`),
  CONSTRAINT `documents_signed_by_foreign` FOREIGN KEY (`signed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_documents_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_forked_from` FOREIGN KEY (`forked_from_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: faqs
CREATE TABLE IF NOT EXISTS `faqs` (
  `id` char(36) NOT NULL,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: gallery_items
CREATE TABLE IF NOT EXISTS `gallery_items` (
  `id` char(36) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `image_id` char(36) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `gallery_items_image_id_foreign` (`image_id`),
  CONSTRAINT `gallery_items_image_id_foreign` FOREIGN KEY (`image_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: import_logs
CREATE TABLE IF NOT EXISTS `import_logs` (
  `id` char(36) NOT NULL,
  `import_type` varchar(100) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `uploaded_by` char(36) DEFAULT NULL,
  `total_rows` int(11) NOT NULL DEFAULT 0,
  `success_rows` int(11) NOT NULL DEFAULT 0,
  `error_rows` int(11) NOT NULL DEFAULT 0,
  `error_report_file_path` varchar(500) DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `error_summary` text DEFAULT NULL,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_import_user` (`uploaded_by`),
  CONSTRAINT `fk_import_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: job_queue
CREATE TABLE IF NOT EXISTS `job_queue` (
  `id` char(36) NOT NULL,
  `job_type` varchar(100) NOT NULL,
  `payload` text NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: kktp_assessment_tps
CREATE TABLE IF NOT EXISTS `kktp_assessment_tps` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `tp_id` char(36) DEFAULT NULL,
  `tp_code` varchar(50) DEFAULT NULL,
  `tp_text_snapshot` text NOT NULL,
  `source_type` enum('TP_BANK','MANUAL','AI_GENERATED','LINKED_RPM') NOT NULL DEFAULT 'MANUAL',
  `order_index` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_kktp_ass_tp_order` (`assessment_id`,`order_index`),
  KEY `fk_kktp_tp_bank` (`tp_id`),
  CONSTRAINT `fk_kktp_tp_ass` FOREIGN KEY (`assessment_id`) REFERENCES `kktp_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_tp_bank` FOREIGN KEY (`tp_id`) REFERENCES `tp_bank` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: kktp_assessments
CREATE TABLE IF NOT EXISTS `kktp_assessments` (
  `id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `class_id` char(36) NOT NULL,
  `subject_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `fase` varchar(50) NOT NULL DEFAULT 'Fase C',
  `status` enum('DRAFT','IN_PROGRESS','COMPLETED','LOCKED') NOT NULL DEFAULT 'DRAFT',
  `created_by` char(36) DEFAULT NULL,
  `letterhead_version_id` varchar(64) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kktp_assessment_scope` (`class_id`,`subject_id`,`academic_year_id`,`semester_id`),
  KEY `idx_kktp_period` (`academic_year_id`,`semester_id`),
  KEY `fk_kktp_ass_subj` (`subject_id`),
  KEY `fk_kktp_ass_sem` (`semester_id`),
  KEY `fk_kktp_ass_creator` (`created_by`),
  CONSTRAINT `fk_kktp_ass_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_ass_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kktp_ass_sem` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_ass_subj` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_ass_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: kktp_student_scores
CREATE TABLE IF NOT EXISTS `kktp_student_scores` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `assessment_tp_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `evidence_status` enum('SUFFICIENT','PARTIAL','INSUFFICIENT') DEFAULT NULL,
  `reflection` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kktp_student_tp_score` (`assessment_id`,`student_id`,`assessment_tp_id`),
  KEY `idx_kktp_score_student_ass` (`student_id`,`assessment_id`),
  KEY `fk_kktp_score_atp` (`assessment_tp_id`),
  KEY `fk_kktp_score_enr` (`student_enrollment_id`),
  CONSTRAINT `fk_kktp_score_ass` FOREIGN KEY (`assessment_id`) REFERENCES `kktp_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_score_atp` FOREIGN KEY (`assessment_tp_id`) REFERENCES `kktp_assessment_tps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_score_enr` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kktp_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: kktp_student_summaries
CREATE TABLE IF NOT EXISTS `kktp_student_summaries` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `average_score` decimal(5,2) DEFAULT NULL,
  `predicate` varchar(50) DEFAULT NULL,
  `competency_description` text DEFAULT NULL,
  `catatan_tutor` text DEFAULT NULL,
  `status` enum('DRAFT','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kktp_student_summary` (`assessment_id`,`student_id`),
  KEY `fk_kktp_sum_student` (`student_id`),
  CONSTRAINT `fk_kktp_sum_ass` FOREIGN KEY (`assessment_id`) REFERENCES `kktp_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kktp_sum_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: navigation_links
CREATE TABLE IF NOT EXISTS `navigation_links` (
  `id` char(36) NOT NULL,
  `menu_id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `label` varchar(100) NOT NULL,
  `url` varchar(512) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `icon` varchar(100) DEFAULT NULL,
  `target` varchar(20) NOT NULL DEFAULT '_self',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `navigation_links_menu_id_foreign` (`menu_id`),
  KEY `navigation_links_parent_id_foreign` (`parent_id`),
  CONSTRAINT `navigation_links_menu_id_foreign` FOREIGN KEY (`menu_id`) REFERENCES `navigation_menus` (`id`) ON DELETE CASCADE,
  CONSTRAINT `navigation_links_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `navigation_links` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: navigation_menus
CREATE TABLE IF NOT EXISTS `navigation_menus` (
  `id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `navigation_menus_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: parent_access_logs
CREATE TABLE IF NOT EXISTS `parent_access_logs` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `action` varchar(100) NOT NULL,
  `success` tinyint(1) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `attempted_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_parent_logs_student` (`student_id`),
  CONSTRAINT `fk_access_log_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: parent_sessions
CREATE TABLE IF NOT EXISTS `parent_sessions` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `issued_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_parent_session_token` (`token_hash`),
  KEY `idx_parent_session_student` (`student_id`),
  CONSTRAINT `fk_parent_session_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: rate_limit_attempts
CREATE TABLE IF NOT EXISTS `rate_limit_attempts` (
  `id` char(36) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `window_start` datetime NOT NULL,
  `locked_until` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `rate_limit_attempts_identifier_endpoint_index` (`identifier`,`endpoint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: report_exports
CREATE TABLE IF NOT EXISTS `report_exports` (
  `id` char(36) NOT NULL,
  `report_type` varchar(100) NOT NULL,
  `snapshot_id` char(36) DEFAULT NULL,
  `student_id` char(36) DEFAULT NULL,
  `class_id` char(36) DEFAULT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `generated_by` char(36) DEFAULT NULL,
  `generated_at` datetime NOT NULL,
  `status` varchar(50) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint(20) NOT NULL,
  `source_type` varchar(100) DEFAULT NULL,
  `source_id` varchar(100) DEFAULT NULL,
  `total_rows` int(11) NOT NULL DEFAULT 0,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_export_snapshot` (`snapshot_id`),
  KEY `fk_export_student` (`student_id`),
  KEY `fk_export_class` (`class_id`),
  KEY `fk_export_year` (`academic_year_id`),
  KEY `fk_export_semester` (`semester_id`),
  KEY `fk_export_user` (`generated_by`),
  CONSTRAINT `fk_export_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_export_snapshot` FOREIGN KEY (`snapshot_id`) REFERENCES `report_snapshots` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_user` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_export_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: report_snapshots
CREATE TABLE IF NOT EXISTS `report_snapshots` (
  `id` char(36) NOT NULL,
  `snapshot_type` varchar(100) NOT NULL,
  `student_id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `snapshot_payload` longtext NOT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_report_snapshot_unique` (`student_id`,`academic_year_id`,`semester_id`,`snapshot_type`),
  KEY `fk_snapshot_class` (`class_id`),
  KEY `fk_snapshot_year` (`academic_year_id`),
  KEY `fk_snapshot_semester` (`semester_id`),
  KEY `fk_snapshot_creator` (`created_by`),
  CONSTRAINT `fk_snapshot_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_snapshot_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: rpm_attachments
CREATE TABLE IF NOT EXISTS `rpm_attachments` (
  `id` char(36) NOT NULL,
  `document_id` char(36) NOT NULL,
  `attachment_type` enum('LKPD','BAHAN_AJAR','RUBRIK','INSTRUMEN_ASESMEN','MEDIA_PENDUKUNG','DOKUMEN_PENDUKUNG','LAINNYA') NOT NULL DEFAULT 'LKPD',
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `file_path` varchar(500) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(127) NOT NULL,
  `file_size` int(10) unsigned NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rpm_attachments_doc_order` (`document_id`,`sort_order`),
  KEY `idx_rpm_attachments_creator` (`created_by`),
  CONSTRAINT `fk_rpm_attachments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rpm_attachments_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: section_items
CREATE TABLE IF NOT EXISTS `section_items` (
  `id` char(36) NOT NULL,
  `section_id` char(36) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `badge` varchar(100) DEFAULT NULL,
  `icon` varchar(100) DEFAULT NULL,
  `image_id` char(36) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `link_url` varchar(512) DEFAULT NULL,
  `link_text` varchar(100) DEFAULT NULL,
  `custom_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_fields`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `section_items_section_id_foreign` (`section_id`),
  KEY `section_items_image_id_foreign` (`image_id`),
  CONSTRAINT `section_items_image_id_foreign` FOREIGN KEY (`image_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `section_items_section_id_foreign` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: sections
CREATE TABLE IF NOT EXISTS `sections` (
  `id` char(36) NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `subtitle` text DEFAULT NULL,
  `badge` varchar(100) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`content`)),
  `is_draft` tinyint(1) NOT NULL DEFAULT 1,
  `draft_content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`draft_content`)),
  `published_at` timestamp NULL DEFAULT NULL,
  `updated_by` char(36) DEFAULT NULL,
  `published_by` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `school_id` varchar(36) DEFAULT NULL,
  `locale` varchar(10) NOT NULL DEFAULT 'id',
  PRIMARY KEY (`id`),
  KEY `sections_updated_by_foreign` (`updated_by`),
  KEY `sections_published_by_foreign` (`published_by`),
  KEY `sections_school_id_index` (`school_id`),
  KEY `sections_locale_index` (`locale`),
  CONSTRAINT `sections_published_by_foreign` FOREIGN KEY (`published_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sections_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: semesters
CREATE TABLE IF NOT EXISTS `semesters` (
  `id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `lifecycle_status` enum('draft','active','locked','archived','soft_deleted','finalized') NOT NULL DEFAULT 'draft',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `locked_at` datetime DEFAULT NULL,
  `locked_by` char(36) DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_semesters_active` (`is_active`),
  KEY `fk_semester_academic_year` (`academic_year_id`),
  CONSTRAINT `fk_semester_academic_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: spp_payments
CREATE TABLE IF NOT EXISTS `spp_payments` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `payment_month` int(11) NOT NULL,
  `payment_year` int(11) NOT NULL,
  `amount_due` decimal(12,2) NOT NULL,
  `amount_paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` varchar(50) NOT NULL DEFAULT 'unpaid',
  `paid_at` datetime DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `verified_by` char(36) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_spp_monthly` (`student_id`,`academic_year_id`,`payment_month`,`payment_year`),
  KEY `fk_spp_year` (`academic_year_id`),
  KEY `fk_spp_verifier` (`verified_by`),
  CONSTRAINT `fk_spp_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_spp_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_spp_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: staff_sessions
CREATE TABLE IF NOT EXISTS `staff_sessions` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `issued_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `last_seen_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_token` (`token_hash`),
  KEY `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: student_attendance_records
CREATE TABLE IF NOT EXISTS `student_attendance_records` (
  `id` char(36) NOT NULL,
  `session_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) NOT NULL,
  `status` enum('hadir','sakit','izin','alpa','terlambat') NOT NULL DEFAULT 'hadir',
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_att_record_student` (`session_id`,`student_id`),
  KEY `idx_att_record_student_lookup` (`student_id`),
  KEY `idx_att_record_enrollment` (`student_enrollment_id`),
  CONSTRAINT `fk_att_rec_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`),
  CONSTRAINT `fk_att_rec_session` FOREIGN KEY (`session_id`) REFERENCES `student_attendance_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_att_rec_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: student_attendance_sessions
CREATE TABLE IF NOT EXISTS `student_attendance_sessions` (
  `id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `attendance_date` date NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `recorded_by` char(36) NOT NULL,
  `updated_by` char(36) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_att_session` (`class_id`,`attendance_date`,`semester_id`),
  KEY `idx_att_session_date` (`attendance_date`),
  KEY `idx_att_session_semester` (`semester_id`),
  KEY `fk_att_sess_year` (`academic_year_id`),
  KEY `fk_att_sess_creator` (`recorded_by`),
  KEY `fk_att_sess_updater` (`updated_by`),
  CONSTRAINT `fk_att_sess_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_att_sess_creator` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_att_sess_sem` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`),
  CONSTRAINT `fk_att_sess_updater` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_att_sess_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: student_enrollments
CREATE TABLE IF NOT EXISTS `student_enrollments` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `class_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `status` enum('active','promoted','repeated','graduated','transferred','inactive') NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `active_enrollment_check` varchar(150) GENERATED ALWAYS AS (if(`status` = 'active',concat(rtrim(`student_id`),'_',rtrim(`academic_year_id`),'_',rtrim(`semester_id`)),NULL)) VIRTUAL,
  `enrolled_at` datetime NOT NULL,
  `withdrawn_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_active_enrollment` (`active_enrollment_check`),
  KEY `idx_enrollment_lookup` (`student_id`,`academic_year_id`,`semester_id`),
  KEY `fk_enrollment_class` (`class_id`),
  KEY `fk_enrollment_year` (`academic_year_id`),
  KEY `fk_enrollment_semester` (`semester_id`),
  CONSTRAINT `fk_enrollment_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollment_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: student_files
CREATE TABLE IF NOT EXISTS `student_files` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` bigint(20) NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `uploaded_by` char(36) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT current_timestamp(),
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_student_files_lookup` (`student_id`),
  KEY `fk_student_file_uploader` (`uploaded_by`),
  CONSTRAINT `fk_student_file_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_student_file_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: students
CREATE TABLE IF NOT EXISTS `students` (
  `id` char(36) NOT NULL,
  `nisn` varchar(20) NOT NULL,
  `nik` varchar(20) DEFAULT NULL,
  `full_name` varchar(191) NOT NULL,
  `birth_place` varchar(100) DEFAULT NULL,
  `birth_date` date NOT NULL,
  `gender` enum('L','P') NOT NULL,
  `religion` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `affirmation` varchar(100) DEFAULT NULL,
  `special_needs` varchar(100) DEFAULT NULL,
  `family_card_number` varchar(50) DEFAULT NULL,
  `family_card_date` date DEFAULT NULL,
  `mother_name` varchar(100) DEFAULT NULL,
  `mother_nik` varchar(20) DEFAULT NULL,
  `father_name` varchar(100) DEFAULT NULL,
  `father_nik` varchar(20) DEFAULT NULL,
  `guardian_name` varchar(100) DEFAULT NULL,
  `guardian_nik` varchar(20) DEFAULT NULL,
  `address_street` varchar(255) DEFAULT NULL,
  `rt` varchar(10) DEFAULT NULL,
  `rw` varchar(10) DEFAULT NULL,
  `hamlet` varchar(100) DEFAULT NULL,
  `village` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `spp_amount` decimal(12,2) DEFAULT NULL,
  `parent_access_pin_hash` varchar(255) DEFAULT NULL,
  `parent_access_pin_failed_attempts` int(11) NOT NULL DEFAULT 0,
  `parent_access_pin_locked_until` datetime DEFAULT NULL,
  `status` enum('active','inactive','graduated','transferred','withdrawn','deceased','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  `restored_at` datetime DEFAULT NULL,
  `restored_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_nisn` (`nisn`),
  KEY `idx_students_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: subjects
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` char(36) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subject_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: teacher_attendance
CREATE TABLE IF NOT EXISTS `teacher_attendance` (
  `id` char(36) NOT NULL,
  `teacher_id` char(36) NOT NULL,
  `date` date NOT NULL,
  `time_in` time NOT NULL,
  `lat` decimal(10,8) NOT NULL,
  `lng` decimal(11,8) NOT NULL,
  `distance_meters` decimal(8,2) NOT NULL,
  `status` varchar(50) NOT NULL,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_attendance_date` (`teacher_id`,`date`),
  CONSTRAINT `fk_attendance_teacher_user` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: teacher_notes
CREATE TABLE IF NOT EXISTS `teacher_notes` (
  `id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) NOT NULL,
  `teacher_user_id` char(36) NOT NULL,
  `note_type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `visibility` enum('public','parent','teacher') NOT NULL DEFAULT 'teacher',
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_note_student` (`student_id`),
  KEY `fk_note_enrollment` (`student_enrollment_id`),
  KEY `fk_note_teacher` (`teacher_user_id`),
  KEY `fk_note_year` (`academic_year_id`),
  KEY `fk_note_semester` (`semester_id`),
  CONSTRAINT `fk_note_enrollment` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_semester` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: teacher_profiles
CREATE TABLE IF NOT EXISTS `teacher_profiles` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `full_name` varchar(191) NOT NULL,
  `gender` enum('L','P') NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `nip` varchar(50) DEFAULT NULL,
  `nuptk` varchar(50) DEFAULT NULL,
  `position` varchar(100) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `lifecycle_status` enum('active','inactive','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_user` (`user_id`),
  CONSTRAINT `fk_teacher_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: testimonials
CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` varchar(255) DEFAULT NULL,
  `quote` text NOT NULL,
  `avatar_image_id` char(36) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `testimonials_avatar_image_id_foreign` (`avatar_image_id`),
  CONSTRAINT `testimonials_avatar_image_id_foreign` FOREIGN KEY (`avatar_image_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tp_bank
CREATE TABLE IF NOT EXISTS `tp_bank` (
  `id` char(36) NOT NULL,
  `teks` text NOT NULL,
  `cp_id` char(36) DEFAULT NULL,
  `kode` varchar(100) DEFAULT NULL,
  `mata_pelajaran_id` char(36) DEFAULT NULL,
  `mata_pelajaran_name` varchar(255) DEFAULT NULL,
  `fase` varchar(50) NOT NULL DEFAULT 'Fase C',
  `sumber` enum('dari_rpm','manual') NOT NULL DEFAULT 'manual',
  `created_by` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tp_bank_mapel_fase` (`mata_pelajaran_id`,`fase`),
  KEY `idx_tp_bank_created_by` (`created_by`),
  KEY `idx_tp_bank_fase` (`fase`),
  KEY `idx_tp_bank_cp_id` (`cp_id`),
  KEY `idx_tp_bank_kode` (`kode`),
  CONSTRAINT `fk_tp_bank_cp` FOREIGN KEY (`cp_id`) REFERENCES `cp_bank` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tp_bank_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tp_bank_subject` FOREIGN KEY (`mata_pelajaran_id`) REFERENCES `subjects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: trisula_assessment_curriculum
CREATE TABLE IF NOT EXISTS `trisula_assessment_curriculum` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `pillar` enum('LITERASI','NUMERASI','DINIYYAH') NOT NULL,
  `cp_id` char(36) DEFAULT NULL,
  `tp_id` char(36) NOT NULL,
  `cp_text_snapshot` text DEFAULT NULL,
  `tp_text_snapshot` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_trisula_curr_ass_pillar` (`assessment_id`,`pillar`),
  KEY `fk_trisula_curr_cp` (`cp_id`),
  KEY `fk_trisula_curr_tp` (`tp_id`),
  CONSTRAINT `fk_trisula_curr_ass` FOREIGN KEY (`assessment_id`) REFERENCES `trisula_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_curr_cp` FOREIGN KEY (`cp_id`) REFERENCES `cp_bank` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trisula_curr_tp` FOREIGN KEY (`tp_id`) REFERENCES `tp_bank` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: trisula_assessments
CREATE TABLE IF NOT EXISTS `trisula_assessments` (
  `id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `class_id` char(36) NOT NULL,
  `academic_year_id` char(36) NOT NULL,
  `semester_id` char(36) NOT NULL,
  `fase` varchar(50) NOT NULL,
  `status` enum('DRAFT','IN_PROGRESS','FINALIZED') NOT NULL DEFAULT 'DRAFT',
  `created_by` char(36) DEFAULT NULL,
  `letterhead_version_id` varchar(64) DEFAULT NULL COMMENT 'UUID of the institutional letterhead version active when this assessment was created. References app_settings letterhead_versions JSON.',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_trisula_assessment_context` (`class_id`,`academic_year_id`,`semester_id`),
  KEY `fk_trisula_ass_year` (`academic_year_id`),
  KEY `fk_trisula_ass_sem` (`semester_id`),
  KEY `fk_trisula_ass_creator` (`created_by`),
  CONSTRAINT `fk_trisula_ass_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_ass_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trisula_ass_sem` FOREIGN KEY (`semester_id`) REFERENCES `semesters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_ass_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: trisula_student_scores
CREATE TABLE IF NOT EXISTS `trisula_student_scores` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `student_enrollment_id` char(36) NOT NULL,
  `pillar` enum('LITERASI','NUMERASI','DINIYYAH') NOT NULL,
  `tp_id` char(36) DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `evidence_status` enum('SUFFICIENT','PARTIAL','INSUFFICIENT') DEFAULT NULL,
  `observation_text` text DEFAULT NULL,
  `achievement_description` text DEFAULT NULL,
  `recommendation` text DEFAULT NULL,
  `source` enum('MANUAL','AI_ASSISTED') NOT NULL DEFAULT 'MANUAL',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trisula_student_score` (`assessment_id`,`student_id`,`pillar`,`tp_id`),
  KEY `fk_trisula_score_student` (`student_id`),
  KEY `fk_trisula_score_enr` (`student_enrollment_id`),
  CONSTRAINT `fk_trisula_score_ass` FOREIGN KEY (`assessment_id`) REFERENCES `trisula_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_score_enr` FOREIGN KEY (`student_enrollment_id`) REFERENCES `student_enrollments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_score_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: trisula_student_summaries
CREATE TABLE IF NOT EXISTS `trisula_student_summaries` (
  `id` char(36) NOT NULL,
  `assessment_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `literasi_score` decimal(5,2) DEFAULT NULL,
  `numerasi_score` decimal(5,2) DEFAULT NULL,
  `diniyyah_score` decimal(5,2) DEFAULT NULL,
  `overall_score` decimal(5,2) DEFAULT NULL,
  `literasi_description` text DEFAULT NULL,
  `numerasi_description` text DEFAULT NULL,
  `diniyyah_description` text DEFAULT NULL,
  `catatan_rangkuman` text DEFAULT NULL,
  `pesan_orang_tua` text DEFAULT NULL,
  `status` enum('DRAFT','COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trisula_student_summary` (`assessment_id`,`student_id`),
  KEY `fk_trisula_sum_student` (`student_id`),
  CONSTRAINT `fk_trisula_sum_ass` FOREIGN KEY (`assessment_id`) REFERENCES `trisula_assessments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trisula_sum_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `username` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('administrator','admin','teacher') NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `failed_login_attempts` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `lifecycle_status` enum('active','inactive','suspended','archived','soft_deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL,
  `archived_by` char(36) DEFAULT NULL,
  `suspended_at` datetime DEFAULT NULL,
  `suspended_by` char(36) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` char(36) DEFAULT NULL,
  `mfa_secret` varchar(255) DEFAULT NULL,
  `mfa_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `mfa_backup_codes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`),
  UNIQUE KEY `uq_user_username` (`username`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_lifecycle` (`lifecycle_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: website_config
CREATE TABLE IF NOT EXISTS `website_config` (
  `id` char(36) NOT NULL,
  `school_name` varchar(255) NOT NULL,
  `short_name` varchar(50) NOT NULL,
  `tagline` varchar(255) NOT NULL,
  `logo_id` char(36) DEFAULT NULL,
  `favicon_id` char(36) DEFAULT NULL,
  `principal_name` varchar(255) NOT NULL,
  `principal_title` varchar(255) NOT NULL,
  `principal_greeting` text NOT NULL,
  `principal_photo_id` char(36) DEFAULT NULL,
  `contact_phone_raw` varchar(50) NOT NULL,
  `contact_phone_display` varchar(50) NOT NULL,
  `contact_email` varchar(191) NOT NULL,
  `address_street` varchar(255) NOT NULL,
  `address_village` varchar(255) NOT NULL,
  `address_district` varchar(255) NOT NULL,
  `address_regency` varchar(255) NOT NULL,
  `address_postal_code` varchar(20) NOT NULL,
  `maps_embed_url` text DEFAULT NULL,
  `social_media` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`social_media`)),
  `seo_defaults` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`seo_defaults`)),
  `theme_branding` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`theme_branding`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `school_id` varchar(36) DEFAULT NULL,
  `locale` varchar(10) NOT NULL DEFAULT 'id',
  PRIMARY KEY (`id`),
  KEY `website_config_logo_id_foreign` (`logo_id`),
  KEY `website_config_favicon_id_foreign` (`favicon_id`),
  KEY `website_config_principal_photo_id_foreign` (`principal_photo_id`),
  KEY `website_config_school_id_index` (`school_id`),
  KEY `website_config_locale_index` (`locale`),
  CONSTRAINT `website_config_favicon_id_foreign` FOREIGN KEY (`favicon_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `website_config_logo_id_foreign` FOREIGN KEY (`logo_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `website_config_principal_photo_id_foreign` FOREIGN KEY (`principal_photo_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. KNEX MIGRATION METADATA (BASELINE STATE)
-- ---------------------------------------------------------------------

CREATE TABLE `knex_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int(11) DEFAULT NULL,
  `migration_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `knex_migrations_lock` (
  `index` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int(11) DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `knex_migrations_lock` (`index`, `is_locked`) VALUES (1, 0);

-- Register all historical migrations as completed in Batch 1
INSERT INTO `knex_migrations` (`name`, `batch`) VALUES
  ('20260709152137_initial_schema.ts', 1),
  ('20260709161302_create_job_queue.ts', 1),
  ('20260709161315_alter_semesters_add_finalized.ts', 1),
  ('20260710170000_create_rate_limit_attempts.ts', 1),
  ('20260711002000_add_lifecycle_columns.ts', 1),
  ('20260715094500_add_missing_lifecycle_columns.ts', 1),
  ('20260715100000_add_deleted_columns_to_class_subjects.ts', 1),
  ('20260715101500_alter_academic_scores_score_nullable.ts', 1),
  ('20260715110000_add_unique_constraints_to_summaries.ts', 1),
  ('20260715120000_migrate_legacy_soft_deleted_users.ts', 1),
  ('20260715130000_fix_promotion_constraints.ts', 1),
  ('20260716220000_add_temporal_timestamps_to_enrollments.ts', 1),
  ('20260720170000_create_website_cms_tables.ts', 1),
  ('20260720170001_create_website_cms_tables.js', 1),
  ('20260721000000_create_structured_content_tables.js', 1),
  ('20260721000001_add_tenant_and_locale_columns.js', 1),
  ('20260721180000_add_mfa_columns.js', 1),
  ('20260721180000_add_mfa_columns.ts', 1),
  ('20260722000000_repair_missing_tables.ts', 1),
  ('20260722000001_repair_missing_tables.js', 1),
  ('20260722100000_create_altcha_replays.ts', 1),
  ('20260805220000_redesign_character_system.js', 1),
  ('20260805220000_redesign_character_system.ts', 1),
  ('20260811130500_create_documents_table.ts', 1),
  ('20260811134000_add_lineage_and_clone_count_to_documents.ts', 1),
  ('20260819150000_add_rpm_sign_share_columns.ts', 1),
  ('20260820100000_create_tp_bank_table.ts', 1),
  ('20260821090000_create_ai_usage_events.ts', 1),
  ('20260821100000_create_cp_bank_and_link_tp.ts', 1),
  ('20260821110000_create_trisula_assessment_tables.ts', 1),
  ('20260826140000_add_kode_to_tp_bank.ts', 1),
  ('20260911190000_add_letterhead_version_id_to_trisula.ts', 1),
  ('20260912180000_create_rpm_attachments_table.ts', 1),
  ('20260915200000_create_student_attendance_tables.ts', 1),
  ('20260925150000_create_kktp_assessment_tables.ts', 1);

-- ---------------------------------------------------------------------
-- 4. REQUIRED SYSTEM DATA (SYSTEM SETTINGS & MASTER LOOKUPS)
-- ---------------------------------------------------------------------

-- Default System Settings
INSERT INTO `app_settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('school_lat', '-7.1373034', 'School latitude coordinate for geofence attendance'),
  ('school_lng', '110.4047823', 'School longitude coordinate for geofence attendance'),
  ('geofence_radius', '150', 'Radius in meters for geofence attendance check'),
  ('school_start_time', '08:00:00', 'Official school start time (HH:MM:SS format)'),
  ('school_name', 'SIUBA Islamic School', 'Official school name'),
  ('school_address', 'Jl. Pendidikan No. 1, Kota Bandung, Jawa Barat', 'School address'),
  ('school_phone', '022-1234567', 'School phone number'),
  ('default_spp_amount', '250000', 'Default SPP amount per month in IDR'),
  ('parent_session_hours', '2', 'Parent portal session duration in hours'),
  ('attendance_late_threshold', '08:00:00', 'Time threshold for marking teacher attendance as late')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- Culture Indicators (SAHABAT Indicators)
INSERT INTO `culture_indicators` (`id`, `code`, `name`, `description`, `status`, `lifecycle_status`) VALUES
  (1, 'SSS', 'Senyum Salam Sapa', 'Menerapkan 3S harian', 'active', 'active'),
  (2, 'AM', 'Aku Mandiri', 'Kemandirian dalam aktivitas belajar', 'active', 'active'),
  (3, 'HB', 'Hebat Bersih', 'Kebersihan diri dan lingkungan', 'active', 'active'),
  (4, 'ASM', 'Asyik Membaca', 'Minat membaca literatur', 'active', 'active'),
  (5, 'BR', 'Berakhlak Religius', 'Ibadah dan akhlak beragama', 'active', 'active'),
  (6, 'AK', 'Aktif Kreatif', 'Kreativitas dan keaktifan kelas', 'active', 'active'),
  (7, 'TM', 'Tangguh Musyawarah', 'Ketahanan diri dan musyawarah', 'active', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Character Values (FITRAH Values)
INSERT INTO `character_values` (`id`, `code`, `name`, `description`, `status`, `lifecycle_status`) VALUES
  (1, 'F', 'Fathonah', 'Kecerdasan intelektual dan spiritual', 'active', 'active'),
  (2, 'I', 'Istiqamah', 'Konsistensi dalam kebaikan', 'active', 'active'),
  (3, 'T', 'Tanggung Jawab', 'Tanggung jawab atas tindakan', 'active', 'active'),
  (4, 'R', 'Ramah', 'Sikap ramah dan peduli sesama', 'active', 'active'),
  (5, 'A', 'Amanah', 'Kejujuran dan integritas diri', 'active', 'active'),
  (6, 'H', 'Harmonis', 'Keselarasan sosial dan kekeluargaan', 'active', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Culture to Character Sub-Indicator Mappings
INSERT INTO `culture_character_mappings` (`id`, `culture_indicator_id`, `character_value_id`, `sub_character_label`, `weight`, `status`, `lifecycle_status`) VALUES
  ('00000000-0000-0000-0000-000000000021', 4, 1, 'Gemar membaca buku perpustakaan', 1.00, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000022', 2, 2, 'Mengerjakan tugas mandiri', 1.00, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000023', 5, 3, 'Melaksanakan sholat berjamaah', 1.00, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000024', 1, 4, 'Menyapa guru dan teman', 0.50, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000025', 3, 4, 'Membuang sampah pada tempatnya', 0.50, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000026', 6, 5, 'Mengumpulkan tugas tepat waktu', 1.00, 'active', 'active'),
  ('00000000-0000-0000-0000-000000000027', 7, 6, 'Menghargai pendapat teman diskusi', 1.00, 'active', 'active')
ON DUPLICATE KEY UPDATE `weight` = VALUES(`weight`);

SET FOREIGN_KEY_CHECKS = 1;
-- =====================================================================
-- END OF SIUBA PRODUCTION BOOTSTRAP
-- =====================================================================
