import knex from 'knex';
import config from '../knexfile';
import { getRpmAttachmentForDownload } from '../lib/services/rpmAttachmentService';

const db = knex(config.development);

async function main() {
  try {
    const user = await db('users').where('id', '72c73acd-6633-48ce-8ee3-e69f7d30b366').first();
    console.log('User:', user?.id, user?.role, user?.name);

    const result = await getRpmAttachmentForDownload(
      '5a3dd1df-f860-4d50-892a-19dc1009f3d6',
      '397f245b-f51e-48ac-b16a-975c483984b5',
      { id: user.id, role: user.role }
    );
    console.log('Success! Result attachment:', result.attachment);
    console.log('File buffer length:', result.fileBuffer.length);
  } catch (err) {
    console.error('Error calling getRpmAttachmentForDownload:', err);
  } finally {
    await db.destroy();
  }
}

main();
