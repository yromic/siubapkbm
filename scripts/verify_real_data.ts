import { db } from '../lib/db';
import { calculateAndSaveUTSMAN, getUTSMANSummary } from '../lib/services/utsmanCalculationService';
import { getParentCharacterSummary } from '../lib/services/parentService';

async function main() {
  console.log('=== CHECKPOINT L: VERIFYING REAL DATA PROFILES ===\n');

  // L1. PARTIAL OBSERVATION: Student Zyan Abdurrahman Tsaqif
  const zyanId = 'e3974ef0-1d39-4ce9-a752-33678a9ae8f2';
  console.log('--- L1: Partially Observed Student (Zyan) ---');
  const zyanScores = await db('culture_scores')
    .where({ student_id: zyanId })
    .whereNot('lifecycle_status', 'soft_deleted');
  console.log(`Culture records count for Zyan: ${zyanScores.length}`);
  console.log('Raw culture scores:', zyanScores.map((s: any) => ({
    week: s.week_start_date,
    sss: s.sss_score,
    am: s.am_score,
    hb: s.hb_score,
    asm: s.asm_score,
    br: s.br_score,
    ak: s.ak_score,
    tm: s.tm_score,
  })));

  const zyanSummary = await getUTSMANSummary(zyanId, zyanScores[0]?.semester_id);
  console.log('Derived UTSMAN Summary for Zyan:', {
    u: zyanSummary?.u_score,
    t: zyanSummary?.t_score,
    s: zyanSummary?.s_score,
    m: zyanSummary?.m_score,
    a: zyanSummary?.a_score,
    n: zyanSummary?.n_score,
  });

  const zyanParent = await getParentCharacterSummary(zyanId);
  console.log('Parent Character API result for Zyan:', {
    student: zyanParent.student.full_name,
    utsman: zyanParent.utsman,
    available_count: zyanParent.interpretation.available_count,
    has_data: zyanParent.interpretation.has_data,
  });

  // L2. FULLY OBSERVED / MULTI-OBSERVED STUDENT
  console.log('\n--- L2: Checking other students in culture_scores ---');
  const otherStudents = await db('culture_scores')
    .whereNot('lifecycle_status', 'soft_deleted')
    .whereNot('student_id', zyanId)
    .select('student_id', 'semester_id')
    .distinct();

  for (const s of otherStudents) {
    const student = await db('students').where('id', s.student_id).first();
    const summary = await getUTSMANSummary(s.student_id, s.semester_id);
    console.log(`Student: ${student?.full_name || s.student_id}`, {
      u: summary?.u_score,
      t: summary?.t_score,
      s: summary?.s_score,
      m: summary?.m_score,
      a: summary?.a_score,
      n: summary?.n_score,
    });
  }

  // L3. NO OBSERVATIONS STUDENT
  console.log('\n--- L3: Student with No Observations ---');
  // Find a student not in culture_scores
  const allCultureStudentIds = (await db('culture_scores')
    .whereNot('lifecycle_status', 'soft_deleted')
    .select('student_id')).map((r: any) => r.student_id);

  const unobservedStudent = await db('students')
    .join('student_enrollments', 'students.id', 'student_enrollments.student_id')
    .whereNotIn('students.id', allCultureStudentIds)
    .where('student_enrollments.status', 'active')
    .whereNot('students.status', 'soft_deleted')
    .select('students.id', 'students.full_name', 'student_enrollments.semester_id')
    .first();

  if (unobservedStudent) {
    console.log(`Unobserved Student: ${unobservedStudent.full_name} (${unobservedStudent.id})`);
    const noObsSummary = await getUTSMANSummary(unobservedStudent.id, unobservedStudent.semester_id);
    console.log('Summary in DB:', noObsSummary);

    const noObsParent = await getParentCharacterSummary(unobservedStudent.id);
    console.log('Parent Character API result for unobserved student:', {
      student: noObsParent.student.full_name,
      utsman: noObsParent.utsman,
      has_data: noObsParent.interpretation.has_data,
      notice: noObsParent.interpretation.completeness_notice,
    });
  } else {
    console.log('All enrolled students have culture observations.');
  }

  await db.destroy();
}

main().catch(console.error);
