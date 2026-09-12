import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { LetterheadVersion, LetterheadSnapshot } from '@/types/letterhead';

export type { LetterheadVersion, LetterheadSnapshot };

// ─── Setting keys ───────────────────────────────────────────────────────────
const KEY_ACTIVE_LETTERHEAD_ID = 'active_letterhead_id';
const KEY_ACTIVE_LETTERHEAD_URL = 'active_letterhead_url';
const KEY_LETTERHEAD_VERSIONS = 'letterhead_versions';

// ─── Core settings CRUD ─────────────────────────────────────────────────────

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
    await db.transaction(async (trx: any) => {
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

// ─── Letterhead helpers ──────────────────────────────────────────────────────

/** Parse the letterhead_versions JSON setting into a typed array. */
function parseVersions(raw: string | undefined): LetterheadVersion[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the letterhead_versions array back to app_settings. */
async function saveVersions(versions: LetterheadVersion[], userId?: string): Promise<void> {
  await updateAppSettings(
    { [KEY_LETTERHEAD_VERSIONS]: JSON.stringify(versions) },
    userId
  );
}

/**
 * List all letterhead versions in descending creation order.
 */
export async function listLetterheadVersions(): Promise<LetterheadVersion[]> {
  const settings = await getAppSettings();
  const versions = parseVersions(settings[KEY_LETTERHEAD_VERSIONS]);
  return versions.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Get a single version by ID. Returns null if not found.
 */
export async function getLetterheadById(id: string): Promise<LetterheadVersion | null> {
  const versions = await listLetterheadVersions();
  return versions.find((v) => v.id === id) ?? null;
}

/**
 * Get the currently active letterhead version, or null if none.
 */
export async function getActiveLetterhead(): Promise<LetterheadVersion | null> {
  const settings = await getAppSettings();
  const activeId = settings[KEY_ACTIVE_LETTERHEAD_ID];
  if (!activeId) return null;
  const versions = parseVersions(settings[KEY_LETTERHEAD_VERSIONS]);
  return versions.find((v) => v.id === activeId && v.status === 'ACTIVE') ?? null;
}

/**
 * Build a LetterheadSnapshot from the active version (for embedding in documents).
 * Returns null if no active version exists.
 */
export async function buildActiveLetterheadSnapshot(): Promise<LetterheadSnapshot | null> {
  const active = await getActiveLetterhead();
  if (!active) return null;
  return {
    id: active.id,
    url: active.url,
    name: active.name,
    snapped_at: new Date().toISOString(),
  };
}

/**
 * Register a newly uploaded letterhead version (status: PENDING).
 * Does NOT activate it — admin must call activateLetterhead explicitly.
 */
export async function registerLetterheadVersion(
  data: Pick<LetterheadVersion, 'id' | 'name' | 'url' | 'ext' | 'size_bytes'>,
  uploadedBy: string
): Promise<LetterheadVersion> {
  const settings = await getAppSettings();
  const versions = parseVersions(settings[KEY_LETTERHEAD_VERSIONS]);

  const newVersion: LetterheadVersion = {
    id: data.id,
    name: data.name,
    url: data.url,
    ext: data.ext,
    size_bytes: data.size_bytes,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    activated_at: null,
    archived_at: null,
    uploaded_by: uploadedBy,
    activated_by: null,
  };

  versions.push(newVersion);
  await saveVersions(versions, uploadedBy);
  return newVersion;
}

/**
 * Activate a specific letterhead version (atomic).
 * - Sets previous ACTIVE version to ARCHIVED.
 * - Sets target version to ACTIVE.
 * - Updates active_letterhead_id and active_letterhead_url convenience keys.
 */
export async function activateLetterhead(
  versionId: string,
  activatedBy: string
): Promise<LetterheadVersion> {
  const settings = await getAppSettings();
  const versions = parseVersions(settings[KEY_LETTERHEAD_VERSIONS]);

  const target = versions.find((v) => v.id === versionId);
  if (!target) {
    throw new AppError(`Letterhead version ${versionId} not found.`, 'ERR_NOT_FOUND', 404);
  }
  if (target.status === 'ARCHIVED') {
    throw new AppError(
      'Versi kop surat yang diarsipkan tidak dapat diaktifkan kembali.',
      'ERR_VALIDATION',
      400
    );
  }

  const now = new Date().toISOString();
  const updated = versions.map((v) => {
    if (v.id === versionId) {
      return {
        ...v,
        status: 'ACTIVE' as const,
        activated_at: now,
        activated_by: activatedBy,
        archived_at: null,
      };
    }
    if (v.status === 'ACTIVE') {
      // Retire the previously active version
      return { ...v, status: 'ARCHIVED' as const, archived_at: now };
    }
    return v;
  });

  const activatedVersion = updated.find((v) => v.id === versionId)!;

  await updateAppSettings(
    {
      [KEY_LETTERHEAD_VERSIONS]: JSON.stringify(updated),
      [KEY_ACTIVE_LETTERHEAD_ID]: versionId,
      [KEY_ACTIVE_LETTERHEAD_URL]: activatedVersion.url,
    },
    activatedBy
  );

  return activatedVersion;
}

/**
 * Archive a specific letterhead version.
 * Refuses to archive the currently active version.
 */
export async function archiveLetterhead(
  versionId: string,
  archivedBy: string
): Promise<LetterheadVersion> {
  const settings = await getAppSettings();
  const activeId = settings[KEY_ACTIVE_LETTERHEAD_ID];

  if (activeId === versionId) {
    throw new AppError(
      'Kop surat yang sedang aktif tidak dapat diarsipkan. Aktifkan versi lain terlebih dahulu.',
      'ERR_VALIDATION',
      400
    );
  }

  const versions = parseVersions(settings[KEY_LETTERHEAD_VERSIONS]);
  const target = versions.find((v) => v.id === versionId);
  if (!target) {
    throw new AppError(`Letterhead version ${versionId} not found.`, 'ERR_NOT_FOUND', 404);
  }
  if (target.status === 'ARCHIVED') {
    throw new AppError('Versi ini sudah diarsipkan.', 'ERR_VALIDATION', 400);
  }

  const now = new Date().toISOString();
  const updated = versions.map((v) =>
    v.id === versionId ? { ...v, status: 'ARCHIVED' as const, archived_at: now } : v
  );

  await saveVersions(updated, archivedBy);
  return updated.find((v) => v.id === versionId)!;
}

