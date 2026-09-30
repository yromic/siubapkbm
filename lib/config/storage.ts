import path from 'path';
import fs from 'fs';

/**
 * Centralized Storage Root Strategy for SIUBA.
 *
 * Defaults to `process.cwd()/storage/uploads` in development.
 * In production (e.g. cPanel / CloudLinux), `UPLOADS_DIR` can be configured
 * to an external persistent directory (e.g. `/home/<account>/siuba_storage/uploads`)
 * outside the disposable app deployment directory so deployments never wipe data.
 */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'storage', 'uploads');

// Parent storage directory (defaults to process.cwd()/storage)
export const STORAGE_ROOT = path.dirname(UPLOADS_ROOT);

export const STORAGE_PATHS = {
  uploads: UPLOADS_ROOT,
  studentFiles: path.join(UPLOADS_ROOT, 'student_files'),
  rpmAttachments: path.join(UPLOADS_ROOT, 'rpm_attachments'),
  exports: path.join(STORAGE_ROOT, 'exports'),
  reports: path.join(STORAGE_ROOT, 'reports'),
  templates: path.join(STORAGE_ROOT, 'templates'),
};

/**
 * Ensures a directory exists recursively and safely.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
