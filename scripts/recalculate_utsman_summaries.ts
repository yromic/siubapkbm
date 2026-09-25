import { db } from '../lib/db';
import { calculateAndSaveUTSMAN } from '../lib/services/utsmanCalculationService';

async function main() {
  console.log('=== CHECKPOINT C: RECALCULATING DERIVED UTSMAN SUMMARIES ===\n');

  // 1. Scope discovery
  const cultureRows = await db('culture_scores')
    .whereNot('lifecycle_status', 'soft_deleted')
    .select('student_id', 'semester_id');

  const existingSummaries = await db('character_utsman_semester_summary');

  const pairMap = new Map<string, { student_id: string; semester_id: string }>();
  for (const row of cultureRows) {
    if (row.student_id && row.semester_id) {
      const key = `${row.student_id}:${row.semester_id}`;
      pairMap.set(key, { student_id: row.student_id, semester_id: row.semester_id });
    }
  }

  for (const summary of existingSummaries) {
    if (summary.student_id && summary.semester_id) {
      const key = `${summary.student_id}:${summary.semester_id}`;
      pairMap.set(key, { student_id: summary.student_id, semester_id: summary.semester_id });
    }
  }

  console.log(`Discovered scope:`);
  console.log(`- Culture source rows: ${cultureRows.length}`);
  console.log(`- Current summaries count: ${existingSummaries.length}`);
  console.log(`- Unique student-semester pairs to recalculate: ${pairMap.size}\n`);

  // Target student for before/after comparison
  const zyanId = 'e3974ef0-1d39-4ce9-a752-33678a9ae8f2';
  const beforeZyan = await db('character_utsman_semester_summary')
    .where({ student_id: zyanId })
    .first();

  console.log('--- BEFORE RECALCULATION (Audited Student Zyan) ---');
  if (beforeZyan) {
    console.log({
      student_id: beforeZyan.student_id,
      semester_id: beforeZyan.semester_id,
      u_score: beforeZyan.u_score,
      t_score: beforeZyan.t_score,
      s_score: beforeZyan.s_score,
      m_score: beforeZyan.m_score,
      a_score: beforeZyan.a_score,
      n_score: beforeZyan.n_score,
    });
  } else {
    console.log('No prior summary for Zyan found.');
  }

  // 2. Perform first recalculation
  console.log('\nRecalculating all pairs using canonical calculateAndSaveUTSMAN...');
  let successCount = 0;
  let failureCount = 0;

  for (const pair of pairMap.values()) {
    try {
      await calculateAndSaveUTSMAN(pair.student_id, pair.semester_id);
      successCount++;
    } catch (err) {
      console.error(`Failed recalculating for ${pair.student_id} / ${pair.semester_id}:`, err);
      failureCount++;
    }
  }

  console.log(`Recalculation complete: ${successCount} succeeded, ${failureCount} failed.\n`);

  const afterZyan = await db('character_utsman_semester_summary')
    .where({ student_id: zyanId })
    .first();

  console.log('--- AFTER RECALCULATION (Audited Student Zyan) ---');
  if (afterZyan) {
    console.log({
      student_id: afterZyan.student_id,
      semester_id: afterZyan.semester_id,
      u_score: afterZyan.u_score,
      t_score: afterZyan.t_score,
      s_score: afterZyan.s_score,
      m_score: afterZyan.m_score,
      a_score: afterZyan.a_score,
      n_score: afterZyan.n_score,
    });
  }

  // 3. Idempotency test: run second recalculation
  console.log('\nRunning second recalculation to verify idempotency...');
  const snapshot1 = await db('character_utsman_semester_summary').orderBy('id');

  for (const pair of pairMap.values()) {
    await calculateAndSaveUTSMAN(pair.student_id, pair.semester_id);
  }

  const snapshot2 = await db('character_utsman_semester_summary').orderBy('id');

  let isIdempotent = snapshot1.length === snapshot2.length;
  if (isIdempotent) {
    for (let i = 0; i < snapshot1.length; i++) {
      const s1 = snapshot1[i];
      const s2 = snapshot2[i];
      if (
        s1.u_score !== s2.u_score ||
        s1.t_score !== s2.t_score ||
        s1.s_score !== s2.s_score ||
        s1.m_score !== s2.m_score ||
        s1.a_score !== s2.a_score ||
        s1.n_score !== s2.n_score
      ) {
        isIdempotent = false;
        console.error(`Mismatch at row ${s1.id}:`, { s1, s2 });
        break;
      }
    }
  }

  console.log(`Idempotency verification: ${isIdempotent ? 'PASS (All derived values identical on 2nd run)' : 'FAIL'}`);

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
