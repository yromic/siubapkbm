const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'siuba_dev',
  }
});

async function main() {
  console.log("Starting database clean...");
  try {
    // Disable foreign key checks to delete everything safely
    await knex.raw("SET FOREIGN_KEY_CHECKS = 0;");

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
      "teacher_profiles"
    ];

    for (const table of tables) {
      await knex(table).truncate();
      console.log(`Truncated table: ${table}`);
    }

    // Delete all users except administrator role
    const deletedUsers = await knex('users').whereNot('role', 'administrator').delete();
    console.log(`Deleted ${deletedUsers} non-administrator users.`);

    // Keep administrator role active
    const admins = await knex('users').select('id', 'username', 'role');
    console.log("Remaining users in database:", admins);

    // Re-enable foreign key checks
    await knex.raw("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("Database clean completed successfully!");
  } catch (error) {
    console.error("Error cleaning database:", error);
  } finally {
    await knex.destroy();
  }
}

main();
