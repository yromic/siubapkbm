import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // 1. Seed Culture Indicators
  const indicators = [
    { code: 'SSS', name: 'Senyum Salam Sapa', description: 'Menerapkan 3S harian' },
    { code: 'AM', name: 'Aku Mandiri', description: 'Kemandirian dalam aktivitas belajar' },
    { code: 'HB', name: 'Hebat Bersih', description: 'Kebersihan diri dan lingkungan' },
    { code: 'ASM', name: 'Asyik Membaca', description: 'Minat membaca literatur' },
    { code: 'BR', name: 'Berakhlak Religius', description: 'Ibadah dan akhlak beragama' },
    { code: 'AK', name: 'Aktif Kreatif', description: 'Kreativitas dan keaktifan kelas' },
    { code: 'TM', name: 'Tangguh Musyawarah', description: 'Ketahanan diri dan musyawarah' }
  ];

  const indicatorIds: Record<string, number | string> = {};

  for (const ind of indicators) {
    const existing = await knex('culture_indicators').where('code', ind.code).first();
    if (!existing) {
      const [insertId] = await knex('culture_indicators').insert({
        code: ind.code,
        name: ind.name,
        description: ind.description,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      indicatorIds[ind.code] = insertId;
    } else {
      indicatorIds[ind.code] = existing.id;
    }
  }

  // 2. Seed Character Values
  const values = [
    { code: 'F', name: 'Fathonah', description: 'Kecerdasan intelektual dan spiritual' },
    { code: 'I', name: 'Istiqamah', description: 'Konsistensi dalam kebaikan' },
    { code: 'T', name: 'Tanggung Jawab', description: 'Tanggung jawab atas tindakan' },
    { code: 'R', name: 'Ramah', description: 'Sikap ramah dan peduli sesama' },
    { code: 'A', name: 'Amanah', description: 'Kejujuran dan integritas diri' },
    { code: 'H', name: 'Harmonis', description: 'Keselarasan sosial dan kekeluargaan' }
  ];

  const valueIds: Record<string, number | string> = {};

  for (const val of values) {
    const existing = await knex('character_values').where('code', val.code).first();
    if (!existing) {
      const [insertId] = await knex('character_values').insert({
        code: val.code,
        name: val.name,
        description: val.description,
        status: 'active',
        lifecycle_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      valueIds[val.code] = insertId;
    } else {
      valueIds[val.code] = existing.id;
    }
  }

  // 3. Seed Mappings
  const mappings = [
    { ind: 'ASM', val: 'F', weight: 1.0, label: 'Gemar membaca buku perpustakaan' },
    { ind: 'AM', val: 'I', weight: 1.0, label: 'Mengerjakan tugas mandiri' },
    { ind: 'BR', val: 'T', weight: 1.0, label: 'Melaksanakan sholat berjamaah' },
    { ind: 'SSS', val: 'R', weight: 0.5, label: 'Menyapa guru dan teman' },
    { ind: 'HB', val: 'R', weight: 0.5, label: 'Membuang sampah pada tempatnya' },
    { ind: 'AK', val: 'A', weight: 1.0, label: 'Mengumpulkan tugas tepat waktu' },
    { ind: 'TM', val: 'H', weight: 1.0, label: 'Menghargai pendapat teman diskusi' }
  ];

  for (const m of mappings) {
    const indId = indicatorIds[m.ind];
    const valId = valueIds[m.val];

    if (indId && valId) {
      const existing = await knex('culture_character_mappings')
        .where({
          culture_indicator_id: indId,
          character_value_id: valId
        })
        .first();

      if (!existing) {
        await knex('culture_character_mappings').insert({
          id: uuidv4(),
          culture_indicator_id: indId,
          character_value_id: valId,
          sub_character_label: m.label,
          weight: m.weight,
          status: 'active',
          lifecycle_status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }
  }

  console.log('Seed: Culture indicators, values and mappings seeded successfully.');
}
