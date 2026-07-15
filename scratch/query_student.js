const knex = require('knex');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'siuba_dev',
  }
};

const db = knex(config);

async function run() {
  try {
    const students = await db('students').where({ nisn: '3183850167' });
    console.log("--- Student Data ---");
    console.log(JSON.stringify(students, null, 2));

    // Also get active class enrollments for this student
    if (students.length > 0) {
      const studentId = students[0].id;
      const enrollments = await db('student_enrollments')
        .join('classes', 'student_enrollments.class_id', 'classes.id')
        .where('student_enrollments.student_id', studentId)
        .select('student_enrollments.*', 'classes.name as class_name');
      console.log("--- Enrollments Data ---");
      console.log(JSON.stringify(enrollments, null, 2));
    }
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await db.destroy();
  }
}

run();
