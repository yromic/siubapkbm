import knex from 'knex';
import config from '../knexfile';
import fs from 'fs';

const db = knex(config.development);

async function main() {
  try {
    const attachmentId = '397f245b-f51e-48ac-b16a-975c483984b5';
    const row = await db('rpm_attachments').where('id', attachmentId).first();
    console.log('Attachment row:', JSON.stringify(row, null, 2));
    if (row) {
      console.log('File path:', row.file_path);
      console.log('File exists on disk?', fs.existsSync(row.file_path));
      if (fs.existsSync(row.file_path)) {
        const stats = fs.statSync(row.file_path);
        console.log('File size on disk:', stats.size);
      }
    } else {
      const allAttachments = await db('rpm_attachments').select('id', 'document_id', 'mime_type', 'file_path', 'original_filename');
      console.log('All attachments count:', allAttachments.length);
      console.log('All attachments:', JSON.stringify(allAttachments, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.destroy();
  }
}

main();
