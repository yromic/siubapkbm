/**
 * Config.gs
 * Configuration constants, definitions, and settings for the PKBM backend.
 */

// Spreadsheet Sheet Names
var SHEETS = {
  USERS: 'users',
  TEACHER_PROFILES: 'teacher_profiles',
  STUDENTS: 'students',
  ACADEMIC_YEARS: 'academic_years',
  SEMESTERS: 'semesters',
  CLASSES: 'classes',
  CLASS_TEACHER_ASSIGNMENTS: 'class_teacher_assignments',
  STUDENT_ENROLLMENTS: 'student_enrollments',
  SUBJECTS: 'subjects',
  CLASS_SUBJECTS: 'class_subjects',
  ACADEMIC_ASSESSMENTS: 'academic_assessments',
  ACADEMIC_SCORES: 'academic_scores',
  CULTURE_INDICATORS: 'culture_indicators',
  CHARACTER_VALUES: 'character_values',
  CULTURE_CHARACTER_MAPPINGS: 'culture_character_mappings',
  CULTURE_SCORES: 'culture_scores',
  CHARACTER_WEEKLY_SUMMARIES: 'character_weekly_summaries',
  CHARACTER_MONTHLY_SUMMARIES: 'character_monthly_summaries',
  CHARACTER_SEMESTER_SUMMARIES: 'character_semester_summaries',
  STUDENT_FILES: 'student_files',
  TEACHER_NOTES: 'teacher_notes',
  IMPORT_LOGS: 'import_logs',
  AUDIT_LOGS: 'audit_logs',
  APP_SETTINGS: 'app_settings',
  CLASS_PROMOTION_RULES: 'class_promotion_rules',
  PARENT_ACCESS_LOGS: 'parent_access_logs',
  REPORT_SNAPSHOTS: 'report_snapshots',
  REPORT_EXPORTS: 'report_exports',
  BACKUP_SNAPSHOTS: 'backup_snapshots',
  STAFF_SESSIONS: 'staff_sessions',
  SPP_PAYMENTS: 'spp_payments',
  TEACHER_ATTENDANCE: 'teacher_attendance'
};

