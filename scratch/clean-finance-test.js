const mysql = require('mysql2/promise');
async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'siuba_dev'
  });
  await connection.query("SET FOREIGN_KEY_CHECKS = 0;");
  await connection.query("DELETE FROM spp_payments;");
  await connection.query("DELETE FROM teacher_attendance;");
  await connection.query("DELETE FROM import_logs;");
  await connection.query("DELETE FROM report_snapshots;");
  await connection.query("DELETE FROM report_exports;");
  await connection.query("DELETE FROM class_promotion_rules;");
  await connection.query("DELETE FROM job_queue;");
  await connection.query("DELETE FROM semesters WHERE name = 'Semester Genap';");
  await connection.query("DELETE FROM student_enrollments WHERE class_id IN (SELECT id FROM classes WHERE code = 'K11A');");
  await connection.query("DELETE FROM classes WHERE code = 'K11A';");
  await connection.query("DELETE FROM student_enrollments WHERE student_id IN (SELECT id FROM students WHERE nisn = '9999999999');");
  await connection.query("DELETE FROM students WHERE nisn = '9999999999';");
  // Reset semester status to active
  await connection.query("UPDATE semesters SET lifecycle_status = 'active';");
  await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("Cleanup done.");
  await connection.end();
}
run().catch(console.error);
