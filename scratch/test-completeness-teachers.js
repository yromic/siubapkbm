const { getTeacherCompleteness } = require('../lib/services/completenessService');

async function run() {
  try {
    const { db } = require('../lib/db');
    const year = await db('academic_years').where('is_active', 1).first();
    const sem = await db('semesters').where('is_active', 1).first();
    console.log('Active year:', year?.id, 'Active sem:', sem?.id);
    
    if (!year || !sem) return;

    const result = await getTeacherCompleteness(year.id, sem.id, undefined, 'week');
    console.log('Result sample:', JSON.stringify(result, null, 2).slice(0, 1000));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
