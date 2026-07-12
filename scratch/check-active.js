const mysql = require('mysql2/promise');
async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'siuba_dev'
  });
  const [years] = await connection.query("SELECT id, name, is_active FROM academic_years;");
  console.log("YEARS:", years);
  const [semesters] = await connection.query("SELECT id, name, is_active FROM semesters;");
  console.log("SEMESTERS:", semesters);
  const [enrollments] = await connection.query("SELECT student_id, academic_year_id, semester_id, status FROM student_enrollments;");
  console.log("ENROLLMENTS:", enrollments);
  await connection.end();
}
run().catch(console.error);