// Sheet Headers Mapping
var SHEET_HEADERS = {
  users: ['id','name','email','username','password_hash','role','phone','status','failed_login_attempts','locked_until','last_login_at','created_at','updated_at','lifecycle_status','archived_at','archived_by','suspended_at','suspended_by'],
  teacher_profiles: ['id','user_id','full_name','gender','phone','address','nip','nuptk','position','status','created_at','updated_at','lifecycle_status','archived_at','archived_by'],
  students: ['id','nisn','nik','full_name','birth_place','birth_date','gender','religion','phone','affirmation','special_needs','family_card_number','family_card_date','mother_name','mother_nik','father_name','father_nik','guardian_name','guardian_nik','address_street','rt','rw','hamlet','village','district','city','province','spp_amount','parent_access_pin_hash','parent_access_pin_failed_attempts','parent_access_pin_locked_until','status','created_at','updated_at','lifecycle_status','archived_at','archived_by','deleted_at','deleted_by','restored_at','restored_by'],
  academic_years: ['id','name','start_date','end_date','is_active','created_at','updated_at','lifecycle_status','locked_at','locked_by','archived_at','archived_by'],
  semesters: ['id','academic_year_id','name','start_date','end_date','is_active','created_at','updated_at','lifecycle_status','locked_at','locked_by','archived_at','archived_by'],
  classes: ['id','code','name','level','status','created_at','updated_at','lifecycle_status','archived_at','archived_by'],
  class_teacher_assignments: ['id','class_id','teacher_user_id','academic_year_id','semester_id','effective_from','effective_until','status','created_at','updated_at','lifecycle_status'],
  student_enrollments: ['id','student_id','class_id','academic_year_id','semester_id','status','created_at','updated_at','lifecycle_status'],
  subjects: ['id','code','name','description','status','created_at','updated_at','lifecycle_status','archived_at','archived_by'],
  class_subjects: ['id','class_id','subject_id','academic_year_id','semester_id','status','created_at','updated_at','lifecycle_status'],
  academic_assessments: ['id','teacher_user_id','class_id','subject_id','academic_year_id','semester_id','title','description','assessment_date','score_min','score_max','status','created_at','updated_at','lifecycle_status','deleted_at','deleted_by','locked_at','locked_by'],
  academic_scores: ['id','assessment_id','student_id','student_enrollment_id','score','note','status','created_at','updated_at','lifecycle_status','deleted_at','deleted_by'],
  culture_indicators: ['id','code','name','description','status','created_at','updated_at','lifecycle_status'],
  character_values: ['id','code','name','description','status','created_at','updated_at','lifecycle_status'],
  culture_character_mappings: ['id','culture_indicator_id','character_value_id','sub_character_label','weight','status','created_at','updated_at','lifecycle_status'],
  culture_scores: ['id','student_id','student_enrollment_id','class_id','teacher_user_id','academic_year_id','semester_id','score_date','sss_score','am_score','hb_score','asm_score','br_score','ak_score','tm_score','status','created_at','updated_at','lifecycle_status'],
  character_weekly_summaries: ['id','student_id','student_enrollment_id','academic_year_id','semester_id','week_start_date','week_end_date','f_score','i_score','t_score','r_score','a_score','h_score','sss_sum','sss_count','am_sum','am_count','hb_sum','hb_count','asm_sum','asm_count','br_sum','br_count','ak_sum','ak_count','tm_sum','tm_count','days_counted','created_at','updated_at','lifecycle_status'],
  character_monthly_summaries: ['id','student_id','student_enrollment_id','academic_year_id','semester_id','month','year','f_score','i_score','t_score','r_score','a_score','h_score','sss_sum','sss_count','am_sum','am_count','hb_sum','hb_count','asm_sum','asm_count','br_sum','br_count','ak_sum','ak_count','tm_sum','tm_count','days_counted','created_at','updated_at','lifecycle_status'],
  character_semester_summaries: ['id','student_id','student_enrollment_id','academic_year_id','semester_id','f_score','i_score','t_score','r_score','a_score','h_score','sss_sum','sss_count','am_sum','am_count','hb_sum','hb_count','asm_sum','asm_count','br_sum','br_count','ak_sum','ak_count','tm_sum','tm_count','days_counted','created_at','updated_at','lifecycle_status'],
  student_files: ['id','student_id','file_type','drive_file_id','original_filename','mime_type','file_size','version','status','uploaded_by','uploaded_at','created_at','updated_at','lifecycle_status','deleted_at','deleted_by'],
  teacher_notes: ['id','student_id','student_enrollment_id','teacher_user_id','note_type','title','content','visibility','academic_year_id','semester_id','created_at','updated_at','lifecycle_status'],
  import_logs: ['id','import_type','file_name','drive_file_id','uploaded_by','total_rows','success_rows','error_rows','error_report_file_id','status','error_summary','created_at','updated_at','lifecycle_status'],
  audit_logs: ['id','user_id','user_name','user_role','action','entity_type','entity_id','old_value','new_value','description','ip_address','user_agent','created_at'],
  app_settings: ['id','setting_key','setting_value','description','updated_by','updated_at'],
  class_promotion_rules: ['id','source_class_id','target_class_id','status','created_at','updated_at','lifecycle_status'],
  parent_access_logs: ['id','student_id','action','success','ip_address','user_agent','attempted_at'],
  report_snapshots: ['id','snapshot_type','student_id','class_id','academic_year_id','semester_id','snapshot_payload','created_by','created_at'],
  report_exports: ['id','report_type','snapshot_id','student_id','class_id','academic_year_id','semester_id','generated_by','generated_at','status','file_id','file_name','mime_type','file_size','source_type','source_id','total_rows','created_at','updated_at','lifecycle_status'],
  backup_snapshots: ['id','backup_file_id','backup_type','created_by','created_at','status','sheet_count','record_count','description'],
  staff_sessions: ['id','user_id','token_hash','issued_at','expires_at','revoked_at','last_seen_at','ip_address','user_agent','created_at','updated_at','lifecycle_status'],
  spp_payments: ['id','student_id','academic_year_id','month','year','amount_due','amount_paid','payment_status','paid_at','payment_method','verified_by','notes','created_at','updated_at','lifecycle_status','deleted_at','deleted_by'],
  teacher_attendance: ['id','teacher_id','date','time_in','lat','lng','distance_meters','status','created_at','updated_at','lifecycle_status']
};

// Staff Roles
var ROLES = {
  ADMINISTRATOR: 'administrator',
  ADMIN: 'admin',
  TEACHER: 'teacher'
};

// Entity Statuses
var STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  REVISED: 'revised',
  LOCKED: 'locked',
  DRAFT: 'draft',
  PUBLISHED: 'published'
};

// Lockout Configuration
var LOCKOUT = {
  MAX_ATTEMPTS: 5,
  DURATION_MINUTES: 15
};

// Staff session configuration
var STAFF_SESSION_TTL_HOURS = 12;

// Production default: bootstrap actions must not be callable through the WebApp.
var ALLOW_BOOTSTRAP_ACTIONS = false;

// Audit Log Config
// TODO: For production, set actual AUDIT_SPREADSHEET_ID here. If blank, it fallbacks to local audit_logs sheet.
var AUDIT_SPREADSHEET_ID = '1pqOrWOZbeFdReJ4p9EHUtABgJxlxNCy94MHXt2HQTZM';

// Default Administrator Account
var DEFAULT_ADMIN = {
  name: 'Administrator',
  email: 'admin@example.com',
  username: 'admin',
  password: 'Admin123!', // TODO: Required to change on first login / production deployment.
  role: ROLES.ADMINISTRATOR,
  status: STATUS.ACTIVE
};

// Salt Prefix for Password Hashing
var HASH_SALT_PREFIX = 'PKBM_SALT_';

// App Sprint Version
var SPRINT_VERSION = '1.0.0';

// Optional Main Spreadsheet ID for future external migration
var MAIN_SPREADSHEET_ID = '';
