import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const settings = [
    {
      setting_key: 'school_lat',
      setting_value: '-6.9175',
      description: 'School latitude coordinate for geofence attendance'
    },
    {
      setting_key: 'school_lng',
      setting_value: '107.6191',
      description: 'School longitude coordinate for geofence attendance'
    },
    {
      setting_key: 'geofence_radius',
      setting_value: '100',
      description: 'Radius in meters for geofence attendance check'
    },
    {
      setting_key: 'school_start_time',
      setting_value: '08:00:00',
      description: 'Official school start time (HH:MM:SS format)'
    },
    {
      setting_key: 'school_name',
      setting_value: 'SIUBA Islamic School',
      description: 'Official school name'
    },
    {
      setting_key: 'school_address',
      setting_value: 'Jl. Pendidikan No. 1, Kota Bandung, Jawa Barat',
      description: 'School address'
    },
    {
      setting_key: 'school_phone',
      setting_value: '022-1234567',
      description: 'School phone number'
    },
    {
      setting_key: 'default_spp_amount',
      setting_value: '250000',
      description: 'Default SPP amount per month in IDR'
    },
    {
      setting_key: 'parent_session_hours',
      setting_value: '2',
      description: 'Parent portal session duration in hours'
    },
    {
      setting_key: 'attendance_late_threshold',
      setting_value: '08:00:00',
      description: 'Time threshold for marking teacher attendance as late'
    }
  ];

  for (const s of settings) {
    const existing = await knex('app_settings').where('setting_key', s.setting_key).first();
    if (!existing) {
      await knex('app_settings').insert({
        setting_key: s.setting_key,
        setting_value: s.setting_value,
        description: s.description,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`  ✓ Inserted setting: ${s.setting_key}`);
    } else {
      console.log(`  - Already exists: ${s.setting_key}`);
    }
  }
}
