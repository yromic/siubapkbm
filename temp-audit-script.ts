import db from './database/connection';

async function run() {
  try {
    const results: any = {};

    // Get Active Year & Semester
    const activeYear = await db("academic_years").where("is_active", 1).first();
    results.activeYear = activeYear;
    const activeSemester = activeYear
      ? await db("semesters").where({ academic_year_id: activeYear.id, is_active: 1 }).first()
      : null;
    results.activeSemester = activeSemester;

    // 1. Active Students Count
    results.activeStudentsCount = await db.raw("select count(id) as count from students where status in ('active', 'Aktif') and deleted_at is null");

    // 2. Active Teachers Count
    results.activeTeachersCount = await db.raw("select count(id) as count from users where role = 'teacher' and lifecycle_status <> 'soft_deleted'");

    // 3. Active Classes Count
    results.activeClassesCount = await db.raw("select count(id) as count from classes where lifecycle_status = 'active'");

    // 4. Academic Completion
    if (activeSemester) {
      results.academicAssessmentsTotal = await db.raw("select count(id) as count from academic_assessments where semester_id = ? and lifecycle_status <> 'soft_deleted'", [activeSemester.id]);
      results.academicAssessmentsLocked = await db.raw("select count(id) as count from academic_assessments where semester_id = ? and status = 'locked' and lifecycle_status <> 'soft_deleted'", [activeSemester.id]);
      results.academicAssessmentsRows = await db.raw("select id, class_id, subject_id, status from academic_assessments where semester_id = ? and lifecycle_status <> 'soft_deleted'", [activeSemester.id]);
    }

    // 5. Character Completion / Culture Progress
    if (activeYear && activeSemester) {
      results.activeClassesList = await db.raw("select id, name from classes where lifecycle_status = 'active'");
      
      const classId = '25345b5c-28e0-442c-9591-6922a2db405a'; // Class 1
      results.enrollmentsCount = await db.raw("select count(id) as count from student_enrollments where class_id = ? and academic_year_id = ? and semester_id = ? and status = 'active' and lifecycle_status <> 'soft_deleted'", [classId, activeYear.id, activeSemester.id]);
      results.cultureUniqueDates = await db.raw("select distinct score_date from culture_scores where class_id = ? and semester_id = ? and lifecycle_status <> 'soft_deleted'", [classId, activeSemester.id]);
      results.cultureScoresCount = await db.raw("select count(id) as count from culture_scores where class_id = ? and semester_id = ? and lifecycle_status <> 'soft_deleted'", [classId, activeSemester.id]);
    }

    // 6. Teacher Attendance
    results.teacherAttendanceCount = await db.raw("select count(id) as count from teacher_attendance where lifecycle_status <> 'soft_deleted' and MONTH(date) = 7 and YEAR(date) = 2026");
    results.teacherAttendancePresentLate = await db.raw("select count(id) as count from teacher_attendance where lifecycle_status <> 'soft_deleted' and MONTH(date) = 7 and YEAR(date) = 2026 and status in ('present', 'late')");

    // 7. SPP Completion
    results.sppTotalCount = await db.raw("select count(id) as count from spp_payments where lifecycle_status <> 'soft_deleted'");
    results.sppPaidCount = await db.raw("select count(id) as count from spp_payments where lifecycle_status <> 'soft_deleted' and payment_status in ('paid', 'verified')");
    results.sppThisMonthSummary = await db.raw("select payment_status, count(id) as count from spp_payments where payment_month = 7 and payment_year = 2026 and lifecycle_status <> 'soft_deleted' group by payment_status");

    // 8. Document Completion
    results.documentActiveStudentsCount = await db.raw("select count(id) as count from students where status in ('active', 'Aktif') and deleted_at is null");
    results.documentWithMandatoryDocs = await db.raw(`
      select count(students.id) as count from students 
      where status in ('active', 'Aktif') and deleted_at is null
      and exists (
        select 1 from student_files 
        where student_files.student_id = students.id
        and student_files.file_type in ('kk', 'akta')
        and student_files.lifecycle_status <> 'soft_deleted'
        group by student_files.student_id
        having count(distinct student_files.file_type) >= 2
      )
    `);

    // 9. FITRAH Radar
    if (activeSemester) {
      results.characterSemesterSummariesCount = await db.raw("select count(id) as count from character_semester_summaries where semester_id = ? and lifecycle_status <> 'soft_deleted'", [activeSemester.id]);
      results.characterSemesterSummariesAverages = await db.raw(`
        select AVG(f_score) as f, AVG(i_score) as i, AVG(t_score) as t, AVG(r_score) as r, AVG(a_score) as a, AVG(h_score) as h 
        from character_semester_summaries where semester_id = ? and lifecycle_status <> 'soft_deleted'
      `, [activeSemester.id]);
    }

    // 10. Best Academic Class & Averages
    if (activeSemester) {
      results.classAcademicAverages = await db.raw(`
        select student_enrollments.class_id, classes.name, AVG(academic_scores.score) as avgScore
        from academic_scores
        join student_enrollments on academic_scores.student_enrollment_id = student_enrollments.id
        join academic_assessments on academic_scores.assessment_id = academic_assessments.id
        join classes on student_enrollments.class_id = classes.id
        where student_enrollments.status = 'active'
        and student_enrollments.semester_id = ?
        and academic_assessments.semester_id = ?
        and academic_scores.lifecycle_status <> 'soft_deleted'
        and academic_assessments.lifecycle_status <> 'soft_deleted'
        group by student_enrollments.class_id, classes.name
      `, [activeSemester.id, activeSemester.id]);
    }

    // 11. Best Culture Class & Averages
    if (activeSemester) {
      results.classCultureAverages = await db.raw(`
        select student_enrollments.class_id, classes.name,
        AVG((character_semester_summaries.f_score + character_semester_summaries.i_score + character_semester_summaries.t_score + character_semester_summaries.r_score + character_semester_summaries.a_score + character_semester_summaries.h_score) / 6.0) as culture_avg
        from character_semester_summaries
        join student_enrollments on character_semester_summaries.student_enrollment_id = student_enrollments.id
        join classes on student_enrollments.class_id = classes.id
        where student_enrollments.semester_id = ?
        and student_enrollments.status = 'active'
        and character_semester_summaries.lifecycle_status <> 'soft_deleted'
        group by student_enrollments.class_id, classes.name
      `, [activeSemester.id]);
    }

    // 12. Most Active Teacher (Teacher Productivity)
    if (activeSemester) {
      results.mostActiveTeacher = await db.raw(`
        select users.id, users.name, count(academic_assessments.id) as count
        from academic_assessments
        join users on academic_assessments.teacher_user_id = users.id
        where academic_assessments.semester_id = ?
        and academic_assessments.lifecycle_status <> 'soft_deleted'
        group by users.id, users.name
        order by count desc
        limit 1
      `, [activeSemester.id]);
    }

    // 13. Classes Without Wali
    if (activeSemester) {
      results.classesWithoutWali = await db.raw(`
        select id, name from classes
        where lifecycle_status = 'active'
        and id not in (
          select class_id from class_teacher_assignments
          where semester_id = ? and status = 'active' and lifecycle_status <> 'soft_deleted'
        )
      `, [activeSemester.id]);
    }

    // 14. Orphan Students Count
    if (activeSemester) {
      results.orphanStudentsCount = await db.raw(`
        select count(students.id) as count from students
        where status in ('active', 'Aktif')
        and deleted_at is null
        and not exists (
          select 1 from student_enrollments
          where student_enrollments.student_id = students.id
          and student_enrollments.semester_id = ?
          and student_enrollments.status = 'active'
          and student_enrollments.lifecycle_status <> 'soft_deleted'
        )
      `, [activeSemester.id]);
    }

    // 15. Student Watchlist
    if (activeSemester) {
      results.watchlistWithoutScoresCount = await db.raw(`
        select count(distinct student_enrollments.student_id) as count from student_enrollments
        where semester_id = ? and status = 'active' and lifecycle_status <> 'soft_deleted'
        and id not in (
          select student_enrollment_id from academic_scores
          join academic_assessments on academic_scores.assessment_id = academic_assessments.id
          where academic_assessments.semester_id = ?
          and academic_scores.lifecycle_status <> 'soft_deleted'
          and academic_assessments.lifecycle_status <> 'soft_deleted'
        )
      `, [activeSemester.id, activeSemester.id]);

      results.watchlistWithoutCultureCount = await db.raw(`
        select count(distinct student_enrollments.student_id) as count from student_enrollments
        where semester_id = ? and status = 'active' and lifecycle_status <> 'soft_deleted'
        and student_id not in (
          select student_id from culture_scores
          where semester_id = ? and lifecycle_status <> 'soft_deleted'
        )
      `, [activeSemester.id, activeSemester.id]);
    }

    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}

run();
