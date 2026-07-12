import type { Knex } from "knex";
import fs from "fs";
import path from "path";

export async function up(knex: Knex): Promise<void> {
  const schemaPath = path.join(process.cwd(), "siuba_db_schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  
  // Split statements by semicolon
  const rawStatements = schemaSql.split(";");
  
  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  
  for (const rawStmt of rawStatements) {
    const stmt = rawStmt.trim();
    if (!stmt) continue;
    
    // Ignore standalone comment blocks or SET commands if they are empty
    await knex.raw(stmt);
  }
  
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    "audit_logs",
    "class_promotion_rules",
    "backup_snapshots",
    "report_exports",
    "report_snapshots",
    "import_logs",
    "parent_sessions",
    "parent_access_logs",
    "spp_payments",
    "teacher_attendance",
    "teacher_notes",
    "student_files",
    "character_semester_summaries",
    "character_monthly_summaries",
    "character_weekly_summaries",
    "culture_scores",
    "academic_scores",
    "academic_assessments",
    "culture_character_mappings",
    "character_values",
    "culture_indicators",
    "student_enrollments",
    "students",
    "class_teacher_assignments",
    "class_subjects",
    "subjects",
    "classes",
    "semesters",
    "academic_years",
    "staff_sessions",
    "teacher_profiles",
    "users",
    "app_settings"
  ];

  await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");
  for (const table of tables) {
    await knex.raw(`DROP TABLE IF EXISTS \`${table}\`;`);
  }
  await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
}
