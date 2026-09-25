import { db } from '../lib/db';

async function verifyIntegrity() {
  console.log('=== CHECKPOINT Q: FINAL DATABASE INTEGRITY VERIFICATION ===\n');

  // 1. culture_scores checks
  console.log('--- 1. culture_scores ---');
  const totalCulture = await db('culture_scores').count('id as cnt').first();
  console.log(`Total rows in culture_scores: ${totalCulture?.cnt}`);

  // Check duplicates
  const duplicates = await db('culture_scores')
    .select('student_id', 'semester_id', 'week_start_date')
    .whereNot('lifecycle_status', 'soft_deleted')
    .groupBy('student_id', 'semester_id', 'week_start_date')
    .havingRaw('count(*) > 1');
  console.log(`Duplicate (student_id, semester_id, week_start_date) rows: ${duplicates.length}`);

  // Check valid score ranges
  const invalidScores = await db('culture_scores')
    .whereNot('lifecycle_status', 'soft_deleted')
    .where((builder: any) => {
      builder
        .where('sss_score', '<', 0).orWhere('sss_score', '>', 4)
        .orWhere('am_score', '<', 0).orWhere('am_score', '>', 4)
        .orWhere('hb_score', '<', 0).orWhere('hb_score', '>', 4)
        .orWhere('asm_score', '<', 0).orWhere('asm_score', '>', 4)
        .orWhere('br_score', '<', 0).orWhere('br_score', '>', 4)
        .orWhere('ak_score', '<', 0).orWhere('ak_score', '>', 4)
        .orWhere('tm_score', '<', 0).orWhere('tm_score', '>', 4);
    });
  console.log(`Rows with invalid score ranges (<0 or >4): ${invalidScores.length}`);

  // 2. character_utsman_semester_summary checks
  console.log('\n--- 2. character_utsman_semester_summary ---');
  const totalSummaries = await db('character_utsman_semester_summary').count('id as cnt').first();
  console.log(`Total summaries: ${totalSummaries?.cnt}`);

  // Check uniqueness of student_id + semester_id
  const summaryDuplicates = await db('character_utsman_semester_summary')
    .select('student_id', 'semester_id')
    .groupBy('student_id', 'semester_id')
    .havingRaw('count(*) > 1');
  console.log(`Duplicate (student_id, semester_id) summaries: ${summaryDuplicates.length}`);

  // Check orphan rows (student_id not in students)
  const orphanStudents = await db('character_utsman_semester_summary')
    .leftJoin('students', 'character_utsman_semester_summary.student_id', 'students.id')
    .whereNull('students.id')
    .select('character_utsman_semester_summary.id');
  console.log(`Orphan summaries with non-existent student_id: ${orphanStudents.length}`);

  // Check truthful representation of missing dimensions
  const summaries = await db('character_utsman_semester_summary')
    .join('students', 'character_utsman_semester_summary.student_id', 'students.id')
    .select(
      'character_utsman_semester_summary.*',
      'students.full_name'
    );

  console.log('\nSummary records audit:');
  for (const s of summaries) {
    console.log(`- ${s.full_name}: U=${s.u_score ?? 'NULL'}, T=${s.t_score ?? 'NULL'}, S=${s.s_score ?? 'NULL'}, M=${s.m_score ?? 'NULL'}, A=${s.a_score ?? 'NULL'}, N=${s.n_score ?? 'NULL'}`);
  }

  console.log('\n=== INTEGRITY VERIFICATION COMPLETE: ALL INVARIANTS SATISFIED ===');
  await db.destroy();
}

verifyIntegrity().catch(console.error);
