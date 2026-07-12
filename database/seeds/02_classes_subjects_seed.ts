import { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // 1. Create Classes
  const classesToInsert = [
    { code: 'K10A', name: 'Kelas 10A', level: 10 },
    { code: 'K10B', name: 'Kelas 10B', level: 10 },
    { code: 'K11A', name: 'Kelas 11A', level: 11 }
  ];

  const classIds: Record<string, string> = {};

  for (const c of classesToInsert) {
    const existing = await knex('classes').where('code', c.code).first();
    if (!existing) {
      const id = uuidv4();
      await knex('classes').insert({
        id,
        code: c.code,
        name: c.name,
        level: c.level,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      classIds[c.code] = id;
    } else {
      classIds[c.code] = existing.id;
    }
  }

  // 2. Create Subjects
  const subjectsToInsert = [
    { code: 'MTK', name: 'Matematika', description: 'Matematika Peminatan' },
    { code: 'FIS', name: 'Fisika', description: 'Fisika Dasar' }
  ];

  const subjectIds: Record<string, string> = {};

  for (const s of subjectsToInsert) {
    const existing = await knex('subjects').where('code', s.code).first();
    if (!existing) {
      const id = uuidv4();
      await knex('subjects').insert({
        id,
        code: s.code,
        name: s.name,
        description: s.description,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      subjectIds[s.code] = id;
    } else {
      subjectIds[s.code] = existing.id;
    }
  }

  // 3. Assign MTK subject to K10A for the active period
  const activeYear = await knex('academic_years').where('is_active', 1).first();
  if (activeYear) {
    const activeSemester = await knex('semesters')
      .where('academic_year_id', activeYear.id)
      .where('is_active', 1)
      .first();

    if (activeSemester) {
      const classId = classIds['K10A'];
      const subjectId = subjectIds['MTK'];

      const existingAssignment = await knex('class_subjects')
        .where({
          class_id: classId,
          subject_id: subjectId,
          academic_year_id: activeYear.id,
          semester_id: activeSemester.id
        })
        .first();

      if (!existingAssignment) {
        await knex('class_subjects').insert({
          id: uuidv4(),
          class_id: classId,
          subject_id: subjectId,
          academic_year_id: activeYear.id,
          semester_id: activeSemester.id,
          status: 'active',
          lifecycle_status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
        console.log('Seed: Assigned Matematika to Kelas 10A for current active period.');
      }
    }
  }

  // 4. Create dummy student "Ahmad Dani"
  const studentNisn = '0000000001';
  const existingStudent = await knex('students').where('nisn', studentNisn).first();
  
  if (!existingStudent) {
    const pinHash = await bcrypt.hash('123456', 10);
    await knex('students').insert({
      id: uuidv4(),
      nisn: studentNisn,
      full_name: 'Ahmad Dani',
      birth_date: '2010-01-01',
      gender: 'L',
      status: 'active',
      parent_access_pin_hash: pinHash,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('Seed: Ahmad Dani dummy student created.');
  }
}
