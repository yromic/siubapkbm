import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';

export async function getAppSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db('app_settings').select('setting_key', 'setting_value');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value || '';
    }
    return settings;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving app settings',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateAppSettings(settings: Record<string, string>, userId?: string): Promise<Record<string, string>> {
  try {
    await db.transaction(async (trx) => {
      for (const [key, value] of Object.entries(settings)) {
        const existing = await trx('app_settings').where('setting_key', key).first();
        if (existing) {
          await trx('app_settings')
            .where('setting_key', key)
            .update({
              setting_value: value,
              updated_by: userId,
              updated_at: new Date()
            });
        } else {
          await trx('app_settings').insert({
            setting_key: key,
            setting_value: value,
            updated_by: userId,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }
    });
    return getAppSettings();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating app settings',
      'ERR_DATABASE',
      500
    );
  }
}
